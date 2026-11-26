const API_BASE = (import.meta.env.VITE_AI_REDTEAM_API_BASE_URL || "/api/ai-redteam").replace(/\/$/, "");

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
  if (!res.ok) throw new Error(body.error || body.detail || `AI Red Team request failed (${res.status})`);
  return body;
}

export const aiRedteamApi = {
  whoami: () => request("/api/whoami"),
  adminSummary: () => request("/api/admin/summary"),
  dashboard: () => request("/api/dashboard"),
  publicData: () => request("/api/public"),
};
