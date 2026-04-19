import axios from "axios";
import { clearToken, getRefreshToken, getToken, setTokens } from "./auth";
import { notifyGlobal } from "./NotificationContext";

const browserHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
const browserProtocol =
  typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || `${browserProtocol}://${browserHost}:8000`;

export const api = axios.create({
  baseURL: apiBaseUrl,
});

let refreshPromise = null;

function isAuthRefreshRequest(config) {
  const url = String(config?.url || "");
  return url.includes("/api/auth/refresh/");
}

function isTokenInvalidError(error) {
  const detail = error?.response?.data?.detail;
  const code = error?.response?.data?.code;
  const messages = error?.response?.data?.messages;
  return (
    code === "token_not_valid"
    || detail === "Given token not valid for any token type"
    || (Array.isArray(messages) && messages.some((item) => item?.token_type === "access"))
  );
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearToken();
    throw new Error("No refresh token available.");
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${apiBaseUrl}/api/auth/refresh/`, { refresh })
      .then((response) => {
        const nextAccess = response.data?.access;
        const nextRefresh = response.data?.refresh || refresh;
        if (!nextAccess) {
          throw new Error("Refresh response did not include an access token.");
        }
        setTokens({ access: nextAccess, refresh: nextRefresh });
        return nextAccess;
      })
      .catch((error) => {
        clearToken();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (isAuthRefreshRequest(originalRequest)) {
      clearToken();
      return Promise.reject(error);
    }

    if (
      error?.response?.status === 401
      && isTokenInvalidError(error)
      && !originalRequest._retry
      && getRefreshToken()
    ) {
      originalRequest._retry = true;
      try {
        const nextAccess = await refreshAccessToken();
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          Authorization: `Bearer ${nextAccess}`,
        };
        return api.request(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    if (error?.response?.status === 401 && isTokenInvalidError(error)) {
      clearToken();
    }

    const msg = error?.response?.data?.detail 
      || error?.response?.data?.message 
      || error?.message 
      || "An unexpected error occurred.";
    
    if (error?.response?.status !== 401) {
      notifyGlobal(msg, "error");
    }

    return Promise.reject(error);
  },
);
