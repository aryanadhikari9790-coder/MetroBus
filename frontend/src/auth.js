const ACCESS_KEY = "metrobus_access_token";
const REFRESH_KEY = "metrobus_refresh_token";
const LEGACY_ACCESS_KEY = "metrobys_access_token";

export function setToken(token) {
  if (token) {
    localStorage.setItem(ACCESS_KEY, token);
  }
}

export function getToken() {
  return localStorage.getItem(ACCESS_KEY) || localStorage.getItem(LEGACY_ACCESS_KEY);
}

export function setRefreshToken(token) {
  if (token) {
    localStorage.setItem(REFRESH_KEY, token);
  }
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ access, refresh }) {
  if (access) setToken(access);
  if (refresh) setRefreshToken(refresh);
}

export function clearToken() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(LEGACY_ACCESS_KEY);
}

export function hasStoredSession() {
  return Boolean(getToken() || getRefreshToken());
}
