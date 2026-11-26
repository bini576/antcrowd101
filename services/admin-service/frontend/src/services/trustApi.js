const API_BASE = (import.meta.env.VITE_TRUST_API_BASE_URL || "/api/security-trust").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.detail || `Trust service request failed (${res.status})`);
  return body;
}

export const trustApi = {
  whoami: () => request("/api/whoami"),
  adminSummary: () => request("/api/admin/summary"),
  listOrganizations: () => request("/api/v1/organizations"),
  listAccessRequests: (orgId) =>
    request(`/api/v1/access-requests/organizations/${orgId}/access-requests`),
  updateAccessRequestStatus: (itemId, status) =>
    request(`/api/v1/access-requests/${itemId}/status?status=${encodeURIComponent(status)}`, { method: "PUT" }),
};
