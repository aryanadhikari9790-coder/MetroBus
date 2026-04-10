import { getToken } from "../auth";

export function getWsBaseUrl() {
  if (import.meta.env.VITE_WS_BASE_URL) {
    return import.meta.env.VITE_WS_BASE_URL.replace(/\/+$/, "");
  }

  const browserHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
  const browserProtocol =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
  return `${browserProtocol}://${browserHost}:8000`;
}

export function buildWsUrl(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${getWsBaseUrl()}${normalizedPath}`);

  const token = options.token === undefined ? getToken() : options.token;
  if (token) {
    url.searchParams.set("token", token);
  }

  Object.entries(options.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}
