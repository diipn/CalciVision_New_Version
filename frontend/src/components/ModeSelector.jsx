import React from "react";

const modeOptions = [
  {
    value: "manual",
    label: "Anotação Manual",
    description: "Delimite a válvula manualmente.",
  },
  {
    value: "ia",
    label: "Anotação por IA",
    description: "A IA propõe a delimitação; pode ajustar se necessário.",
  },
];

export default function ModeSelector({ mode, onChange, disabled }) {
  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border border-green-pale bg-white p-1">
        {modeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
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
      <p className="text-sm text-gray-600">
        {modeOptions.find((option) => option.value === mode)?.description}
      </p>
    </div>
  );
}
