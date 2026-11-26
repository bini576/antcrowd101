import axios from "axios";

const TRUST_API = import.meta.env.VITE_TRUST_API_BASE || "/api/security-trust";
const TRUST_CENTER_API = import.meta.env.VITE_TRUST_CENTER_API_BASE || "/api/trust-center";

const api = axios.create({ baseURL: TRUST_API, withCredentials: true, headers: { "Content-Type": "application/json" } });
const tcApi = axios.create({ baseURL: TRUST_CENTER_API, withCredentials: true, headers: { "Content-Type": "application/json" } });

const ANTCROWD_ORG_ID = "00000000-0000-4000-a000-000000000001";

export { ANTCROWD_ORG_ID };

export async function fetchWhoAmI() {
  const { data } = await api.get("/api/whoami");
  return data;
}

export async function fetchAdminSummary() {
  const { data } = await api.get("/api/admin/summary");
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

export async function deleteSubprocessor(itemId) {
  await api.delete(`/api/v1/subprocessors/${itemId}`);
}

export async function fetchFaq(orgId) {
  const { data } = await api.get(`/api/v1/faq/organizations/${orgId}/faq`);
  return data;
}

export async function createFaq(orgId, payload) {
  const { data } = await api.post(`/api/v1/faq/organizations/${orgId}/faq`, payload);
  return data;
}

export async function deleteFaq(itemId) {
  await api.delete(`/api/v1/faq/${itemId}`);
}

export async function fetchUpdates(orgId) {
  const { data } = await api.get(`/api/v1/updates/organizations/${orgId}/updates`);
  return data;
}

export async function createUpdate(orgId, payload) {
  const { data } = await api.post(`/api/v1/updates/organizations/${orgId}/updates`, payload);
  return data;
}

export async function deleteUpdateItem(itemId) {
  await api.delete(`/api/v1/updates/${itemId}`);
}

export async function fetchGrcFrameworks() {
  const { data } = await api.get("/api/v1/grc/frameworks");
  return data;
}

export async function fetchGrcControls(frameworkId) {
  const { data } = await api.get(`/api/v1/grc/frameworks/${frameworkId}/controls`);
  return data;
}

export async function fetchGrcStatus(orgId) {
  const { data } = await api.get(`/api/v1/grc/organizations/${orgId}/status`);
  return data;
}

export async function fetchSubmissions() {
  const { data } = await tcApi.get("/api/trust-center/submissions");
  return data;
}
