<<<<<<< Updated upstream
import { Link } from "react-router-dom";

function StatusBadge({ status }) {
  const config =
    status === "READY"
      ? {
          label: "Validado",
          className: "border-green-200 bg-green-50 text-green-800",
        }
      : status === "FAILED"
      ? {
          label: "Com falha",
          className: "border-red/30 bg-red/5 text-red",
        }
      : {
          label: "Por validar",
          className: "border-amber-200 bg-amber-50 text-amber-800",
        };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return "N/D";
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "N/D";
  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function SectionCard({ title, eyebrow, children, className = "" }) {
  return (
    <section className={`report-section rounded-[28px] border border-green-pale bg-white p-6 shadow-sm ${className}`}>
      <div className="report-section-heading">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-dark">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="mt-2 text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function KeyValueGrid({ items = [] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
          <p className="mt-2 text-sm font-medium leading-6 text-gray-900">{item.value || "—"}</p>
        </div>
      ))}
    </div>
  );
}

function SummaryCards({ items = [] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-green-pale bg-green-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">{item.label}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-green-900">{item.value || "—"}</p>
        </div>
      ))}
    </div>
  );
}

function FindingsList({ items = [] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
          <p className="mt-2 text-sm leading-7 text-gray-900">{item.value || "—"}</p>
        </div>
      ))}
    </div>
  );
}

function MetricsTable({ rows = [], isPrintMode = false }) {
  if (isPrintMode) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-100">
        <table className="w-full table-fixed border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-[28%] break-words px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Métrica
              </th>
              <th className="w-[14%] break-words px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Valor
              </th>
              <th className="w-[12%] break-words px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Unidade
              </th>
              <th className="w-[46%] break-words px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Interpretação
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={`${row.label}-${row.value}`} className="border-t border-gray-100 align-top">
                  <td className="break-words px-3 py-3 text-sm font-medium text-gray-900">{row.label}</td>
                  <td className="break-words px-3 py-3 text-sm text-gray-700">{row.value || "—"}</td>
                  <td className="break-words px-3 py-3 text-sm text-gray-700">{row.unit || "—"}</td>
                  <td className="break-words px-3 py-3 text-sm leading-6 text-gray-600">
                    {row.interpretation || "Sem observação adicional."}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-sm text-gray-500">
                  Não existem métricas estruturadas disponíveis.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100">
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-[980px] w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-[30%] whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Métrica
              </th>
              <th className="w-[14%] whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Valor
              </th>
              <th className="w-[12%] whitespace-nowrap px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Unidade
              </th>
              <th className="min-w-[420px] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Interpretação
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={`${row.label}-${row.value}`} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">{row.label}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">{row.value || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">{row.unit || "—"}</td>
                  <td className="px-4 py-4 text-sm leading-6 text-gray-600">
                    {row.interpretation || "Sem observação adicional."}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-gray-500">
                  Não existem métricas estruturadas disponíveis.
                </td>
              </tr>
            )}
          </tbody>
        </table>
=======
import { formatClinicalTimestamp } from "../utils/clinicalReport";

