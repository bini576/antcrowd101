import api from "@shared-api/client";

export async function listOrganizations() {
  const { data } = await api.get("/organizations");
  return data;
}

export async function createOrganization(payload) {
  const { data } = await api.post("/organizations", payload);
  return data;
}

export async function listTrainers() {
  const { data } = await api.get("/trainers");
  return data;
}

export async function createTrainer(payload) {
  const { data } = await api.post("/trainers", payload);
  return data;
}

export async function listTrainingRequests() {
  const { data } = await api.get("/training/requests");
  return data;
}

export async function createTrainingRequest(payload) {
  const { data } = await api.post("/training/requests", payload);
  return data;
}

export async function patchTrainingRequestStatus(requestId, status) {
  const { data } = await api.patch(`/training/requests/${requestId}/status`, { status });
  return data;
}

export async function assignResearcherToRequest(requestId, researcherId) {
  const { data } = await api.patch(`/training/requests/${requestId}/assign-researcher`, {
    researcher_id: researcherId
  });
  return data;
}

export async function listTrainingPlans() {
  const { data } = await api.get("/training/plans");
  return data;
}

export async function createTrainingPlan(payload) {
  const { data } = await api.post("/training/plans", payload);
  return data;
}

export async function listReports() {
  const { data } = await api.get("/reports");
  return data;
}

export async function createReport(payload) {
  const { data } = await api.post("/reports", payload);
  return data;
}

export async function submitReportFeedback(reportId, payload) {
  const { data } = await api.patch(`/reports/${reportId}/feedback`, payload);
  return data;
}

export async function listTrainingPackages() {
  const { data } = await api.get("/commercial/packages");
  return data;
}

export async function createTrainingPackage(payload) {
  const { data } = await api.post("/commercial/packages", payload);
  return data;
}

export async function listTrainingQuotes() {
  const { data } = await api.get("/commercial/quotes");
  return data;
}

export async function createTrainingQuote(payload) {
  const { data } = await api.post("/commercial/quotes", payload);
  return data;
}

export async function updateTrainingQuoteStatus(quoteId, status) {
  const { data } = await api.patch(`/commercial/quotes/${quoteId}/status`, { status });
  return data;
}

export async function listTrainingInvoices() {
  const { data } = await api.get("/commercial/invoices");
  return data;
}

export async function updateTrainingInvoiceStatus(invoiceId, status) {
  const { data } = await api.patch(`/commercial/invoices/${invoiceId}/status`, { status });
  return data;
}

export async function uploadInvoiceReceipt(invoiceId, payload) {
  const { data } = await api.patch(`/commercial/invoices/${invoiceId}/receipt`, payload);
  return data;
}

export async function updateInvoiceVerification(invoiceId, payload) {
  const { data } = await api.patch(`/commercial/invoices/${invoiceId}/verification`, payload);
  return data;
}
