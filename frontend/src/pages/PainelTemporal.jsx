import { useEffect, useMemo, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import { getTemporalPanelData } from "../api";

const DEFAULT_THRESHOLDS = {
  monthly_warn: 4,
  monthly_high: 8,
  annual_warn: 35,
  annual_high: 70,
  value_warn: 30,
  value_high: 50,
};

function parseISODate(value) {
  return value ? new Date(`${value}T00:00:00`) : new Date(0);
}

function formatExamDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function Chip({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-green-pale text-green-dark border border-green-dark/10",
    warning: "bg-yellow-100 text-yellow-900 border border-yellow-900/10",
    critical: "bg-red-100 text-red-900 border border-red-900/10",
    good: "bg-emerald-100 text-emerald-900 border border-emerald-900/10",
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
}

function Sparkline({ values = [], height = 26 }) {
  const width = 140;
  const h = height;

  if (!values.length) {
    return <div className="h-[26px] w-[140px] rounded-md border border-gray-200 bg-gray-100" />;
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * (width - 2) + 1;
      const y = h - ((value - minValue) / range) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={h} className="rounded-md border border-gray-200 bg-white">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-green"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={(width - 2) + 1}
        cy={h - ((values[values.length - 1] - minValue) / range) * (h - 2) - 1}
        r="2.6"
        className="fill-green"
      />
    </svg>
  );
}

function InfoTooltip({ content }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-dark/20 bg-white text-xs font-semibold text-green-dark"
        aria-label="Informação sobre a evolução"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-20 w-72 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-dark shadow-lg">
          {content}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4">
            <div className="h-4 w-28 rounded bg-green-light/50" />
            <div className="mt-3 h-8 w-36 rounded bg-green-light/50" />
            <div className="mt-3 h-4 w-44 rounded bg-green-light/40" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 rounded bg-green-light/50" />
          <div className="h-12 rounded bg-green-light/30" />
          <div className="h-12 rounded bg-green-light/30" />
          <div className="h-12 rounded bg-green-light/30" />
        </div>
      </div>
    </div>
  );
}

export default function PainelTemporal() {
  const [panelData, setPanelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [sortBy, setSortBy] = useState("priority");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchPanelData = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getTemporalPanelData();
        if (!isMounted) return;
        setPanelData(data);
      } catch (fetchError) {
        if (!isMounted) return;
        setError("Não foi possível carregar o histórico temporal dos pacientes.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPanelData();

    return () => {
      isMounted = false;
    };
  }, []);

  const thresholds = panelData?.thresholds || DEFAULT_THRESHOLDS;
  const metricLabel = panelData?.metric_label || "Índice de Calcificação";

  const rows = useMemo(() => {
    const sourcePatients = panelData?.patients || [];
    const mapped = sourcePatients.map((patient) => {
      const exams = patient.timeline?.exams || [];
      const comparableExams = exams.filter((exam) => exam.is_comparable && exam.vo_percentage !== null);
      const evolution = patient.timeline?.evolution || {};
      const rateMonthlyPct = evolution.monthly_rate_percentage ?? null;
      const rateAnnualPct = evolution.annual_rate_percentage ?? null;
      const rateToShow = period === "annual" ? rateAnnualPct : rateMonthlyPct;
      const alertLevel =
        evolution.priority?.level === "high"
          ? "critical"
          : evolution.priority?.level === "watch"
          ? "warning"
          : "none";

      return {
        ...patient,
        comparableExams,
        values: comparableExams.map((exam) => exam.vo_percentage),
        lastValue: evolution.latest_vo_percentage ?? null,
        rateMonthlyPct,
        rateAnnualPct,
        rateToShow,
        trend: evolution.trend || {
          direction: "insufficient_data",
          label: "Dados insuficientes",
          score: 0,
        },
        priority: evolution.priority || {
          level: "normal",
          label: "Sem prioridade adicional",
          sort_weight: 0,
        },
        suggestions: evolution.suggestions || [],
        alertLevel,
        firstComparableDate: comparableExams[0]?.exam_date || null,
        lastComparableDate: comparableExams[comparableExams.length - 1]?.exam_date || patient.last_exam_date,
      };
    });

    const query = search.trim().toLowerCase();
    let filtered = mapped.filter((row) => {
      if (!query) return true;
      return row.name.toLowerCase().includes(query) || String(row.id).toLowerCase().includes(query);
    });

    if (onlyAlerts) {
      filtered = filtered.filter((row) => row.alertLevel !== "none");
    }

    const direction = sortDir === "asc" ? 1 : -1;

    filtered.sort((left, right) => {
      if (sortBy === "name") return left.name.localeCompare(right.name) * direction;
      if (sortBy === "lastExam") {
        return (parseISODate(left.last_exam_date) - parseISODate(right.last_exam_date)) * direction;
      }
      if (sortBy === "rate") {
        return ((left.rateToShow ?? -Infinity) - (right.rateToShow ?? -Infinity)) * direction;
      }

      const priorityDelta =
        (left.priority?.sort_weight ?? 0) - (right.priority?.sort_weight ?? 0);
      if (priorityDelta !== 0) return priorityDelta * direction;

      return ((left.rateToShow ?? -Infinity) - (right.rateToShow ?? -Infinity)) * direction;
    });

    return filtered;
  }, [panelData, period, search, onlyAlerts, sortBy, sortDir]);

  const summary = useMemo(() => {
    if (!rows.length) {
      return {
        avgRate: null,
        critical: 0,
        warning: 0,
        topName: "—",
        suggested: 0,
      };
    }

    const validRates = rows
      .map((row) => row.rateToShow)
      .filter((value) => value !== null && value !== undefined && !Number.isNaN(value));

    const avgRate = validRates.length
      ? validRates.reduce((acc, value) => acc + value, 0) / validRates.length
      : null;

    const critical = rows.filter((row) => row.alertLevel === "critical").length;
    const warning = rows.filter((row) => row.alertLevel === "warning").length;
    const suggested = rows.filter((row) => row.suggestions.length > 0).length;

    const top = [...rows].sort((left, right) => (right.rateToShow ?? -Infinity) - (left.rateToShow ?? -Infinity))[0];

    return {
      avgRate,
      critical,
      warning,
      topName: top?.name ?? "—",
      suggested,
    };
  }, [rows]);

  const criticalThreshold = period === "annual" ? thresholds.annual_high : thresholds.monthly_high;

  return (
    <MainLayout pageTitle="Painel Temporal - CalciVision">
      <div className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-dark">Painel Temporal</h1>
            <p className="mt-1 max-w-3xl text-gray-medium">
              Evolução longitudinal dos exames por paciente, com histórico cronológico,
              métricas comparáveis e estrutura pronta para tendência, prioridade e sugestões.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar por nome ou ID…"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-dark outline-none focus:border-green sm:w-[320px]"
            />

            <label className="inline-flex items-center gap-2 text-gray-dark">
              <input
                type="checkbox"
                checked={onlyAlerts}
                onChange={(event) => setOnlyAlerts(event.target.checked)}
                className="h-4 w-4 accent-green"
              />
              <span className="text-sm">Só com prioridade</span>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="mt-6">
            <LoadingState />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red/20 bg-red/5 p-6 text-center">
            <p className="text-sm font-semibold text-red">Painel temporal indisponível</p>
            <p className="mt-2 text-sm text-gray-700">{error}</p>
          </div>
        ) : !rows.length ? (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm font-semibold text-gray-dark">Sem histórico longitudinal disponível</p>
            <p className="mt-2 text-sm text-gray-medium">
              Ainda não existem exames suficientes para construir a evolução temporal dos pacientes.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-medium">Evolução geral</p>
                <p className="mt-1 text-2xl font-semibold text-gray-dark">
                  {formatPct(summary.avgRate)}
                  <span className="ml-2 text-sm font-medium text-gray-medium">
                    / {period === "annual" ? "ano" : "mês"}
                  </span>
                </p>
                <p className="mt-2 text-sm text-gray-medium">Média da progressão dos pacientes comparáveis.</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-medium">Prioridade clínica</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip tone="critical">Críticos: {summary.critical}</Chip>
                  <Chip tone="warning">Acompanhar: {summary.warning}</Chip>
                </div>
                <p className="mt-2 text-sm text-gray-medium">Baseado no valor mais recente e na taxa de evolução.</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-medium">Maior progressão</p>
                <p className="mt-1 text-2xl font-semibold text-gray-dark">{summary.topName}</p>
                <p className="mt-2 text-sm text-gray-medium">Paciente com a maior taxa no período selecionado.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-green-light p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-medium">Taxa:</span>
                  <div className="inline-flex overflow-hidden rounded-xl border border-gray-200 bg-white">
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

                  <span className="ml-2 text-sm text-gray-medium">Ordenar por:</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-dark outline-none focus:border-green"
                  >
                    <option value="priority">Prioridade clínica</option>
                    <option value="rate">Taxa de progressão</option>
                    <option value="lastExam">Data do último exame</option>
                    <option value="name">Nome</option>
                  </select>

                  <select
                    value={sortDir}
                    onChange={(event) => setSortDir(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-dark outline-none focus:border-green"
                  >
                    <option value="desc">Descendente</option>
                    <option value="asc">Ascendente</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h2 className="text-lg font-semibold text-gray-dark">Pacientes e evolução</h2>
                <span className="text-sm text-gray-medium">{rows.length} registos</span>
              </div>

              <div className="overflow-auto">
                <table className="min-w-[1120px] w-full">
                  <thead className="bg-green-light">
                    <tr className="text-left">
                      <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Paciente</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-dark">
                        <span className="inline-flex items-center gap-2">
                          Evolução
                          <InfoTooltip
                            content={`${metricLabel}: série cronológica dos exames comparáveis do paciente. A partir desta sequência, o sistema calcula evolução, tendência, prioridade e sugestões.`}
                          />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Variável objetiva (último)</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-dark">
                        Taxa {period === "annual" ? "anual" : "mensal"}
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Tendência</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Prioridade</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-dark">Último exame</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => {
                      const highlightRow =
                        row.alertLevel === "critical" || (row.rateToShow ?? -Infinity) >= criticalThreshold;

                      const rowBg =
                        row.alertLevel === "critical"
                          ? "bg-red-50"
                          : row.alertLevel === "warning"
                          ? "bg-yellow-50"
                          : "bg-white";

                      return (
                        <tr
                          key={row.id}
                          className={`border-t border-gray-100 ${rowBg} ${
                            highlightRow ? "shadow-[inset_4px_0_0_0_rgba(24,120,76,0.55)]" : ""
                          }`}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 place-items-center rounded-xl bg-green-pale font-semibold text-green-dark">
                                {row.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <p className="leading-5 font-semibold text-gray-dark">{row.name}</p>
                                <p className="text-sm text-gray-medium">
                                  {row.sex} · {row.birth_year || "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <Sparkline values={row.values} />
                              <div className="text-sm text-gray-medium">
                                <p className="font-medium text-gray-dark">
                                  {row.firstComparableDate
                                    ? `${formatExamDate(row.firstComparableDate)} → ${formatExamDate(row.lastComparableDate)}`
                                    : "Sem exames comparáveis"}
                                </p>
                                <p>
                                  {row.comparable_exam_count}/{row.exam_count} exames comparáveis
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-dark">{formatValue(row.lastValue)}</p>
                            <p className="text-sm text-gray-medium">
                              {row.lastValue !== null ? "Último valor comparável" : "Sem VO validada"}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-dark">{formatPct(row.rateToShow)}</p>
                            <p className="text-sm text-gray-medium">
                              mensal: {formatPct(row.rateMonthlyPct)} · anual: {formatPct(row.rateAnnualPct)}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-2">
                              <Chip
                                tone={
                                  row.trend.score > 0
                                    ? "warning"
                                    : row.trend.score < 0
                                    ? "good"
                                    : "neutral"
                                }
                              >
                                {row.trend.score > 0 ? "↗" : row.trend.score < 0 ? "↘" : "→"} {row.trend.label}
                              </Chip>
                              <p className="text-xs text-gray-medium">
                                {row.comparable_exam_count >= 2
                                  ? `${row.timeline?.evolution?.intervals?.length || 0} intervalo(s) comparável(is)`
                                  : "São precisos pelo menos dois exames com VO"}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-2">
                              <Chip
                                tone={
                                  row.alertLevel === "critical"
                                    ? "critical"
                                    : row.alertLevel === "warning"
                                    ? "warning"
                                    : "neutral"
                                }
                              >
                                {row.priority.label}
                              </Chip>
                              <p className="text-xs text-gray-medium">
                                {row.suggestions[0] || "Sem recomendação adicional."}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-medium text-gray-dark">{formatExamDate(row.last_exam_date)}</p>
                            <p className="text-sm text-gray-medium">Último registo cronológico</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
