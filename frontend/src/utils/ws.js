export const buildWsUrl = (path) => {
  const apiUrl = import.meta.env.VITE_API_URL || "";
  const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || "";
  let base = apiUrl || wsUrl || "";

  if (!base) return "";

  base = base.replace(/\/+$/, "");

  if (base.startsWith("http://")) {
    base = `ws://${base.slice(7)}`;
  } else if (base.startsWith("https://")) {
    base = `wss://${base.slice(8)}`;
  } else if (!base.startsWith("ws://") && !base.startsWith("wss://")) {
    base = `ws://${base}`;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

export const buildModelWsUrl = (taskId) => buildWsUrl(`/ws/model/${taskId}/`);
