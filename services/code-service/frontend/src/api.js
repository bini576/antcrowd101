import axios from "axios";

/**
 * Code Security Service API client.
 *
 * This follows the exact same pattern as the challenge-service api.js:
 * axios client with baseURL from env var, withCredentials for cookie auth.
 */

const API_BASE = (import.meta.env.VITE_CODE_API_BASE || "/api/code").replace(/\/$/, "");

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach per-tab bootstrap token as Authorization header when available.
// This ensures each tab uses its own session token for API calls,
// independent of the shared antcrowd_session cookie.
client.interceptors.request.use((config) => {
  try {
    const stored = sessionStorage.getItem("antcrowd_code_token");
    if (stored) {
      config.headers.Authorization = `Bearer ${stored}`;
    }
  } catch {}
  return config;
});

/**
 * Call the backend's /api/whoami endpoint to resolve the current session.
 * Returns { authenticated, role, email, displayName, username, loginUrl, logoutUrl, service }.
 */
export async function fetchWhoAmI() {
  const { data } = await client.get("/api/whoami");
  return data;
}

export async function fetchDashboard() {
  const { data } = await client.get("/api/dashboard");
  return data;
}

export async function fetchAdminSummary() {
  const { data } = await client.get("/api/admin/summary");
  return data;
}

export async function fetchNotifications() {
  const { data } = await client.get("/api/notifications");
  return Array.isArray(data) ? data : [];
}

export async function markNotificationRead(id) {
  const { data } = await client.post(`/api/notifications/${id}/read`, {});
  return data;
}

export async function fetchRequests() {
  const { data } = await client.get("/api/requests");
  return Array.isArray(data) ? data : [];
}

export async function createRequest(payload) {
  const { data } = await client.post("/api/requests", payload);
  return data;
}

export async function decideRequest(id, action, comment = "") {
  const { data } = await client.post(`/api/requests/${id}/decision`, { action, comment });
  return data;
}

export async function assignRequest(id, researcherEmail) {
  const { data } = await client.post(`/api/requests/${id}/assign`, { researcher_email: researcherEmail });
  return data;
}

export async function fetchFindings(requestId) {
  const { data } = await client.get(`/api/requests/${requestId}/findings`);
  return Array.isArray(data) ? data : [];
}

export async function submitFinding(requestId, payload) {
  const { data } = await client.post(`/api/requests/${requestId}/findings`, payload);
  return data;
}

export async function completeRequest(id) {
  const { data } = await client.post(`/api/requests/${id}/complete`, {});
  return data;
}

export async function fetchReviewers() {
  const { data } = await client.get("/api/reviewers");
  return Array.isArray(data) ? data : [];
}