function SectionCard({ title, description, children, accent = "default" }) {
  const accentClass =
    accent === "success"
      ? "border-green-dark/20 bg-green-50/60"
      : accent === "warning"
      ? "border-orange-200 bg-orange-50/60"
      : "border-green-pale bg-white";

  return (
    <section className={`rounded-xl border p-4 shadow-sm ${accentClass}`}>
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {description ? <p className="mt-1 text-xs text-gray-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricChip({ label, value }) {
  return (
    <div className="rounded-full border border-green-pale bg-white px-3 py-2 text-xs text-gray-700">
      <span className="font-semibold text-gray-900">{label}:</span> {value}
    </div>
  );
}

export default function ClinicalReportStep({
  patient,
  exam,
  reportInputs,
  onInputChange,
  onGenerate,
  onExport,
  onSubmit,
  canGenerate,
  canExport,
  canSubmit,
  reportReady,
  reportData,
  reportStatusLabel,
  reportUpdatedAt,
  reportError,
  isGenerating,
  isExporting,
  isSubmitting,
  submitLabel = "Submeter",
}) {
  const identification = reportData?.identification || {};
  const automaticSummary = reportData?.automatic_summary || {};
  const findings = reportData?.findings || {};
  const measurements = reportData?.measurements || [];
  const validation = reportData?.validation || {};
  const conclusion = reportData?.conclusion || {};

  return (
    <div className="space-y-4">
      <SectionCard
        title="Estado do relatório"
        description="O relatório é persistido por exame. Gere primeiro a versão estruturada, reveja o conteúdo e exporte o PDF final quando estiver pronto."
        accent={reportReady ? "success" : "warning"}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-dark">
              {reportStatusLabel}
            </div>
            <p className="text-xs text-gray-600">
              {reportUpdatedAt
                ? `Última atualização: ${formatClinicalTimestamp(reportUpdatedAt)}`
                : "Ainda não existe um relatório persistido para este exame."}
            </p>
          </div>
          {reportError ? (
            <div className="rounded-lg border border-red/20 bg-red/5 px-3 py-2 text-xs text-red">
              {reportError}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Identificação do paciente e do exame"
        description="Dados de contexto que acompanham o relatório exportado."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-green-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Paciente</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {identification.patient_name || patient?.name || "N/D"}
            </p>
            <p className="mt-1 text-xs text-gray-600">ID: {identification.patient_id ?? patient?.id ?? "N/D"}</p>
          </div>
          <div className="rounded-lg bg-green-50/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Exame selecionado</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {identification.exam_label || exam?.description || "N/D"}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              {identification.exam_date_label || "Data indisponível"} · {identification.modality || "N/D"}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Resumo automático da análise"
        description="Esta secção é gerada pelo sistema e deve ser lida como apoio à revisão clínica, não como verdade absoluta."
      >
        <div className="flex flex-wrap gap-2">
          {(automaticSummary.indicators || []).map((indicator) => (
            <MetricChip key={indicator.label} label={indicator.label} value={indicator.value} />
          ))}
        </div>
        {automaticSummary.context_note ? (
          <p className="mt-3 text-xs text-gray-600">{automaticSummary.context_note}</p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Achados e observações da válvula"
        description="Os achados automáticos aparecem separados do texto validado/editado pelo utilizador."
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-green-pale bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Achados automáticos</p>
            <div className="mt-2 space-y-2 text-sm text-gray-700">
              <p><span className="font-semibold text-gray-900">Estado da válvula:</span> {findings.valve_state || "N/D"}</p>
              <p><span className="font-semibold text-gray-900">Calcificação:</span> {findings.calcification_presence || "N/D"}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {(findings.auto_findings || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Observações validadas pelo utilizador
            </label>
            <textarea
              className="mt-2 min-h-[120px] w-full rounded-lg border border-green-pale bg-white p-3 text-sm text-gray-900 outline-none transition focus:border-green-dark"
              value={reportInputs.valveObservations}
              onChange={(event) => onInputChange("valveObservations", event.target.value)}
              placeholder="Acrescente achados relevantes, limitações da janela acústica ou correções à interpretação automática."
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Medições e métricas"
        description="Valores quantitativos principais associados à análise selecionada."
      >
        <div className="overflow-hidden rounded-lg border border-green-pale bg-white">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-green-pale bg-green-50/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>Métrica</span>
            <span>Valor</span>
          </div>
          {(measurements || []).map((measurement) => (
            <div
              key={measurement.label}
              className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-green-pale px-3 py-2 text-sm text-gray-800 last:border-b-0"
            >
              <span>{measurement.label}</span>
              <span className="font-semibold text-gray-900">{measurement.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Validação e edição pelo utilizador"
        description="As notas abaixo representam a revisão humana e ficam separadas da geração automática."
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-green-pale bg-white p-3 text-sm text-gray-700">
            <p>
              <span className="font-semibold text-gray-900">Estado:</span>{" "}
              {validation.validation_status || "Pendente"}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-gray-900">Campos automáticos:</span>{" "}
              {(validation.auto_generated_fields || []).join(", ") || "N/D"}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Notas de validação
            </label>
            <textarea
              className="mt-2 min-h-[100px] w-full rounded-lg border border-green-pale bg-white p-3 text-sm text-gray-900 outline-none transition focus:border-green-dark"
              value={reportInputs.validationNotes}
              onChange={(event) => onInputChange("validationNotes", event.target.value)}
              placeholder="Registe validações, ressalvas clínicas ou decisões tomadas durante a revisão."
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Conclusão clínica"
        description="Conclusão final editável, preparada para exportação e arquivo."
        accent="success"
      >
        <textarea
          className="min-h-[140px] w-full rounded-lg border border-green-pale bg-white p-3 text-sm text-gray-900 outline-none transition focus:border-green-dark"
          value={reportInputs.conclusion}
          onChange={(event) => onInputChange("conclusion", event.target.value)}
          placeholder="Escreva a conclusão clínica final do relatório."
        />
        {conclusion.final_text ? (
          <p className="mt-3 text-xs text-gray-600">
            Pré-visualização atual da conclusão: {conclusion.final_text}
          </p>
        ) : null}
      </SectionCard>

      {!reportReady ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          Gere primeiro o relatório estruturado. A exportação PDF só fica disponível depois de existir um relatório válido para este exame.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          className="rounded-lg bg-green-dark px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
        >
          {isGenerating ? "A gerar..." : "Gerar relatório"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-green-pale bg-white px-4 py-3 text-sm font-semibold text-green-dark transition disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onExport}
          disabled={!canExport || isExporting}
        >
          {isExporting ? "A exportar..." : "Exportar PDF"}
        </button>
        <button
          type="button"
          className="rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? "A guardar..." : submitLabel}
        </button>
>>>>>>> Stashed changes
      </div>
    </div>
  );
}

function ReadOnlyTextBlock({ label, helper, value }) {
  const lines = String(value || "—").split("\n").filter(Boolean);

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        {helper ? <span className="text-xs text-gray-500">{helper}</span> : null}
      </div>
      <div className="mt-3 space-y-2 text-sm leading-7 text-gray-900">
        {lines.length > 0 ? lines.map((line, index) => <p key={`${label}-${index}`}>{line}</p>) : <p>—</p>}
      </div>
    </div>
  );
}

function ManualTextarea({ label, helper, value, onChange, placeholder, rows = 5 }) {
  return (
    <label className="block">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        {helper ? <span className="text-xs text-gray-500">{helper}</span> : null}
      </div>
      <textarea
        className="mt-2 min-h-[160px] w-full rounded-2xl border border-green-pale bg-white px-4 py-3 text-sm leading-7 text-gray-900 outline-none transition focus:border-green-dark"
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export default function ClinicalReportStep({
  report,
  reportLoading,
  reportSaving,
  reportError,
  reportNotice,
  validatedSummary,
  clinicalNotes,
  clinicalConclusion,
  onValidatedSummaryChange,
  onNotesChange,
  onConclusionChange,
  isEditing,
  hasUnsavedChanges,
  onStartEditing,
  onCancelEditing,
  onSaveChanges,
  onFinalize,
  onExport,
  canFinalize,
  isExportAvailable,
  backToAnalysisHref,
  submitLabel = "Validar relatório",
  layoutMode = "web",
  showActions = true,
}) {
  const isPrintMode = layoutMode === "print";
  const reportContent = report?.content || {};
  const identification = reportContent.identification || {};
  const summary = reportContent.summary || {};
  const findings = reportContent.findings || {};
  const metrics = reportContent.metrics || {};
  const validation = reportContent.validation || {};
  const conclusion = reportContent.conclusion || {};
  const validationIssues = report?.validation_issues || [];

  const identificationItems = identification.items || [];
  const highlightedResults = [
    { label: "Resultado da IA", value: summary.ai_result || "—" },
    { label: "Calcificação", value: summary.calcification_presence || "—" },
    { label: "Classificação", value: summary.classification || "—" },
    ...(summary.highlights || []),
  ];

  const quickFacts = [
    {
      label: "Estado",
      value:
        report?.status === "READY"
          ? "Validado"
          : report?.status === "FAILED"
          ? "Falha"
          : "Por validar",
    },
    { label: "Gerado em", value: formatDateTime(report?.created_at || report?.updated_at) },
    { label: "Última atualização", value: formatDateTime(report?.updated_at) },
    { label: "Exame", value: report?.exam_description || "N/D" },
    { label: "Data do exame", value: formatDateOnly(report?.exam_date) },
  ];

  return (
    <div className={isPrintMode ? "mx-auto w-full max-w-[794px] space-y-5 bg-white" : "space-y-6"}>
      <section className="overflow-hidden rounded-[32px] border border-green-pale bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,#f4fbf7_0%,#ffffff_58%,#eef7f2_100%)] px-6 py-6 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-green-dark">
                CalciVision
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                Relatório clínico
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">
                Documento clínico dedicado ao exame selecionado, com separação clara entre
                resultado automático, validação médica e conclusão final.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 rounded-[24px] border border-white/80 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center gap-3">
                {report ? <StatusBadge status={report.status} /> : null}
                {reportSaving || reportLoading ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    A processar…
                  </span>
                ) : null}
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-semibold text-gray-900">Data de geração:</span>{" "}
                  {formatDateTime(report?.created_at || report?.updated_at)}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Paciente:</span>{" "}
                  {report?.patient_name || "N/D"}
                </p>
              </div>
              {showActions && backToAnalysisHref ? (
                <Link
                  to={backToAnalysisHref}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-green-dark hover:text-green"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                    <path fill="currentColor" d="m7.825 13l3.9 3.9l-1.4 1.4L4 12l6.325-6.3l1.4 1.4l-3.9 3.9H20v2z" />
                  </svg>
                  Voltar à análise
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {reportError ? (
        <div className="rounded-2xl border border-red/30 bg-red/5 px-5 py-4 text-sm text-red">
          {reportError}
        </div>
      ) : null}

      {reportNotice ? (
        <div className="rounded-2xl border border-green-pale bg-green-50 px-5 py-4 text-sm text-green-900">
          {reportNotice}
        </div>
      ) : null}

      {reportLoading && !report ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-6 text-sm text-gray-600 shadow-sm">
          A carregar relatório clínico…
        </div>
      ) : !report ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-6 text-sm text-gray-600 shadow-sm">
          Ainda não existe um relatório gerado para este exame. Volte à análise e gere o relatório primeiro.
        </div>
      ) : (
        <div className={showActions ? "grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]" : "space-y-6"}>
          <div className="space-y-6">
            <SectionCard title="Identificação do paciente" eyebrow="Secção 1">
              <KeyValueGrid items={identificationItems} />
            </SectionCard>

            <SectionCard title="Resultado da análise" eyebrow="Secção 2">
              <div className="space-y-5">
                <SummaryCards items={highlightedResults} />
                <div className="rounded-2xl border border-green-pale bg-green-50 px-5 py-4 text-sm leading-7 text-green-900">
                  {summary.context_note || "O resultado automático deve ser interpretado no contexto clínico global."}
                </div>
              </div>
            </SectionCard>

            <div className={isPrintMode ? "space-y-6" : "grid gap-6 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"}>
              <SectionCard title="Achados e observações da válvula" eyebrow="Secção 3">
                <FindingsList items={findings.items || []} />
              </SectionCard>

              <SectionCard title="Métricas" eyebrow="Secção 4">
                <MetricsTable rows={metrics.rows || []} isPrintMode={isPrintMode} />
              </SectionCard>
            </div>

            <SectionCard title="Observações clínicas e validação" eyebrow="Secção 5">
              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-sm leading-7 text-gray-700">
                  <p className="font-semibold text-gray-900">{validation.status || "Pendente de validação"}</p>
                  <p className="mt-2">
                    {validation.generated_note || "Os campos seguintes compõem a parte revista e confirmada pelo utilizador."}
                  </p>
                </div>

                {isEditing ? (
                  <>
                    <ManualTextarea
                      label="Síntese validada pelo utilizador"
                      helper="Aparece no relatório web e no PDF"
                      value={validatedSummary}
                      onChange={onValidatedSummaryChange}
                      placeholder="Sintetize a leitura final do exame de forma clínica e objetiva."
                      rows={5}
                    />

                    <ManualTextarea
                      label="Observações clínicas"
                      helper="Contexto, limitações técnicas, validação médica e recomendações"
                      value={clinicalNotes}
                      onChange={onNotesChange}
                      placeholder="Registe contexto clínico relevante, limitações da imagem, notas sobre a válvula e recomendações."
                      rows={6}
                    />
                  </>
                ) : (
                  <>
                    <ReadOnlyTextBlock
                      label="Síntese validada pelo utilizador"
                      helper="Incluída no relatório final"
                      value={validatedSummary}
                    />
                    <ReadOnlyTextBlock
                      label="Observações clínicas"
                      helper="Contexto, limitações e recomendações"
                      value={clinicalNotes}
                    />
                  </>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Conclusão" eyebrow="Secção 6">
              <div className="space-y-5">
                <div className="rounded-2xl border border-green-pale bg-green-50 px-5 py-4 text-sm leading-7 text-green-900">
                  <span className="font-semibold">Base automática:</span>{" "}
                  {conclusion.suggested_text || "Sem sugestão automática disponível."}
                </div>

                {isEditing ? (
                  <ManualTextarea
                    label="Conclusão clínica final"
                    helper="Texto final incluído na versão exportada"
                    value={clinicalConclusion}
                    onChange={onConclusionChange}
                    placeholder="Redija a conclusão clínica final com linguagem clara, profissional e pronta para arquivo."
                    rows={6}
                  />
                ) : (
                  <ReadOnlyTextBlock
                    label="Conclusão clínica final"
                    helper="Incluída no documento e no PDF"
                    value={clinicalConclusion}
                  />
                )}
              </div>
            </SectionCard>
          </div>

          {showActions ? (
            <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
              <SectionCard title="Ações do relatório" eyebrow="Painel lateral">
                <div className="space-y-3">
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        className="w-full rounded-2xl bg-green-dark px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={onStartEditing}
                        disabled={reportLoading || reportSaving}
                      >
                        Editar relatório
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-2xl bg-green px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={onFinalize}
                        disabled={!canFinalize || reportLoading || reportSaving}
                      >
                        {report?.status === "READY" ? "Relatório validado" : submitLabel}
                      </button>
                      {isExportAvailable ? (
                        <button
                          type="button"
                          className="w-full rounded-2xl border border-green-pale px-4 py-3 text-sm font-semibold text-green-dark"
                          onClick={onExport}
                          disabled={reportLoading || reportSaving}
                        >
                          Transferir PDF
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="w-full rounded-2xl bg-green-dark px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={onSaveChanges}
                        disabled={!hasUnsavedChanges || reportLoading || reportSaving}
                      >
                        Guardar alterações
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
                        onClick={onCancelEditing}
                        disabled={reportLoading || reportSaving}
                      >
                        Cancelar edição
                      </button>
                    </>
                  )}
                </div>

                {!isEditing && !isExportAvailable ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    O PDF só fica disponível depois de validar o relatório final.
                  </div>
                ) : null}

                {isEditing && report?.status === "READY" ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    Guardar alterações retira a validação atual e exige nova validação antes do PDF.
                  </div>
                ) : null}

                {validationIssues.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
                    <p className="font-semibold">Pendências atuais</p>
                    <ul className="mt-2 space-y-2">
                      {validationIssues.map((issue) => (
                        <li key={issue}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard title="Resumo operacional" eyebrow="Metadados">
                <div className="space-y-3">
                  {quickFacts.map((fact) => (
                    <div key={fact.label} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{fact.label}</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{fact.value || "—"}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
