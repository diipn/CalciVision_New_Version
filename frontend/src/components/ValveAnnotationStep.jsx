import React from "react";

export default function ValveAnnotationStep({
  mode,
  isAnnotationReady,
  hasPrediction,
  onManualStart,
  onManualCancel,
  onDetectIA,
  onAdjustManual,
  onResetIA,
  onClear,
  onConfirm,
  statusMessage,
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-green-dark">Anotar/Confirmar válvula</h3>
        <p className="text-sm text-gray-600">
          {mode === "manual"
            ? "Delimite a válvula manualmente e confirme a anotação."
            : "A IA propõe a delimitação; confirme ou ajuste manualmente."}
        </p>
      </div>

      <div className="rounded-lg border border-green-pale bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {mode === "manual" ? (
            <>
              <button
                type="button"
                className="rounded-md border border-green-pale px-3 py-2 text-sm text-green-dark"
                onClick={onManualStart}
              >
                Iniciar anotação manual
              </button>
              <button
                type="button"
                className="rounded-md border border-green-pale px-3 py-2 text-sm text-green-dark"
                onClick={onManualCancel}
              >
                Cancelar desenho
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rounded-md bg-green-dark px-3 py-2 text-sm font-semibold text-white"
                onClick={onDetectIA}
              >
                Detetar válvula (IA)
              </button>
              <button
                type="button"
                className="rounded-md border border-green-pale px-3 py-2 text-sm text-green-dark"
                onClick={onAdjustManual}
              >
                Ajustar manualmente
              </button>
              {hasPrediction && (
                <button
                  type="button"
                  className="rounded-md border border-green-pale px-3 py-2 text-sm text-green-dark"
                  onClick={onResetIA}
                >
                  Repor proposta IA
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-dark"
            onClick={onClear}
          >
            Limpar anotação
          </button>
        </div>
        {statusMessage && (
          <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
            {statusMessage}
          </div>
        )}
      </div>

      <button
        type="button"
        className="w-full rounded-md bg-green-dark px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onConfirm}
        disabled={!isAnnotationReady}
      >
        Concluir anotação
      </button>
    </div>
  );
}
