const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api/pen").replace(/\/$/, "");
const TOKEN_KEY = "antcrowd_platform_admin_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const adminApi = {
  getToken,
  setToken,
  login: (email, password) =>
    fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      return body;
    }),
  bootstrapFromSession: () => request("/api/auth/bootstrap", { method: "POST" }),
  me: () => request("/api/auth/me"),
  getDashboard: () => request("/api/dashboard"),
  getMetrics: () => request("/api/metrics"),
  getNotifications: () => request("/api/notifications"),
  markNotificationRead: (id) => request(`/api/notifications/${id}/read`, { method: "PATCH" }),
  getOrganizations: () => request("/api/organizations"),
  getResearchers: (pool = "") => request(`/api/researchers${pool ? `?pool=${pool}` : ""}`),
  createResearcher: (payload) => request("/api/researchers", { method: "POST", body: JSON.stringify(payload) }),
  getInternalRequests: () => request("/api/admin/internal-requests"),
  assignInternalRequest: (requestId, researcherId) =>
    request(`/api/admin/internal-requests/${requestId}/assign`, { method: "POST", body: JSON.stringify({ researcherId }) }),
  getFindings: () => request("/api/findings"),
  updateFindingStatus: (id, status, duplicateOf = 0, bounty = 0, reviewComment = "", paymentReference = "") =>
    request(`/api/findings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, duplicateOf, bounty, reviewComment, paymentReference }),
    }),
};
