import axios from "axios";
import { getToken } from "./auth";

const browserHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
const browserProtocol =
  typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || `${browserProtocol}://${browserHost}:8000`;

export const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
