import React from "react";

export default function ImageToolsPanel({
  imageSettings,
  onChange,
  onReset,
  autoEnhanceEnabled,
  onAutoEnhanceToggle,
}) {
  const brightness = imageSettings?.brightness ?? 1;
  const contrast = imageSettings?.contrast ?? 1;
  const blur = imageSettings?.blur ?? 0;
  const zoom = imageSettings?.zoom ?? 1;

  const handleChange = (key, value) => {
    onChange({
      ...(imageSettings || {}),
      [key]: value,
    });
  };

  return (
    <div className="rounded-lg border border-green-pale bg-green-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-green-dark">Ferramentas de imagem</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              autoEnhanceEnabled
                ? "border-green-dark bg-green-dark text-white"
                : "border-green-pale text-green-dark"
            }`}
            onClick={() => onAutoEnhanceToggle?.(!autoEnhanceEnabled)}
            title="Aplica um preset automático de melhoria da imagem."
          >
            Melhoramento automático
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-green-dark underline"
            onClick={onReset}
            title="Útil em janelas acústicas difíceis."
          >
            Repor valores
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Luminosidade ({brightness.toFixed(2)})</span>
          <input
            type="range"
            min="0.7"
            max="1.6"
            step="0.05"
            value={brightness}
            onChange={(event) => handleChange("brightness", Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Contraste ({contrast.toFixed(2)})</span>
          <input
            type="range"
            min="0.7"
            max="1.6"
            step="0.05"
            value={contrast}
            onChange={(event) => handleChange("contrast", Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Redução de ruído ({blur.toFixed(1)}px)</span>
          <input
            type="range"
            min="0"
            max="4"
            step="0.2"
            value={blur}
            onChange={(event) => handleChange("blur", Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Zoom ({zoom.toFixed(2)}x)</span>
          <input
            type="range"
            min="0.6"
            max="2.4"
            step="0.05"
            value={zoom}
            onChange={(event) => handleChange("zoom", Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
