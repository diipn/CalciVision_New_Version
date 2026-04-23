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
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-green-dark">Deteção da válvula</h3>
        <p className="text-xs text-gray-600">
          {mode === "manual"
            ? "Delimite a válvula manualmente. Use “Definir válvula” para desenhar a região."
            : "Detete automaticamente a válvula e confirme o resultado."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {mode === "manual" ? (
          <>
            <button
              type="button"
              className={`rounded-md px-4 py-2.5 text-[13px] font-semibold leading-none whitespace-nowrap ${
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
              className="rounded-md border border-green-pale px-4 py-2.5 text-[13px] leading-none whitespace-nowrap text-green-dark"
              onClick={onClearManual}
            >
              Limpar anotação
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`rounded-md px-4 py-2.5 text-[13px] font-semibold leading-none whitespace-nowrap ${
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
              className="rounded-md border border-green-pale px-4 py-2.5 text-[13px] leading-none whitespace-nowrap text-green-dark"
              onClick={onResetIA}
            >
              Repor
            </button>
          </>
        )}
      </div>

      <div
        className={`rounded-md border px-3 py-2 text-xs ${
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
