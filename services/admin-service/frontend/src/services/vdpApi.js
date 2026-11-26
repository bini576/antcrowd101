const API_BASE = (import.meta.env.VITE_VDP_API_BASE_URL || "/api/vdp").replace(/\/$/, "");
const TOKEN_KEY = "antcrowd_vdp_admin_token";

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
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.detail || `VDP request failed (${res.status})`);
  return body;
}

export const vdpApi = {
  getToken,
  setToken,
  login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  bootstrap: () => {
    return fetch(`${API_BASE}/auth/bootstrap`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.detail || `Bootstrap failed (${res.status})`);
      return body;
    });
  },
  me: () => request("/auth/me"),
  listOrganizations: (q = "") => request(`/admin/orgs${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  listPrograms: () => request("/admin/programs"),
  updateProgram: (id, payload) => request(`/admin/programs/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listReports: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      query.set(k, String(v));
    });
    return request(`/admin/reports${query.toString() ? `?${query.toString()}` : ""}`);
  },
  listAuditEvents: (reportId = "") =>
    request(`/admin/audit${reportId ? `?report_id=${encodeURIComponent(reportId)}` : ""}`),
};
