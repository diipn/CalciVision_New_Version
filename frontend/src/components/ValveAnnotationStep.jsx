import React from "react";

export default function ValveAnnotationStep({
  mode,
  isManualActive,
  isAiActive,
  annotationReady,
  annotatedFramesCount,
  onManualDefine,
  onClearManual,
  onDetectIA,
  onResetIA,
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-green-dark">Anotar válvula</h3>
        <p className="text-sm text-gray-600">
          {mode === "manual"
            ? "Delimite a válvula manualmente. Use “Definir válvula” para desenhar a região."
            : "Detete automaticamente a válvula e confirme o resultado."}
        </p>
      </div>

      <div className="rounded-lg border border-green-pale bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {mode === "manual" ? (
            <>
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  isManualActive
                    ? "border border-green-dark bg-green-dark text-white"
                    : "border border-green-pale text-green-dark"
                }`}
                onClick={onManualDefine}
              >
                Definir válvula
              </button>
              <button
                type="button"
                className="rounded-md border border-green-pale px-3 py-2 text-sm text-green-dark"
                onClick={onClearManual}
              >
                Limpar anotação
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  isAiActive
                    ? "border border-green-dark bg-green-dark text-white"
                    : "border border-green-pale text-green-dark"
                }`}
                onClick={onDetectIA}
              >
                Detetar válvula
              </button>
              <button
                type="button"
                className="rounded-md border border-green-pale px-3 py-2 text-sm text-green-dark"
                onClick={onResetIA}
              >
                Repor
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className={`rounded-md border px-3 py-2 text-sm ${
          annotationReady
            ? "border-green-pale bg-green-50 text-green-900"
            : "border-gray-200 bg-gray-50 text-gray-600"
        }`}
      >
        {annotationReady
          ? `${annotatedFramesCount} frame(s) com válvula delimitada neste exame.`
          : mode === "manual"
          ? "Ainda não existe uma delimitação. Desenhe a região da válvula para continuar."
          : "Ainda não existe uma delimitação. Use a IA para propor a região da válvula."}
      </div>
    </div>
  );
}
