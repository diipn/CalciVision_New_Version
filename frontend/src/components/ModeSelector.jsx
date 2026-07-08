import React from "react";

const modeOptions = [
  {
    value: "ia",
    label: "Anotação por IA",
    description: "A IA propõe a delimitação; pode ajustar se necessário.",
  },
  {
    value: "manual",
    label: "Anotação Manual",
    description: "Delimite a válvula manualmente.",
  },
];

export default function ModeSelector({ mode, onChange, disabled, showDescription = true }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-green-pale bg-white p-1">
        {modeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`min-w-0 rounded-md px-4 py-2.5 text-[13px] font-semibold leading-none whitespace-nowrap transition ${
              mode === option.value
                ? "bg-green-dark text-white"
                : "text-green-dark hover:bg-green-50"
            }`}
            onClick={() => onChange(option.value)}
            disabled={disabled}
          >
            {option.label}
          </button>
        ))}
      </div>
      {showDescription && (
        <p className="text-sm text-gray-600">
          {modeOptions.find((option) => option.value === mode)?.description}
        </p>
      )}
    </div>
  );
}
