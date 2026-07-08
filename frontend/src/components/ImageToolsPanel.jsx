import React, { useMemo, useState } from "react";

function ToolIcon({ active = false, children }) {
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full border ${
        active
          ? "border-green-dark bg-green-dark text-white"
          : "border-green-pale bg-white text-green-dark"
      }`}
    >
      {children}
    </span>
  );
}

function TuneSvg() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M4 7h8" />
      <path d="M16 7h4" />
      <circle cx="14" cy="7" r="2" />
      <path d="M4 17h4" />
      <path d="M12 17h8" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

function SunSvg() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </svg>
  );
}

function ContrastSvg() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5v14" />
    </svg>
  );
}

function NoiseSvg() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M5 9h2" />
      <path d="M10 9h2" />
      <path d="M15 9h4" />
      <path d="M5 15h4" />
      <path d="M12 15h2" />
      <path d="M17 15h2" />
    </svg>
  );
}

function ZoomSvg() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

function ResetSvg() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M20 9a8 8 0 0 0-13.66-3.66L4 7" />
      <path d="M4 15a8 8 0 0 0 13.66 3.66L20 17" />
    </svg>
  );
}

const isAdjustedValue = (value, defaultValue) => Math.abs(value - defaultValue) > 0.001;

export default function ImageToolsPanel({
  imageSettings,
  onChange,
  onReset,
  autoEnhanceEnabled,
  autoEnhanceLoading = false,
  onAutoEnhanceApply,
  collapsible = false,
  variant = "panel",
}) {
  const brightness = imageSettings?.brightness ?? 1;
  const contrast = imageSettings?.contrast ?? 1;
  const blur = imageSettings?.blur ?? 0;
  const zoom = imageSettings?.zoom ?? 1;
  const isFrameDock = variant === "frame-dock";
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTool, setActiveTool] = useState("brightness");

  const handleChange = (key, value) => {
    onChange({
      ...(imageSettings || {}),
      [key]: value,
    });
  };

  const toolDefinitions = useMemo(
    () => [
      {
        key: "brightness",
        label: "Brilho",
        description: "Aumente ou reduza a luminosidade da imagem.",
        value: brightness,
        min: 0.7,
        max: 1.6,
        step: 0.05,
        defaultValue: 1,
        format: (value) => value.toFixed(2),
        Icon: SunSvg,
      },
      {
        key: "contrast",
        label: "Contraste",
        description: "Realce a separação entre áreas claras e escuras.",
        value: contrast,
        min: 0.7,
        max: 1.6,
        step: 0.05,
        defaultValue: 1,
        format: (value) => value.toFixed(2),
        Icon: ContrastSvg,
      },
      {
        key: "blur",
        label: "Ruído",
        description: "Suavize artefactos e granulação da imagem.",
        value: blur,
        min: 0,
        max: 4,
        step: 0.2,
        defaultValue: 0,
        format: (value) => `${value.toFixed(1)} px`,
        Icon: NoiseSvg,
      },
      {
        key: "zoom",
        label: "Zoom",
        description: "Aproxime ou afaste a área atualmente visível.",
        value: zoom,
        min: 0.6,
        max: 2.4,
        step: 0.05,
        defaultValue: 1,
        format: (value) => `${value.toFixed(2)}x`,
        Icon: ZoomSvg,
      },
    ],
    [brightness, contrast, blur, zoom]
  );

  const activeToolDefinition =
    toolDefinitions.find((tool) => tool.key === activeTool) || toolDefinitions[0];

  const allSliders = (
    <div className="grid gap-3">
      {toolDefinitions.map((tool) => (
        <label key={tool.key} className="flex flex-col gap-2 text-sm">
          <span className="font-medium">
            {tool.label} ({tool.format(tool.value)})
          </span>
          <input
            type="range"
            min={tool.min}
            max={tool.max}
            step={tool.step}
            value={tool.value}
            onChange={(event) => handleChange(tool.key, Number(event.target.value))}
            className="accent-green-dark"
          />
        </label>
      ))}
    </div>
  );

  if (isFrameDock) {
    return (
      <div className="overflow-hidden rounded-xl border border-green-pale bg-white shadow-sm">
        {isExpanded && (
          <div className="border-b border-green-pale bg-green-50/40 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ToolIcon active>
                  <activeToolDefinition.Icon />
                </ToolIcon>
                <div>
                  <h3 className="text-sm font-semibold text-green-dark">
                    {activeToolDefinition.label}
                  </h3>
                  <p className="mt-1 text-xs text-gray-600">
                    {activeToolDefinition.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-dark">
                  {activeToolDefinition.format(activeToolDefinition.value)}
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-green-dark underline"
                  onClick={() => setIsExpanded(false)}
                >
                  Fechar ajustes
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <input
                type="range"
                min={activeToolDefinition.min}
                max={activeToolDefinition.max}
                step={activeToolDefinition.step}
                value={activeToolDefinition.value}
                onChange={(event) =>
                  handleChange(activeToolDefinition.key, Number(event.target.value))
                }
                className="w-full accent-green-dark"
              />
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>Menos</span>
                <span>Mais</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Ferramentas de imagem</p>
            <p className="mt-1 text-xs text-gray-600">
              {isExpanded
                ? "Selecione um parâmetro e ajuste-o diretamente com o slider."
                : autoEnhanceEnabled
                ? "Otimização automática aplicada ao ajuste atual."
                : "Escolha a ferramenta que quer ajustar sem sair da imagem."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold whitespace-nowrap transition disabled:cursor-wait disabled:opacity-60 ${
                autoEnhanceEnabled
                  ? "border-green-dark bg-green-dark text-white"
                  : "border-green-pale bg-white text-green-dark hover:bg-green-50"
              }`}
              onClick={() => onAutoEnhanceApply?.()}
              title="Analisa o frame atual e aplica uma otimização automática"
              disabled={autoEnhanceLoading}
            >
              <ToolIcon active={autoEnhanceEnabled}>
                <TuneSvg />
              </ToolIcon>
              {autoEnhanceLoading ? "A otimizar..." : "Auto-otimizar"}
            </button>

            {toolDefinitions.map((tool) => {
              const isActive = isExpanded && activeTool === tool.key;
              const isAdjusted = isAdjustedValue(tool.value, tool.defaultValue);
              const buttonTone = isActive
                ? "border-green-dark bg-green-dark text-white"
                : isAdjusted
                ? "border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100"
                : "border-green-pale bg-white text-green-dark hover:bg-green-50";

              return (
                <button
                  key={tool.key}
                  type="button"
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold whitespace-nowrap transition ${buttonTone}`}
                  onClick={() => {
                    setActiveTool(tool.key);
                    setIsExpanded((prev) => (tool.key === activeTool ? !prev : true));
                  }}
                  title={`Ajustar ${tool.label.toLowerCase()}`}
                >
                  <ToolIcon active={isActive}>
                    <tool.Icon />
                  </ToolIcon>
                  {tool.label}
                </button>
              );
            })}

            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-green-pale bg-white px-3 py-2 text-xs font-semibold whitespace-nowrap text-green-dark hover:bg-green-50"
              onClick={() => {
                onReset();
                setIsExpanded(false);
              }}
              title="Repor valores"
            >
              <ToolIcon>
                <ResetSvg />
              </ToolIcon>
              Repor
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (collapsible) {
    return (
      <div className="rounded-lg border border-green-pale bg-green-50/40">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-4 p-4 text-left"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div>
            <h3 className="text-sm font-semibold text-green-dark">Ferramentas de imagem</h3>
            <p className="mt-1 text-xs text-gray-600">
              Abra apenas quando precisar de melhorar a visualização.
            </p>
          </div>
          <span className="text-xs font-semibold text-green-dark">
            {isExpanded ? "Ocultar" : "Abrir"}
          </span>
        </button>

        {isExpanded && (
          <div className="border-t border-green-pale px-4 pb-4 pt-3">
            {allSliders}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green-pale bg-green-50/40 p-4">
      <h3 className="text-sm font-semibold text-green-dark">Ferramentas de imagem</h3>
      <div className="mt-4">{allSliders}</div>
    </div>
  );
}
