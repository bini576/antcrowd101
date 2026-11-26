import axios from "axios";

const TRUST_API = import.meta.env.VITE_TRUST_API_BASE || "/api/security-trust";

const api = axios.create({ baseURL: TRUST_API, withCredentials: true, headers: { "Content-Type": "application/json" } });

const ANTCROWD_ORG_ID = "00000000-0000-4000-a000-000000000001";
export { ANTCROWD_ORG_ID };

export async function fetchWhoAmI() {
  const { data } = await api.get("/api/whoami");
  return data;
}

export async function fetchOverview(orgId) {
  const { data } = await api.get(`/api/v1/overview/${orgId}`);
  return data;
}

export async function upsertOverview(orgId, payload) {
  const { data } = await api.put(`/api/v1/overview/${orgId}`, payload);
  return data;
}

export async function fetchCompliance(orgId) {
  const { data } = await api.get(`/api/v1/compliance/organizations/${orgId}/compliance`);
  return data;
}

export async function createCompliance(orgId, payload) {
  const { data } = await api.post(`/api/v1/compliance/organizations/${orgId}/compliance`, payload);
  return data;
}

export async function deleteCompliance(itemId) {
  await api.delete(`/api/v1/compliance/${itemId}`);
}

export async function fetchSubprocessors(orgId) {
  const { data } = await api.get(`/api/v1/subprocessors/organizations/${orgId}/subprocessors`);
  return data;
}

export async function createSubprocessor(orgId, payload) {
  const { data } = await api.post(`/api/v1/subprocessors/organizations/${orgId}/subprocessors`, payload);
  return data;
}

export async function fetchFaq(orgId) {
  const { data } = await api.get(`/api/v1/faq/organizations/${orgId}/faq`);
  return data;
}

export async function createFaq(orgId, payload) {
  const { data } = await api.post(`/api/v1/faq/organizations/${orgId}/faq`, payload);
  return data;
}

export async function fetchUpdates(orgId) {
  const { data } = await api.get(`/api/v1/updates/organizations/${orgId}/updates`);
  return data;
}

export async function createUpdate(orgId, payload) {
  const { data } = await api.post(`/api/v1/updates/organizations/${orgId}/updates`, payload);
  return data;
}

export async function fetchResources(orgId) {
  const { data } = await api.get(`/api/v1/resources/organizations/${orgId}/resources`);
  return data;
}

export async function fetchAccessRequests(orgId) {
  const { data } = await api.get(`/api/v1/access-requests/organizations/${orgId}/access-requests`);
  return data;
}

export async function fetchGrcFrameworks() {
  const { data } = await api.get("/api/v1/grc/frameworks");
  return data;
}

export async function fetchGrcStatus(orgId) {
  const { data } = await api.get(`/api/v1/grc/organizations/${orgId}/status`);
  return data;
}

export async function fetchTrustCenterPublic(slug) {
  const { data } = await api.get(`/api/v1/trust-center/${slug}`);
  return data;
}

export async function unpublishTrustCenter(orgId) {
  const { data } = await api.post(`/api/v1/organizations/${orgId}/unpublish`);
  return data;
}

export async function fetchPublicDirectory() {
  const { data } = await api.get("/api/v1/organizations/public");
  return data;
}

export async function fetchOrgTrustRequest(orgId) {
  try { const { data } = await api.get(`/api/v1/trust-requests/org/${orgId}`); return data; }
  catch { return null; }
}

export async function submitTrustRequest(payload) {
  const { data } = await api.post("/api/v1/trust-requests", payload);
  return data;
}

export async function fetchAllTrustRequests(status = null) {
  const qs = status ? `?status=${status}` : "";
  const { data } = await api.get(`/api/v1/trust-requests${qs}`);
  return data;
}

export async function approveTrustRequest(id) {
  const { data } = await api.patch(`/api/v1/trust-requests/${id}/approve`);
  return data;
}

export async function declineTrustRequest(id) {
  const { data } = await api.patch(`/api/v1/trust-requests/${id}/decline`);
  return data;
}

export async function fetchOrgNotifications(orgId) {
  try { const { data } = await api.get(`/api/v1/notifications/org/${orgId}`); return data; }
  catch { return []; }
}

export async function markNotificationsRead(orgId) {
  try { await api.post(`/api/v1/notifications/org/${orgId}/read`); } catch { /* ignore */ }
}
