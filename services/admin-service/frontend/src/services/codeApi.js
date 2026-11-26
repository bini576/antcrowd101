const API_BASE = (import.meta.env.VITE_CODE_API_BASE_URL || "/api/code").replace(/\/$/, "");

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
  if (!res.ok) throw new Error(body.error || body.detail || `Code service request failed (${res.status})`);
  return body;
}

export const codeApi = {
  whoami: () => request("/api/whoami"),
  adminSummary: () => request("/api/admin/summary"),
  dashboard: () => request("/api/dashboard"),
  requests: () => request("/api/requests"),
};
