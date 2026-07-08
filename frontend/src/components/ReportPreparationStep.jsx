export default function ReportPreparationStep({
  report,
  reportLoading,
  reportError,
  clinicalNotes,
  onNotesChange,
  onGenerate,
}) {
  const statusLabel =
    report?.status === "READY"
      ? "Relatório validado"
      : report
      ? "Relatório gerado"
      : "Relatório ainda não gerado";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-green-pale bg-white p-5 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-dark">
            Passo 3
          </p>
          <h2 className="mt-2 text-xl font-semibold text-gray-900">
            Relatório clínico
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Adiciona observações clínicas antes de gerar o relatório.
          </p>
          <p className="mt-3 text-sm font-medium text-gray-500">{statusLabel}</p>
        </div>

        <div className="mt-5 rounded-xl border border-green-pale bg-green-light/25 p-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Observações clínicas</h3>
            <p className="mt-1 text-sm text-gray-600">
              Regista contexto clínico, limitações da imagem ou notas médicas relevantes
              para incluir no relatório final.
            </p>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Observações
            </span>
            <textarea
              className="min-h-[180px] w-full rounded-xl border border-green-pale bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-green-dark"
              value={clinicalNotes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Registe contexto clínico, limitações da imagem, validação médica e notas relevantes para o relatório."
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-4">
          <button
            type="button"
            className="rounded-xl bg-green-dark px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            onClick={onGenerate}
            disabled={reportLoading}
          >
            Gerar relatório
          </button>
        </div>

        {reportError ? (
          <div className="mt-4 rounded-lg border border-red/30 bg-red/5 px-4 py-3 text-sm text-red">
            {reportError}
          </div>
        ) : null}
      </section>
    </div>
  );
}
