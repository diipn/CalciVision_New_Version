import { useMemo, useState } from "react";
import MainLayout from "../layouts/MainLayout";

// ---------------------------
// Mock data (protótipo)
// ---------------------------
const MOCK_PATIENTS = [
  {
    id: "P-001",
    name: "Paulo Borges",
    birthYear: 1959,
    sex: "M",
    lastExamDate: "2026-01-12",
    objectiveVarName: "Índice de Calcificação",
    unit: "pts",
    exams: [
      { date: "2024-03-10", value: 210 },
      { date: "2024-10-10", value: 275 },
      { date: "2025-06-10", value: 360 },
      { date: "2026-01-12", value: 470 },
    ],
  },
  {
    id: "P-002",
    name: "Ana Martins",
    birthYear: 1968,
    sex: "F",
    lastExamDate: "2025-12-20",
    objectiveVarName: "Índice de Calcificação",
    unit: "pts",
    exams: [
      { date: "2024-01-07", value: 120 },
      { date: "2024-09-07", value: 140 },
      { date: "2025-03-07", value: 165 },
      { date: "2025-12-20", value: 185 },
    ],
  },
  {
    id: "P-003",
    name: "João Costa",
    birthYear: 1951,
    sex: "M",
    lastExamDate: "2026-01-03",
    objectiveVarName: "Índice de Calcificação",
    unit: "pts",
    exams: [
      { date: "2024-07-03", value: 340 },
      { date: "2025-01-03", value: 410 },
      { date: "2025-07-03", value: 520 },
      { date: "2026-01-03", value: 720 },
    ],
  },
  {
    id: "P-004",
    name: "Marta Silva",
    birthYear: 1972,
    sex: "F",
    lastExamDate: "2025-11-05",
    objectiveVarName: "Índice de Calcificação",
    unit: "pts",
    exams: [
      { date: "2024-05-05", value: 95 },
      { date: "2024-11-05", value: 98 },
      { date: "2025-05-05", value: 102 },
      { date: "2025-11-05", value: 110 },
    ],
  },
];

// ---------------------------
// Helpers
// ---------------------------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseISODate(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function monthsBetween(d1, d2) {
  const a = parseISODate(d1);
  const b = parseISODate(d2);
  const years = b.getFullYear() - a.getFullYear();
  const months = b.getMonth() - a.getMonth();
  const total = years * 12 + months;
  const dayFrac = (b.getDate() - a.getDate()) / 30;
  return total + dayFrac;
}

function computeRatePercent(exams, period = "monthly") {
  if (!exams || exams.length < 2) return 0;

  const first = exams[0];
  const last = exams[exams.length - 1];

  const delta = last.value - first.value;
  const base = Math.max(first.value, 1);

  const months = Math.max(monthsBetween(first.date, last.date), 1 / 30);
  const perMonth = (delta / base) / months;

  if (period === "annual") return perMonth * 12 * 100;
  return perMonth * 100;
}

function computeTrend(exams) {
  if (!exams || exams.length < 3) return { label: "Estável", score: 0 };

  const a = exams[exams.length - 3].value;
  const b = exams[exams.length - 2].value;
  const c = exams[exams.length - 1].value;

  const slope1 = b - a;
  const slope2 = c - b;
  const avg = (slope1 + slope2) / 2;

  if (avg > 8) return { label: "Tendência a aumentar", score: 1 };
  if (avg < -8) return { label: "Tendência a diminuir", score: -1 };
  return { label: "Estável", score: 0 };
}

function computePriorityIndex({ ratePct, lastValue, alertLevel }) {
  const rateComponent = clamp(ratePct, 0, 250) * 0.6;
  const valueComponent = clamp(lastValue / 10, 0, 200) * 0.3;
  const alertBoost = alertLevel === "critical" ? 25 : alertLevel === "warning" ? 12 : 0;
  return Math.round(rateComponent + valueComponent + alertBoost);
}

function getAlertLevel({ rateMonthlyPct, rateAnnualPct, lastValue, thresholds }) {
  const { monthlyWarn, monthlyCrit, annualWarn, annualCrit, valueWarn, valueCrit } = thresholds;

  if (rateMonthlyPct >= monthlyCrit || rateAnnualPct >= annualCrit || lastValue >= valueCrit) return "critical";
  if (rateMonthlyPct >= monthlyWarn || rateAnnualPct >= annualWarn || lastValue >= valueWarn) return "warning";
  return "none";
}

function formatPct(n) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function Chip({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-green-pale text-green-dark border border-green-dark/10",
    warning: "bg-yellow-100 text-yellow-900 border border-yellow-900/10",
    critical: "bg-red-100 text-red-900 border border-red-900/10",
    good: "bg-emerald-100 text-emerald-900 border border-emerald-900/10",
  };
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
}

