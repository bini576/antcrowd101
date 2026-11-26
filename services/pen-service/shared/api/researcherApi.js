const DEFAULT_API_BASE = window.location.pathname.startsWith("/workspace/pen/")
  ? "/api/pen-researcher"
  : "http://localhost:8107";
const API_BASE = (import.meta.env.VITE_RESEARCHER_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
const TOKEN_KEY = import.meta.env.VITE_TOKEN_STORAGE_KEY || "antcrowd_researcher_token";

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
  const res = await fetch(`${API_BASE}${path}`, {
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

export const researcherApi = {
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
  getProfile: () => request("/api/researcher/profile"),
  updateProfile: (payload) => request("/api/researcher/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  uploadProfilePhoto: (photoDataUrl) =>
    request("/api/researcher/profile/photo", {
      method: "POST",
      body: JSON.stringify({ photoDataUrl }),
    }),
  getEngagements: () => request("/api/researcher/engagements"),
  getApplications: () => request("/api/researcher/applications"),
  getInvitations: () => request("/api/researcher/invitations"),
  respondInvitation: (invitationId, status) =>
    request(`/api/researcher/invitations/${invitationId}/respond`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  getFindings: () => request("/api/researcher/findings"),
  submitFinding: (payload) => request("/api/researcher/findings", { method: "POST", body: JSON.stringify(payload) }),
  getNotifications: () => request("/api/researcher/notifications"),
  markNotificationRead: (id) => request(`/api/researcher/notifications/${id}/read`, { method: "PATCH" }),
  getEarnings: () => request("/api/researcher/earnings"),
};
