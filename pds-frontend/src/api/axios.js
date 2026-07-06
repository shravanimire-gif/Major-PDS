import axios from "axios";

const TOKEN_KEY = "pds_token";
const LOGIN_PATH = "/login";
const DEFAULT_LOCAL_API_PORT = "5055";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const normalizeBaseURL = (url) => {
  const trimmedUrl = url?.trim();

  if (!trimmedUrl) {
    return "";
  }

  return trimmedUrl.replace(/\/+$/, "");
};

const resolveBaseURL = () => {
  const envBaseURL = normalizeBaseURL(import.meta.env.VITE_API_BASE_URL);

  if (envBaseURL) {
    return envBaseURL;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const { hostname, protocol } = window.location;

  if (LOCAL_HOSTNAMES.has(hostname)) {
    return `${protocol}//${hostname}:${DEFAULT_LOCAL_API_PORT}`;
  }

  return "";
};

const baseURL = resolveBaseURL();

const api = axios.create(baseURL ? { baseURL } : {});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("pds:unauthorized"));

      if (window.location.pathname !== LOGIN_PATH) {
        window.location.href = LOGIN_PATH;
      }
    }

    return Promise.reject(error);
  },
);

export const resolvedApiBaseUrl = baseURL;

export default api;
