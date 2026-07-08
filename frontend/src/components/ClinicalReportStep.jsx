import { Link } from "react-router-dom";
import { getClinicalReportPresentation } from "../utils/clinicalReportPresentation";

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
    <section className={`report-section rounded-lg border border-green-pale bg-white p-5 shadow-sm ${className}`}>
      <div className="report-section-heading">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-dark">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="mt-2 text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function KeyValueGrid({ items = [] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
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
        <div key={`${item.label}-${item.value}`} className="rounded-md border border-green-pale bg-green-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">{item.label}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-green-900">{item.value || "—"}</p>
        </div>
      ))}
    </div>
  );
}

function FindingsList({ items = [] }) {
  return (
    <div className="divide-y divide-gray-100 border-y border-gray-100">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="px-1 py-4">
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
      <div className="overflow-hidden rounded-md border border-gray-100">
        <table className="w-full table-fixed border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-[27%] break-words px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Métrica
              </th>
              <th className="w-[13%] break-words px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Valor
              </th>
              <th className="w-[15%] break-words px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Unidade
              </th>
              <th className="w-[45%] break-words px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
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
    <div className="overflow-hidden rounded-md border border-gray-100">
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
      </div>
    </div>
  );
}

function ReadOnlyTextBlock({ label, value }) {
  const lines = String(value || "—").split("\n").filter(Boolean);

  return (
    <div className="border-l-2 border-green-pale bg-gray-50 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
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
        className="mt-2 min-h-[120px] w-full rounded-md border border-green-pale bg-white px-4 py-3 text-sm leading-7 text-gray-900 outline-none transition focus:border-green-dark"
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
  clinicalNotes,
  clinicalConclusion,
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
  const presentation = getClinicalReportPresentation(report, {
    clinicalNotes,
    clinicalConclusion,
  });
  const identification = presentation.identification;
  const summary = presentation.summary;
  const findings = presentation.findings;
  const metrics = presentation.metrics;
  const validation = presentation.validation;
  const conclusion = presentation.conclusion;
  const validationIssues = report?.validation_issues || [];

  const identificationItems = identification.items || [];
  const highlightedResults = [
    { label: "Resultado da IA", value: summary.ai_result || "—" },
    { label: "Calcificação", value: summary.calcification_presence || "—" },
    { label: "Classificação", value: summary.classification || "—" },
    { label: "Risco estimado", value: summary.risk || "—" },
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
      <section className="overflow-hidden rounded-lg border border-green-pale bg-white shadow-sm">
        <div className="bg-green-50 px-6 py-5 md:px-8">
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

            <div className="flex flex-col items-start gap-3 border-l border-green-pale pl-5">
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
        <div className={showActions ? "grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_340px]" : "space-y-5"}>
          <div className="space-y-5">
            <SectionCard title="Identificação do paciente" eyebrow="Secção 1">
              <KeyValueGrid items={identificationItems} />
            </SectionCard>

            <SectionCard title="Resultado da análise" eyebrow="Secção 2">
              <div className="space-y-5">
                <SummaryCards items={highlightedResults} />
                <div className="border-l-2 border-green-pale bg-green-50 px-4 py-3 text-sm leading-7 text-green-900">
                  {summary.context_note ||
                    "Resultado automático assistido por inteligência artificial, sujeito a interpretação clínica e validação do profissional responsável."}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Avaliação da válvula aórtica" eyebrow="Secção 3">
              <FindingsList items={findings.items || []} />
            </SectionCard>

            <SectionCard title="Métricas" eyebrow="Secção 4">
              <MetricsTable rows={metrics.rows || []} isPrintMode={isPrintMode} />
            </SectionCard>

            <SectionCard title="Validação clínica" eyebrow="Secção 5">
              <div className="space-y-4">
                <ReadOnlyTextBlock
                  label="Estado de validação"
                  value={validation.status || "Pendente de validação"}
                />

                {isEditing ? (
                  <ManualTextarea
                    label="Observações do profissional"
                    value={clinicalNotes}
                    onChange={onNotesChange}
                    placeholder="Registe observações clínicas adicionais relevantes."
                    rows={4}
                  />
                ) : (
                  <ReadOnlyTextBlock
                    label="Observações do profissional"
                    value={validation.professional_notes}
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard title="Conclusão clínica" eyebrow="Secção 6">
              <div>
                {isEditing ? (
                  <ManualTextarea
                    label="Conclusão clínica final"
                    value={clinicalConclusion}
                    onChange={onConclusionChange}
                    placeholder="Redija a conclusão clínica final com linguagem clara, profissional e pronta para arquivo."
                    rows={5}
                  />
                ) : (
                  <ReadOnlyTextBlock
                    label="Conclusão clínica final"
                    value={conclusion.final_text}
                  />
                )}
              </div>
            </SectionCard>
          </div>

          {showActions ? (
            <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
              <SectionCard title="Ações do relatório" eyebrow="Painel lateral">
                <div className="space-y-3">
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        className="h-11 w-full rounded-md bg-green-dark px-4 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={onStartEditing}
                        disabled={reportLoading || reportSaving}
                      >
                        Editar relatório
                      </button>
                      <button
                        type="button"
                        className="h-11 w-full rounded-md bg-green px-4 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={onFinalize}
                        disabled={!canFinalize || reportLoading || reportSaving}
                      >
                        {report?.status === "READY" ? "Relatório validado" : submitLabel}
                      </button>
                      {isExportAvailable ? (
                        <button
                          type="button"
                          className="h-11 w-full rounded-md border border-green-pale px-4 text-sm font-semibold text-green-dark"
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
                        className="h-11 w-full rounded-md bg-green-dark px-4 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={onSaveChanges}
                        disabled={!hasUnsavedChanges || reportLoading || reportSaving}
                      >
                        Guardar alterações
                      </button>
                      <button
                        type="button"
                        className="h-11 w-full rounded-md border border-gray-200 px-4 text-sm font-semibold text-gray-700 disabled:opacity-50"
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
                    <div key={fact.label} className="border-b border-gray-100 px-1 py-3 last:border-b-0">
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
