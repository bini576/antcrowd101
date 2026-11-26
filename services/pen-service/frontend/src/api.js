const DEFAULT_API_BASE = window.location.pathname.startsWith("/workspace/pen/org")
  ? "/api/pen"
  : "http://localhost:8106";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, "");
const TOKEN_KEY = "antcrowd_org_token";

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

function consumeTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || params.get("access_token");

  if (!token) {
    return;
  }

  setToken(token);
  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
}

consumeTokenFromUrl();

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.headers.get("content-type")?.includes("text/csv")) {
    const text = await res.text();
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return text;
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const penApi = {
  getToken,
  setToken,
  login: (email, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  bootstrap: async () => {
    const res = await fetch(`${API_BASE}/api/auth/bootstrap`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  },
  me: () => request("/api/auth/me"),

  getDashboard: () => request("/api/dashboard"),
  getMetrics: () => request("/api/metrics"),
  getNotifications: () => request("/api/notifications"),
  markNotificationRead: (id) => request(`/api/notifications/${id}/read`, { method: "PATCH" }),

  getEngagements: () => request("/api/engagements"),
  createEngagement: (payload) => request("/api/engagements", { method: "POST", body: JSON.stringify(payload) }),
  updateEngagementStatus: (id, status) => request(`/api/engagements/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  exportEngagementReport: (id) => request(`/api/engagements/${id}/report.csv`),

  assignExternalResearcher: (engagementId, researcherId) =>
    request(`/api/engagements/${engagementId}/assign-external`, { method: "POST", body: JSON.stringify({ researcherId }) }),
  requestInternalAssignment: (engagementId) => request(`/api/engagements/${engagementId}/request-internal`, { method: "POST" }),

  getResearchers: (pool = "") => request(`/api/researchers${pool ? `?pool=${pool}` : ""}`),
  rateResearcher: (researcherId, stars, comment = "") =>
    request(`/api/researchers/${researcherId}/rating`, { method: "POST", body: JSON.stringify({ stars, comment }) }),

  getInternalRequests: () => request("/api/admin/internal-requests"),
  sendInvitation: (engagementId, researcherId) =>
    request("/api/invitations", { method: "POST", body: JSON.stringify({ engagementId, researcherId }) }),

  getFindings: () => request("/api/findings"),
  createFinding: (payload) => request("/api/findings", { method: "POST", body: JSON.stringify(payload) }),
  updateFindingStatus: (id, status, duplicateOf = 0, bounty = 0, reviewComment = "", paymentReference = "") =>
    request(`/api/findings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, duplicateOf, bounty, reviewComment, paymentReference }),
    }),
  getDuplicateHints: (engagementId, title) =>
    request(`/api/findings/duplicate-hints?engagementId=${engagementId}&title=${encodeURIComponent(title)}`),
};
