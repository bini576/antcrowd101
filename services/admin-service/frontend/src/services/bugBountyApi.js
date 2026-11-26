const API_BASE = (import.meta.env.VITE_BUG_BOUNTY_API_BASE_URL || "/api/bug-bounty").replace(/\/$/, "");

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
  if (!res.ok) throw new Error(body.error || body.detail || `Bug Bounty request failed (${res.status})`);
  return body;
}

export const bugBountyApi = {
  whoami: () => request("/api/whoami"),
  adminSummary: () => request("/api/admin/summary"),
  dashboard: () => request("/api/dashboard"),
  publicData: () => request("/api/public"),
  payoutRequests: () => request("/api/admin/payout-requests"),
  approvePayout: (id, note = "") => request(`/api/admin/payout-requests/${id}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
  rejectPayout: (id, note = "") => request(`/api/admin/payout-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
  markPayoutPaid: (id, note = "") => request(`/api/admin/payout-requests/${id}/mark-paid`, { method: "POST", body: JSON.stringify({ note }) }),
};
