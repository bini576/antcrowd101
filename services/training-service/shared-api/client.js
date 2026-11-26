import axios from "axios";
import { clearSession } from "@shared-session/session";

function resolveTrainingApiBase() {
  if (window.location.pathname.startsWith("/workspace/training/")) {
    return "/api/training";
  }
  return "http://localhost:8100";
}

function resolveTrainingLoginPath() {
  if (window.location.pathname.startsWith("/workspace/training/org")) {
    return "/workspace/training/org/login";
  }
  if (window.location.pathname.startsWith("/workspace/training/researcher")) {
    return "/workspace/training/researcher/login";
  }
  return "/login";
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || resolveTrainingApiBase()
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearSession();
      const loginPath = resolveTrainingLoginPath();
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
