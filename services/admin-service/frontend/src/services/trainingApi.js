const API_BASE = (import.meta.env.VITE_TRAINING_API_BASE_URL || "/api/training").replace(/\/$/, "");
const TOKEN_KEY = "antcrowd_training_admin_token";

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
  if (!res.ok) throw new Error(body.detail || body.error || `Training request failed (${res.status})`);
  return body;
}

export const trainingApi = {
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
      if (!res.ok) throw new Error(body.detail || `Bootstrap failed (${res.status})`);
      return body;
    });
  },
  me: () => request("/auth/me"),
  createOrganization: (payload) => request("/organizations", { method: "POST", body: JSON.stringify(payload) }),
  createTrainer: (payload) => request("/trainers", { method: "POST", body: JSON.stringify(payload) }),
  createPackage: (payload) => request("/commercial/packages", { method: "POST", body: JSON.stringify(payload) }),
  updateRequestStatus: (requestId, status) =>
    request(`/training/requests/${requestId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  assignTrainer: (requestId, trainerId) =>
    request(`/training/requests/${requestId}/assign-researcher`, { method: "PATCH", body: JSON.stringify({ researcher_id: trainerId }) }),
  verifyPayment: (invoiceId, verificationStatus, note) =>
    request(`/commercial/invoices/${invoiceId}/verification`, { method: "PATCH", body: JSON.stringify({ payment_verification_status: verificationStatus, payment_verification_note: note || "" }) }),
  createQuote: (requestId, notes = "") =>
    request("/commercial/quotes", { method: "POST", body: JSON.stringify({ request_id: requestId, notes }) }),
  updateQuoteStatus: (quoteId, status) =>
    request(`/commercial/quotes/${quoteId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  createPlan: (payload) =>
    request("/training/plans", { method: "POST", body: JSON.stringify(payload) }),
  listRequests: () => request("/training/requests"),
  listPlans: () => request("/training/plans"),
  listQuotes: () => request("/commercial/quotes"),
  listInvoices: () => request("/commercial/invoices"),
  listPackages: () => request("/commercial/packages"),
  listOrganizations: () => request("/organizations"),
  listTrainers: () => request("/trainers"),
};
