import React, { useState } from "react";

export default function CalcificationAssessmentStep({
  voValue,
  voSuggestion,
  voEditable,
  voOverrideValue,
  onToggleVoOverride,
  onVoOverrideChange,
  isVoOverrideActive,
  classificationChoice,
  onClassificationChange,
  isValidated,
  onValidate,
  onEditValidation,
  showManualBadge,
}) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-green-dark">Avaliar calcificação</h3>
        <p className="text-sm text-gray-600">
          Confirme a avaliação clínica com base na VO e escolha a classificação final.
        </p>
      </div>

      <div className="rounded-lg border border-green-pale bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Variável Objectiva (VO)</span>
            <button
              type="button"
              className="text-green-dark"
              aria-label="Informação sobre a VO"
              onClick={() => setShowInfo((prev) => !prev)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          </div>
          {showManualBadge && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
              Ajuste manual
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-4xl font-semibold text-gray-900">
            {voValue !== null ? `${voValue.toFixed(0)}` : "N/A"}
          </span>
          <span className="text-sm text-gray-600">/ 100</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-green-dark transition-all"
            style={{ width: voValue !== null ? `${Math.min(100, Math.max(0, voValue))}%` : "0%" }}
          />
        </div>
        {voSuggestion && (
          <div className="mt-2 text-sm text-gray-700">
            <span className="font-semibold">Sugestão:</span> {voSuggestion}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isVoOverrideActive}
              onChange={(event) => onToggleVoOverride(event.target.checked)}
            />
            Ajustar VO manualmente
          </label>
          {isVoOverrideActive && (
            <input
              type="number"
              min={0}
              max={100}
              value={voOverrideValue}
              onChange={(event) => onVoOverrideChange(event.target.value)}
              className="w-full rounded-md border border-green-pale px-3 py-2 text-sm"
              aria-label="Valor da VO manual"
              disabled={!voEditable}
            />
          )}
          {!voEditable && (
            <p className="text-xs text-gray-500">A avaliação está validada. Para editar, altere a validação.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-green-pale bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-800">Classificação da calcificação</h4>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[true, false].map((option) => (
            <button
              key={option ? "calcificada" : "nao-calcificada"}
              type="button"
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                classificationChoice === option
                  ? "border-green-dark bg-green-dark text-white"
                  : "border-green-pale text-green-dark"
              }`}
              onClick={() => onClassificationChange(option)}
              disabled={!voEditable}
            >
              {option ? "Calcificada" : "Não calcificada"}
            </button>
          ))}
        </div>
      </div>

      {!isValidated ? (
        <button
          type="button"
          className="w-full rounded-md bg-green-dark px-4 py-2 text-sm font-semibold text-white"
          onClick={onValidate}
          disabled={classificationChoice === null}
        >
          Validar avaliação clínica
        </button>
      ) : (
        <div className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
          <span className="font-semibold">Avaliação clínica validada.</span>
          <button
            type="button"
            className="text-sm font-semibold text-green-dark underline"
            onClick={onEditValidation}
          >
            Alterar avaliação
          </button>
        </div>
      )}

      {showInfo && (
        <div className="rounded-md border border-green-pale bg-green-50 p-3 text-sm text-green-900">
          A VO é um indicador de 0 a 100 calculado a partir da imagem. É um apoio à decisão e não
          substitui a validação clínica.
        </div>
      )}
    </div>
  );
}