function Sparkline({ values = [], height = 26 }) {
  const w = 140;
  const h = height;

  if (!values.length) {
    return <div className="w-[140px] h-[26px] rounded-md bg-gray-100 border border-gray-200" />;
  }

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = Math.max(maxV - minV, 1);

  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * (w - 2) + 1;
      const y = h - ((v - minV) / range) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="rounded-md bg-white border border-gray-200">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-green"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.length > 0 && (
        <circle
          cx={(w - 2) + 1}
          cy={h - ((values[values.length - 1] - minV) / range) * (h - 2) - 1}
          r="2.6"
          className="fill-green"
        />
      )}
    </svg>
  );
}

// ---------------------------
// Page
// ---------------------------
export default function PainelTemporal() {
  const [period, setPeriod] = useState("monthly");
  const [sortBy, setSortBy] = useState("priority");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const [thresholds] = useState({
    monthlyWarn: 12,
    monthlyCrit: 20,
    annualWarn: 80,
    annualCrit: 120,
    valueWarn: 450,
    valueCrit: 650,
  });

  const rows = useMemo(() => {
    const mapped = MOCK_PATIENTS.map((p) => {
      const values = p.exams.map((e) => e.value);
      const lastValue = values[values.length - 1] ?? 0;

      const rateMonthlyPct = computeRatePercent(p.exams, "monthly");
      const rateAnnualPct = computeRatePercent(p.exams, "annual");
      const trend = computeTrend(p.exams);

      const alertLevel = getAlertLevel({
        rateMonthlyPct,
        rateAnnualPct,
        lastValue,
        thresholds,
      });

      const rateToShow = period === "annual" ? rateAnnualPct : rateMonthlyPct;
      const priorityIndex = computePriorityIndex({ ratePct: rateToShow, lastValue, alertLevel });

      return {
        ...p,
        values,
        lastValue,
        rateMonthlyPct,
        rateAnnualPct,
        rateToShow,
        trend,
        alertLevel,
        priorityIndex,
      };
    });

    const q = search.trim().toLowerCase();
    let filtered = mapped.filter((r) => {
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
    });

    if (onlyAlerts) filtered = filtered.filter((r) => r.alertLevel !== "none");

    const dir = sortDir === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * dir;
      if (sortBy === "lastExam") return (parseISODate(a.lastExamDate) - parseISODate(b.lastExamDate)) * dir;
      if (sortBy === "rate") return (a.rateToShow - b.rateToShow) * dir;
      return (a.priorityIndex - b.priorityIndex) * dir;
    });

    return filtered;
  }, [period, sortBy, sortDir, search, onlyAlerts, thresholds]);

  const summary = useMemo(() => {
    if (!rows.length) return { avgRate: 0, critical: 0, warning: 0, topName: "—" };

    const avgRate = rows.reduce((acc, r) => acc + r.rateToShow, 0) / rows.length;
    const critical = rows.filter((r) => r.alertLevel === "critical").length;
    const warning = rows.filter((r) => r.alertLevel === "warning").length;
    const top = [...rows].sort((a, b) => b.priorityIndex - a.priorityIndex)[0];

    return { avgRate, critical, warning, topName: top?.name ?? "—" };
  }, [rows]);

  return (
    <MainLayout pageTitle="Painel Temporal - CalciVision">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-dark">Painel Temporal</h1>
            <p className="text-gray-medium mt-1 max-w-3xl">
              Visualização da evolução da variável objetiva ao longo do tempo. Protótipo para comparar exames,
              calcular taxas de progressão, priorizar doentes e sinalizar alertas clínicos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome ou ID…"
                className="w-full sm:w-[320px] rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-dark outline-none focus:border-green"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-gray-dark">
              <input
                type="checkbox"
                checked={onlyAlerts}
                onChange={(e) => setOnlyAlerts(e.target.checked)}
                className="h-4 w-4 accent-green"
              />
              <span className="text-sm">Só com alertas</span>
            </label>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white border border-gray-200 p-4">
            <p className="text-sm text-gray-medium">Evolução geral</p>
            <p className="mt-1 text-2xl font-semibold text-gray-dark">
              {formatPct(summary.avgRate)}
              <span className="text-sm font-medium text-gray-medium ml-2">
                / {period === "annual" ? "ano" : "mês"}
              </span>
            </p>
            <p className="mt-2 text-sm text-gray-medium">Média da progressão (protótipo).</p>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 p-4">
            <p className="text-sm text-gray-medium">Alertas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip tone="critical">❗ Críticos: {summary.critical}</Chip>
              <Chip tone="warning">⚠ Avisos: {summary.warning}</Chip>
            </div>
            <p className="mt-2 text-sm text-gray-medium">
              Sinalização quando a progressão ultrapassa limiares.
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 p-4">
            <p className="text-sm text-gray-medium">Prioridade máxima</p>
            <p className="mt-1 text-2xl font-semibold text-gray-dark">{summary.topName}</p>
            <p className="mt-2 text-sm text-gray-medium">
              Ordena automaticamente por índice de prioridade (protótipo).
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 p-4">
            <p className="text-sm text-gray-medium">Previsão</p>
            <p className="mt-1 text-2xl font-semibold text-gray-dark">Tendência</p>
            <p className="mt-2 text-sm text-gray-medium">
              Placeholder para IA/ML (ex.: regressão, séries temporais).
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 rounded-2xl bg-green-light border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-medium">Taxa:</span>
              <div className="inline-flex rounded-xl border border-gray-200 bg-white overflow-hidden">
                <button
                  onClick={() => setPeriod("monthly")}
                  className={`px-4 py-2 text-sm font-medium ${
                    period === "monthly" ? "bg-green text-white" : "text-gray-dark hover:bg-green-pale"
                  }`}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setPeriod("annual")}
                  className={`px-4 py-2 text-sm font-medium ${
                    period === "annual" ? "bg-green text-white" : "text-gray-dark hover:bg-green-pale"
                  }`}
                >
                  Anual
                </button>
              </div>

              <span className="text-sm text-gray-medium ml-2">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-dark outline-none focus:border-green"
              >
                <option value="priority">Prioridade clínica</option>
                <option value="rate">Taxa de progressão</option>
                <option value="lastExam">Data do último exame</option>
                <option value="name">Nome</option>
              </select>

              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-dark outline-none focus:border-green"
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-start lg:justify-end">
              <Chip tone="neutral">
                Limiar aviso: {period === "annual" ? thresholds.annualWarn : thresholds.monthlyWarn}%
              </Chip>
              <Chip tone="neutral">
                Limiar crítico: {period === "annual" ? thresholds.annualCrit : thresholds.monthlyCrit}%
              </Chip>
              <Chip tone="neutral">Valor crítico: ≥ {thresholds.valueCrit} pts</Chip>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-dark">Doentes e evolução</h2>
            <span className="text-sm text-gray-medium">{rows.length} registos</span>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full">
              <thead className="bg-green-light">
                <tr className="text-left">
                  <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Doente</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Evolução</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Último valor</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-dark">
                    Taxa {period === "annual" ? "anual" : "mensal"}
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Tendência</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Prioridade</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Alertas</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Último exame</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const urgent = r.alertLevel === "critical" || r.priorityIndex >= 110;

                  const rowBg =
                    r.alertLevel === "critical"
                      ? "bg-red-50"
                      : r.alertLevel === "warning"
                      ? "bg-yellow-50"
                      : "bg-white";

                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-gray-100 ${rowBg} ${
                        urgent ? "shadow-[inset_4px_0_0_0_rgba(24,120,76,0.55)]" : ""
                      }`}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-green-pale grid place-items-center text-green-dark font-semibold">
                            {r.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-dark leading-5">{r.name}</p>
                            <p className="text-sm text-gray-medium">
                              {r.id} · {r.sex} · {r.birthYear}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Sparkline values={r.values} />
                          <div className="text-sm text-gray-medium">
                            <p className="text-gray-dark font-medium">{r.objectiveVarName}</p>
                            <p>
                              {r.exams[0]?.date} → {r.exams[r.exams.length - 1]?.date}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-gray-dark font-semibold">
                          {r.lastValue} <span className="text-sm text-gray-medium">{r.unit}</span>
                        </p>
                        <p className="text-sm text-gray-medium">{r.values.length} exames</p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-gray-dark font-semibold">{formatPct(r.rateToShow)}</p>
                        <p className="text-sm text-gray-medium">
                          (mensal: {formatPct(r.rateMonthlyPct)} · anual: {formatPct(r.rateAnnualPct)})
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <Chip tone={r.trend.score > 0 ? "warning" : r.trend.score < 0 ? "good" : "neutral"}>
                            {r.trend.score > 0 ? "↗" : r.trend.score < 0 ? "↘" : "→"} {r.trend.label}
                          </Chip>
                          <p className="text-xs text-gray-medium">(placeholder para modelo preditivo)</p>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-gray-dark font-semibold">{r.priorityIndex}</p>
                        <p className="text-sm text-gray-medium">
                          {r.priorityIndex >= 130 ? "Muito urgente" : r.priorityIndex >= 100 ? "Urgente" : "Vigilância"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        {r.alertLevel === "critical" ? (
                          <div className="flex flex-col gap-1">
                            <Chip tone="critical">❗ Progressão alarmante</Chip>
                            <span className="text-xs text-gray-medium">Notificar equipa clínica (protótipo)</span>
                          </div>
                        ) : r.alertLevel === "warning" ? (
                          <div className="flex flex-col gap-1">
                            <Chip tone="warning">⚠ Atenção</Chip>
                            <span className="text-xs text-gray-medium">Rever em breve (protótipo)</span>
                          </div>
                        ) : (
                          <Chip tone="neutral">Sem alertas</Chip>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-gray-dark font-medium">{r.lastExamDate}</p>
                        <p className="text-sm text-gray-medium">Último registo</p>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-medium">
                      Não foram encontrados resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 text-sm text-gray-medium">
          Nota: este painel é um protótipo visual. As taxas, alertas e tendência são calculados com regras simples apenas para
          simular o comportamento futuro.
        </div>
      </div>
    </MainLayout>
  );
}
