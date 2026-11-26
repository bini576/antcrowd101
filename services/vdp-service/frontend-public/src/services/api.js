import axios from "axios";

const api = axios.create({
  baseURL: "/api/vdp",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function getPublicVDP(organizationSlug) {
  const { data } = await api.get(`/public/security/${organizationSlug}`);
  return data;
}

export async function submitVulnerabilityReport(payload) {
  const { data } = await api.post("/public/reports", payload);
  return data;
}

export default api;
