import axios from "axios";

const api = axios.create({
  baseURL: "/api/vdp",
});

function resolveVdpLoginPath() {
  if (window.location.pathname.startsWith("/workspace/vdp/org")) {
    return "/workspace/vdp/org/login";
  }
  return "/login";
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "organization") return "organization_admin";
  if (value === "admin") return "platform_admin";
  return value;
}

function persistUser(user) {
  if (!user) {
    localStorage.removeItem("vdp_auth_user");
    return;
  }
  localStorage.setItem(
    "vdp_auth_user",
    JSON.stringify({
      ...user,
      role: normalizeRole(user.role),
    })
  );
}

export function clearSession() {
  sessionStorage.removeItem("jwt");
  sessionStorage.removeItem("vdp_role");
  sessionStorage.removeItem("vdp_org_id");
  localStorage.removeItem("vdp_auth_user");
}

export function getStoredUser() {
  const raw = localStorage.getItem("vdp_auth_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  if (token) {
    sessionStorage.setItem("jwt", token);
  }
  const normalizedRole = normalizeRole(user?.role);
  if (normalizedRole) {
    sessionStorage.setItem("vdp_role", normalizedRole);
  }
  if (user?.organization_id) {
    sessionStorage.setItem("vdp_org_id", String(user.organization_id));
  }
  persistUser(user);
}

export function getSessionToken() {
  return sessionStorage.getItem("jwt") || localStorage.getItem("jwt") || "";
}

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("jwt") || localStorage.getItem("jwt");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      clearSession();
      const loginPath = resolveVdpLoginPath();
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

export async function login(payload) {
  const { data } = await api.post("/auth/login", payload);
  setSession(data?.access_token || data?.token, data?.user);
  return data;
}

export async function bootstrapSession() {
  const { data } = await api.post("/auth/bootstrap", {});
  setSession(data?.access_token || data?.token, data?.user);
  return data;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  persistUser(data);
  return data;
}

export async function getOrgProfile() {
  const { data } = await api.get("/org/profile");
  return data;
}

export async function updateOrgProfile(payload) {
  const { data } = await api.put("/org/profile", payload);
  return data;
}

export async function getOrgVdp() {
  const { data } = await api.get("/org/vdp");
  return data;
}

export async function getOrgSettings() {
  const { data } = await api.get("/org/settings");
  return data;
}

export async function updateOrgSettings(payload) {
  await api.put("/org/settings", payload);
}

export async function getProcedureTemplate() {
  const { data } = await api.get("/procedures/template");
  return data;
}

export async function createProcedure(payload) {
  const { data } = await api.post("/procedures", payload);
  return data;
}

export async function updateProcedure(procedureId, payload) {
  const { data } = await api.put(`/procedures/${procedureId}`, payload);
  return data;
}

export async function uploadProcedureDocument(procedureId, file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(`/procedures/${procedureId}/document`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function createProgram(payload) {
  const { data } = await api.post("/programs", payload);
  return data;
}

export async function createVDPProgram(payload) {
  let body = payload;
  let headers = undefined;

  if (!(payload instanceof FormData)) {
    const fd = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (key === "policy_pdf" || key === "file") {
        fd.append("policy_pdf", value);
        return;
      }
      fd.append(key, value);
    });
    body = fd;
    headers = { "Content-Type": "multipart/form-data" };
  }

  const { data } = await api.post("/org-admin/programs", body, { headers });
  return data;
}

export async function publishVDPProgram(programId) {
  const { data } = await api.patch(`/org-admin/programs/${programId}/publish`);
  return data;
}

export async function updateProgram(programId, payload) {
  const { data } = await api.patch(`/programs/${programId}`, payload);
  return data;
}

export async function listOrgReports(filters = {}) {
  const { data } = await api.get("/org/reports", { params: filters });
  return data;
}

export async function getOrgReport(reportId) {
  const { data } = await api.get(`/org/reports/${reportId}`);
  return data;
}

export async function getOrgReportComments(reportId) {
  const { data } = await api.get(`/org/reports/${reportId}/comments`);
  return data;
}

export async function getOrgReportEvents(reportId) {
  const { data } = await api.get(`/org/reports/${reportId}/events`);
  return data;
}

export async function getOrgReportAttachments(reportId) {
  const { data } = await api.get(`/org/reports/${reportId}/attachments`);
  return data;
}

export async function getOrgReportTriage(reportId) {
  const { data } = await api.get(`/org/reports/${reportId}/triage`);
  return data;
}

export async function runOrgReportTriage(reportId) {
  const { data } = await api.post(`/org/reports/${reportId}/triage/run`);
  return data;
}

export async function patchReportStatus(reportId, payload) {
  const { data } = await api.patch(`/reports/${reportId}/status`, payload);
  return data;
}

export async function assignReport(reportId, payload) {
  await api.patch(`/org/reports/${reportId}/assignee`, payload);
}

export async function addOrgReportComment(reportId, payload) {
  const { data } = await api.post(`/org/reports/${reportId}/comments`, payload);
  return data;
}

export async function requestOrgReportInfo(reportId, payload) {
  const { data } = await api.post(`/org/reports/${reportId}/message`, payload);
  return data;
}

export async function getOrgMetrics() {
  const { data } = await api.get("/org/metrics");
  return data;
}

export async function listOrgNotifications() {
  const { data } = await api.get("/org/notifications");
  return data;
}

export async function markOrgNotificationRead(notificationId) {
  await api.patch(`/org/notifications/${notificationId}/read`);
}

export default api;
