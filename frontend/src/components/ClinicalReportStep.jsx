import React from "react";

export default function ClinicalReportStep({
  notes,
  onGenerate,
  onNotesChange,
  onExport,
  onSubmit,
  canGenerate,
  canSubmit,
  reportReady,
  submitLabel = "Submeter",
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-pale bg-white p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Observações clínicas</h4>
          <span className="text-xs text-gray-500">Opcional</span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Campo para acrescentar notas que não estão no template (ex.: contexto, limitações da janela acústica).
        </p>
        <p className="mt-1 text-xs text-green-dark">
          As observações ficam associadas automaticamente a este exame.
        </p>
        <textarea
          className="mt-3 min-h-[120px] w-full rounded-md border border-green-pale bg-white p-3 text-sm"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Escreva observações clínicas adicionais..."
        />
      </div>

      <div className="rounded-lg border border-green-pale bg-white p-4 text-center">
        <h3 className="text-base font-semibold text-green-dark">Gerar relatório clínico</h3>
        <p className="mt-1 text-sm text-gray-600">
          Gere automaticamente o relatório clínico a partir da análise.
        </p>
        <button
          type="button"
          className="mt-3 w-full rounded-md bg-green-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          Gerar relatório
        </button>
      </div>

      {!reportReady && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Ainda não existe um relatório gerado para este exame.
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-3">
          <button
            type="button"
            className="w-full rounded-md border border-green-pale px-4 py-2 text-sm font-semibold text-green-dark disabled:opacity-50"
            onClick={onExport}
            disabled={!reportReady}
          >
            Exportar PDF
          </button>
          <button
            type="button"
            className="w-full rounded-md bg-green-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
