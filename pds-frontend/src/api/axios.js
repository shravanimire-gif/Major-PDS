import axios from "axios";

const TOKEN_KEY = "pds_token";
const LOGIN_PATH = "/login";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

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

export default api;
