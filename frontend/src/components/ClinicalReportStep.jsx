import React from "react";

export default function ClinicalReportStep({
  notes,
  onGenerate,
  onNotesChange,
  onSaveDraft,
  onExport,
  onSubmit,
  canGenerate,
  canSubmit,
  notesDirty,
  reportReady,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-pale bg-white p-4 text-center">
        <h3 className="text-base font-semibold text-green-dark">Gerar relatório</h3>
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

      <div className="rounded-lg border border-green-pale bg-white p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Observações clínicas</h4>
          <span className="text-xs text-gray-500">Opcional</span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Campo para acrescentar notas que não estão no template (ex.: contexto, limitações da janela acústica).
        </p>
        <textarea
          className="mt-3 min-h-[120px] w-full rounded-md border border-green-pale bg-white p-3 text-sm"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Escreva observações clínicas adicionais..."
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-green-pale px-4 py-2 text-sm font-semibold text-green-dark"
            onClick={onSaveDraft}
          >
            Guardar rascunho
          </button>
          {notesDirty && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800">
              <span className="h-2 w-2 rounded-full bg-orange-400" aria-hidden="true" />
              Alterações por guardar
            </span>
          )}
        </div>
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
            Submeter
          </button>
        </div>
      </div>
    </div>
  );
}
