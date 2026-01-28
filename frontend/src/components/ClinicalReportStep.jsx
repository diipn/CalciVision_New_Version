import React from "react";
import UnsavedChangesIndicator from "./UnsavedChangesIndicator";

export default function ClinicalReportStep({
  reportText,
  notes,
  onGenerate,
  onReportChange,
  onNotesChange,
  onSaveDraft,
  onExport,
  onSubmit,
  canGenerate,
  canSubmit,
  readyToSubmit,
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-green-dark">Relatório clínico</h3>
        <p className="text-sm text-gray-600">
          Gere o relatório, adicione observações clínicas e finalize a submissão.
        </p>
      </div>

      <div className="rounded-lg border border-green-pale bg-white p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Template do relatório</h4>
          <button
            type="button"
            className="text-sm font-semibold text-green-dark underline disabled:opacity-50"
            onClick={onGenerate}
            disabled={!canGenerate}
          >
            Gerar relatório
          </button>
        </div>
        <textarea
          className="mt-3 min-h-[160px] w-full rounded-md border border-green-pale bg-white p-3 text-sm"
          value={reportText}
          onChange={(event) => onReportChange(event.target.value)}
          placeholder="Clique em 'Gerar relatório' para preencher o template."
          disabled={!canGenerate}
        />
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
          <UnsavedChangesIndicator />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-md border border-green-pale px-4 py-2 text-sm font-semibold text-green-dark disabled:opacity-50"
            onClick={onExport}
            disabled={!reportText}
          >
            Exportar PDF
          </button>
          <button
            type="button"
            className="rounded-md bg-green-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            Submeter
          </button>
        </div>
        {readyToSubmit && (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
            Pronto para submeter.
          </div>
        )}
      </div>
    </div>
  );
}
