import { useEffect, useMemo, useState } from "react";
import { EmptyState, StatusBadge } from "../components/shared/PortalUI";
import { trainingApi } from "../services/trainingApi";

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString();
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString()} ETB`;
}

function parseApiError(error, fallback) {
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

const initialTrainerForm = {
  name: "",
  email: "",
  expertise: "",
};

const initialPackageForm = {
  package_type: "basic",
  display_name: "",
  description: "",
  duration_days: 2,
  base_price_etb: 0,
  per_participant_etb: 0,
};

const initialScheduleForm = {
  start_date: "",
  end_date: "",
  location: "",
  customized_outline: "",
};

export default function TrainingWorkspacePage({ internalResearchers = [] }) {
  const trainingOrgUrl = import.meta.env.VITE_TRAINING_ORG_PORTAL_URL || "/workspace/training/org/";
  const trainingResearcherUrl = import.meta.env.VITE_TRAINING_RESEARCHER_PORTAL_URL || "/workspace/training/researcher/";
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [requests, setRequests] = useState([]);
  const [plans, setPlans] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [actionBusy, setActionBusy] = useState("");
  const [requestFilter, setRequestFilter] = useState({ q: "", status: "" });
  const [trainerForm, setTrainerForm] = useState(initialTrainerForm);
  const [packageForm, setPackageForm] = useState(initialPackageForm);
  const [trainerAssignment, setTrainerAssignment] = useState({});
  const [schedulingRequest, setSchedulingRequest] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(initialScheduleForm);

  const loggedIn = Boolean(trainingApi.getToken());

  useEffect(() => {
    if (loggedIn) {
      loadWorkspace();
    } else {
      bootstrapSession();
    }
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const quotesByRequest = useMemo(() => {
    const map = new Map();
    quotes.forEach((quote) => map.set(quote.request_id, quote));
    return map;
  }, [quotes]);

  const invoicesByQuote = useMemo(() => {
    const map = new Map();
    invoices.forEach((invoice) => map.set(invoice.quote_id, invoice));
    return map;
  }, [invoices]);

  const kpis = useMemo(
    () => ({
      requests: requests.length,
      pendingRequests: requests.filter((item) => item.status === "pending").length,
      approvedRequests: requests.filter((item) => item.status === "approved").length,
      plans: plans.length,
      quotesSent: quotes.filter((item) => item.status === "sent").length,
      invoicesPendingVerification: invoices.filter((item) => item.payment_verification_status === "pending").length,
      totalQuoted: quotes.reduce((sum, item) => sum + Number(item.total_price_etb || 0), 0),
      totalInvoiced: invoices.reduce((sum, item) => sum + Number(item.amount_etb || 0), 0),
    }),
    [requests, plans, quotes, invoices],
  );

  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      if (requestFilter.status && item.status !== requestFilter.status) return false;
      const query = requestFilter.q.trim().toLowerCase();
      if (!query) return true;
      return [item.id, item.package_type, item.location, item.special_focus]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [requests, requestFilter]);

  async function bootstrapSession() {
    setLoading(true);
    setError("");
    try {
      const data = await trainingApi.bootstrap();
      trainingApi.setToken(data?.access_token || data?.token || "");
      const me = await trainingApi.me();
      setAuthUser(me);
      await loadWorkspace();
      setToast("Training admin workspace connected via platform session.");
    } catch (e) {
      setError(parseApiError(e, "Failed to bootstrap training session. Ensure you are signed in to the platform."));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    trainingApi.setToken("");
    setAuthUser(null);
    setRequests([]);
    setPlans([]);
    setQuotes([]);
    setInvoices([]);
    setPackages([]);
    setOrganizations([]);
    setTrainers([]);
  }

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [me, reqData, planData, quoteData, invoiceData, packageData, orgData, trainerData] = await Promise.all([
        trainingApi.me(),
        trainingApi.listRequests(),
        trainingApi.listPlans(),
        trainingApi.listQuotes(),
        trainingApi.listInvoices(),
        trainingApi.listPackages(),
        trainingApi.listOrganizations(),
        trainingApi.listTrainers(),
      ]);
      setAuthUser(me);
      setRequests(reqData || []);
      setPlans(planData || []);
      setQuotes(quoteData || []);
      setInvoices(invoiceData || []);
      setPackages(packageData || []);
      setOrganizations(orgData || []);
      setTrainers(trainerData || []);
    } catch (e) {
      const msg = parseApiError(e, "");
      if (
        msg.toLowerCase().includes("token") ||
        msg.toLowerCase().includes("auth") ||
        msg.toLowerCase().includes("credentials") ||
        msg.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("insufficient") ||
        msg.toLowerCase().includes("role") ||
        msg.toLowerCase().includes("forbidden") ||
        msg.toLowerCase().includes("401") ||
        msg.toLowerCase().includes("403")
      ) {
        logout();
        await bootstrapSession();
      } else {
        setError(msg || "Failed to load training workspace data.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function performAction(key, fn, successText) {
    setActionBusy(key);
    setError("");
    try {
      await fn();
      setToast(successText);
      await loadWorkspace();
    } catch (e) {
      setError(parseApiError(e, "Training action failed."));
    } finally {
      setActionBusy("");
    }
  }

  async function approveRequest(requestId) {
    await performAction(
      `approve-${requestId}`,
      () => trainingApi.updateRequestStatus(requestId, "approved"),
      "Training request approved.",
    );
  }

  async function rejectRequest(requestId) {
    await performAction(
      `reject-${requestId}`,
      () => trainingApi.updateRequestStatus(requestId, "rejected"),
      "Training request rejected.",
    );
  }

  async function issueQuote(requestId) {
    await performAction(
      `quote-${requestId}`,
      () => trainingApi.createQuote(requestId, "Prepared from unified admin console"),
      "Quotation sent to organization.",
    );
  }

  async function handleAssignTrainer(requestId) {
    const trainerId = trainerAssignment[requestId];
    if (!trainerId) {
      setError("Select a trainer before assigning.");
      return;
    }
    await performAction(
      `assign-${requestId}`,
      () => trainingApi.assignTrainer(requestId, trainerId),
      "Trainer assigned to request.",
    );
  }

  async function handleVerifyPayment(invoiceId) {
    await performAction(
      `verify-${invoiceId}`,
      () => trainingApi.verifyPayment(invoiceId, "verified", "Verified from admin console"),
      "Payment verified.",
    );
  }

  async function handleScheduleTraining(event) {
    if (event) event.preventDefault();
    if (!schedulingRequest) return;

    const payload = {
      request_id: schedulingRequest.id,
      trainer_id: schedulingRequest.researcher_id,
      start_date: scheduleForm.start_date,
      end_date: scheduleForm.end_date,
      location: scheduleForm.location.trim(),
      customized_outline: scheduleForm.customized_outline.trim(),
    };

    if (!payload.start_date || !payload.end_date || !payload.location || !payload.customized_outline) {
      setError("Please fill all scheduling fields (start date, end date, location, and customized outline).");
      return;
    }

    await performAction(
      `schedule-${schedulingRequest.id}`,
      () => trainingApi.createPlan(payload),
      "Training scheduled successfully.",
    );

    setSchedulingRequest(null);
    setScheduleForm(initialScheduleForm);
  }

  async function createTrainer(event) {
    event.preventDefault();
    const payload = {
      name: trainerForm.name.trim(),
      email: trainerForm.email.trim().toLowerCase(),
      expertise: trainerForm.expertise.trim(),
    };
    if (Object.values(payload).some((value) => !value)) {
      setError("Fill all internal researcher fields before creating.");
      return;
    }
    await performAction("create-trainer", () => trainingApi.createTrainer(payload), "Internal researcher profile created.");
    setTrainerForm(initialTrainerForm);
  }

  async function createPackage(event) {
    event.preventDefault();
    const payload = {
      ...packageForm,
      duration_days: Number(packageForm.duration_days || 0),
      base_price_etb: Number(packageForm.base_price_etb || 0),
      per_participant_etb: Number(packageForm.per_participant_etb || 0),
    };
    if (!payload.display_name.trim() || !payload.description.trim() || payload.duration_days <= 0) {
      setError("Provide package name, description, and valid duration.");
      return;
    }
    await performAction("create-package", () => trainingApi.createPackage(payload), "Training package pricing saved.");
    setPackageForm(initialPackageForm);
  }

  return (
    <>
      <section className="card workspace-header">
        <h2>Training Workspace</h2>
        <p className="section-intro">Unified platform-admin operations and setup for pricing, request flow, trainer assignment, and delivery readiness.</p>
        <div className="badge-stack">
          {!loggedIn ? (
            <>
              <button type="button" onClick={bootstrapSession} disabled={loading}>{loading ? "Connecting..." : "Connect Training"}</button>
            </>
          ) : (
            <>
              <span className="metric-pill">Signed in as {authUser?.email || "Training admin"}</span>
              <button type="button" className="ghost" onClick={loadWorkspace} disabled={loading}>
                Refresh
              </button>
              <button type="button" className="ghost" onClick={logout}>
                Disconnect
              </button>
            </>
          )}
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        {toast ? <div className="notice success">{toast}</div> : null}
      </section>

      {loggedIn ? (
        <>
          <section className="kpi-grid">
            <article className="kpi"><span>Requests</span><strong>{kpis.requests}</strong></article>
            <article className="kpi"><span>Pending Review</span><strong>{kpis.pendingRequests}</strong></article>
            <article className="kpi"><span>Approved</span><strong>{kpis.approvedRequests}</strong></article>
            <article className="kpi"><span>Plans</span><strong>{kpis.plans}</strong></article>
          </section>

          <section className="kpi-grid">
            <article className="kpi"><span>Quotes Sent</span><strong>{kpis.quotesSent}</strong></article>
            <article className="kpi"><span>Invoices Pending Verification</span><strong>{kpis.invoicesPendingVerification}</strong></article>
            <article className="kpi"><span>Total Quoted</span><strong>{formatCurrency(kpis.totalQuoted)}</strong></article>
            <article className="kpi"><span>Total Invoiced</span><strong>{formatCurrency(kpis.totalInvoiced)}</strong></article>
          </section>

          <section className="grid two">
            <article className="card">
              <h3>Operations Queue</h3>
              <p className="section-intro">Review intake requests and trigger quotation workflow from one queue.</p>
              <div className="filter-row">
                <input
                  placeholder="Search by request, package, or focus"
                  value={requestFilter.q}
                  onChange={(event) => setRequestFilter((prev) => ({ ...prev, q: event.target.value }))}
                />
                <select
                  value={requestFilter.status}
                  onChange={(event) => setRequestFilter((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="">All statuses</option>
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                  <option value="scheduled">scheduled</option>
                  <option value="completed">completed</option>
                </select>
              </div>
              <div className="review-table-wrap">
                <table className="review-table">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Package</th>
                      <th>Participants</th>
                      <th>Status</th>
                      <th>Quote</th>
                      <th>Payment</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.slice(0, 24).map((request) => {
                      const quote = quotesByRequest.get(request.id);
                      const invoice = quote ? invoicesByQuote.get(quote.id) : null;
                      return (
                        <tr key={request.id}>
                          <td>{request.id.slice(0, 8)}</td>
                          <td>{request.package_type}</td>
                          <td>{request.number_of_participants}</td>
                          <td><StatusBadge status={request.status} /></td>
                          <td>{quote ? <StatusBadge status={quote.status} /> : <StatusBadge status="draft" />}</td>
                          <td>{invoice ? <StatusBadge status={invoice.payment_verification_status} /> : <StatusBadge status="unpaid" />}</td>
                          <td>
                            <div className="badge-stack">
                              {request.status === "pending" ? (
                                <>
                                  <button
                                    type="button"
                                    className="ghost"
                                    disabled={actionBusy === `approve-${request.id}` || actionBusy === `reject-${request.id}`}
                                    onClick={() => approveRequest(request.id)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost"
                                    disabled={actionBusy === `approve-${request.id}` || actionBusy === `reject-${request.id}`}
                                    onClick={() => rejectRequest(request.id)}
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : null}
                              {request.status === "approved" && !request.researcher_id ? (
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                  <select
                                    value={trainerAssignment[request.id] || ""}
                                    onChange={(e) => setTrainerAssignment((prev) => ({ ...prev, [request.id]: e.target.value }))}
                                    style={{ maxWidth: 140 }}
                                  >
                                    <option value="">Select trainer</option>
                                    {trainers.map((t) => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="ghost"
                                    disabled={actionBusy === `assign-${request.id}` || !trainerAssignment[request.id]}
                                    onClick={() => handleAssignTrainer(request.id)}
                                  >
                                    Assign
                                  </button>
                                </div>
                              ) : null}
                              {request.status === "approved" && !quote ? (
                                <button
                                  type="button"
                                  className="ghost"
                                  disabled={actionBusy === `quote-${request.id}`}
                                  onClick={() => issueQuote(request.id)}
                                >
                                  Create Quote
                                </button>
                              ) : null}
                              {request.status === "approved" &&
                              request.researcher_id &&
                              quote &&
                              quote.status === "approved" &&
                              invoice &&
                              invoice.payment_verification_status === "verified" &&
                              !plans.some((plan) => plan.request_id === request.id) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSchedulingRequest(request);
                                    setScheduleForm({
                                      start_date: "",
                                      end_date: "",
                                      location: "",
                                      customized_outline: "",
                                    });
                                  }}
                                >
                                  Schedule Training
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredRequests.length === 0 ? (
                <EmptyState compact icon="inbox" title="No training requests yet" description="Organization requests will appear here after intake." />
              ) : null}
            </article>

            <article className="card">
              <h3>Setup and Capacity</h3>
              <div className="list compact">
                <div className="list-row">
                  <div>
                    <strong>Organizations</strong>
                    <p>Configured client organizations in the training service.</p>
                  </div>
                  <span className="metric-pill">{organizations.length}</span>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Internal Researchers</strong>
                    <p>Training researchers available for assignments.</p>
                  </div>
                  <span className="metric-pill">{trainers.length}</span>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Configured Packages</strong>
                    <p>Commercial package definitions and pricing profiles.</p>
                  </div>
                  <span className="metric-pill">{packages.length}</span>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Payment Verification Queue</strong>
                    <p>Invoices waiting for finance/admin verification.</p>
                  </div>
                  <span className="metric-pill">{kpis.invoicesPendingVerification}</span>
                </div>
              </div>

              <h3 className="subhead">Recent Plans</h3>
              <div className="list compact">
                {plans.slice(0, 8).map((plan) => (
                  <div key={plan.id} className="list-row">
                    <div>
                      <strong>{plan.id.slice(0, 8)}</strong>
                      <p>{plan.start_date} to {plan.end_date}</p>
                      <p>{plan.location}</p>
                    </div>
                    <StatusBadge status="scheduled" />
                  </div>
                ))}
                {plans.length === 0 ? (
                  <EmptyState compact icon="spark" title="No training plans created yet" description="Plans appear after request approval and payment verification." />
                ) : null}
              </div>
            </article>
          </section>

          <section className="card">
            <article>
              <h3>Create Package Pricing</h3>
              <p className="section-intro">Define commercial package templates used for quote and invoice generation.</p>
              <form onSubmit={createPackage}>
                <label className="field-label">Package Type</label>
                <select value={packageForm.package_type} onChange={(event) => setPackageForm((prev) => ({ ...prev, package_type: event.target.value }))}>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                </select>
                <label className="field-label">Display Name</label>
                <input placeholder="Security Awareness Sprint" value={packageForm.display_name} onChange={(event) => setPackageForm((prev) => ({ ...prev, display_name: event.target.value }))} />
                <label className="field-label">Description</label>
                <textarea rows={3} placeholder="Outline training scope, depth, and expected learning outcomes." value={packageForm.description} onChange={(event) => setPackageForm((prev) => ({ ...prev, description: event.target.value }))} />
                <label className="field-label">Duration (Days)</label>
                <input type="number" min="1" placeholder="2" value={packageForm.duration_days} onChange={(event) => setPackageForm((prev) => ({ ...prev, duration_days: event.target.value }))} />
                <label className="field-label">Base Price (ETB)</label>
                <input type="number" min="0" placeholder="75000" value={packageForm.base_price_etb} onChange={(event) => setPackageForm((prev) => ({ ...prev, base_price_etb: event.target.value }))} />
                <label className="field-label">Per Participant (ETB)</label>
                <input type="number" min="0" placeholder="3500" value={packageForm.per_participant_etb} onChange={(event) => setPackageForm((prev) => ({ ...prev, per_participant_etb: event.target.value }))} />
                <button type="submit" disabled={actionBusy === "create-package"}>{actionBusy === "create-package" ? "Saving..." : "Save Package"}</button>
                {actionBusy !== "create-package" && toast && toast.includes("package") && (
                  <div className="notice success" style={{ marginTop: "10px" }}>✓ {toast}</div>
                )}
                {actionBusy !== "create-package" && error && (
                  <div className="notice error" style={{ marginTop: "10px" }}>{error}</div>
                )}
              </form>
            </article>
          </section>

          <section className="grid two">
            <article className="card">
              <h3>Commercial Quotes</h3>
              <p className="section-intro">Total quoted: {formatCurrency(kpis.totalQuoted)}</p>
              <div className="list compact">
                {quotes.slice(0, 20).map((quote) => (
                  <div key={quote.id} className="list-row">
                    <div>
                      <strong>{quote.id.slice(0, 8)}</strong>
                      <p>{quote.package_type} • {quote.number_of_participants} participants</p>
                      <p>{formatCurrency(quote.total_price_etb)}</p>
                    </div>
                    <StatusBadge status={quote.status} />
                  </div>
                ))}
                {quotes.length === 0 ? (
                  <EmptyState compact icon="inbox" title="No quotes generated yet" description="Quotes appear when approved requests move to commercial preparation." />
                ) : null}
              </div>
            </article>

            <article className="card">
              <h3>Invoices</h3>
              <p className="section-intro">Total invoiced: {formatCurrency(kpis.totalInvoiced)}</p>
              <div className="list compact">
                {invoices.slice(0, 20).map((invoice) => (
                  <div key={invoice.id} className="list-row">
                    <div>
                      <strong>{invoice.invoice_number}</strong>
                      <p>{formatCurrency(invoice.amount_etb)}</p>
                      <p>Receipt: {invoice.receipt_reference || "not uploaded"}</p>
                    </div>
                    <div className="badge-stack">
                      <StatusBadge status={invoice.status} />
                      <StatusBadge status={invoice.payment_verification_status} />
                      {invoice.payment_verification_status === "pending" ? (
                        <button
                          type="button"
                          className="ghost"
                          disabled={actionBusy === `verify-${invoice.id}`}
                          onClick={() => handleVerifyPayment(invoice.id)}
                        >
                          {actionBusy === `verify-${invoice.id}` ? "Verifying..." : "Verify Payment"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {invoices.length === 0 ? (
                  <EmptyState compact icon="inbox" title="No invoices issued yet" description="Invoices are generated after quote approval." />
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : (
        <section className="card">
          <EmptyState
            icon="shield"
            title="Connect training admin session"
            description="Click 'Connect Training' to bootstrap your platform session into the training workspace."
          />
        </section>
      )}
      {schedulingRequest ? (
        <div className="modal-backdrop" onClick={() => setSchedulingRequest(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Schedule Training Plan</h3>
            <p className="section-intro" style={{ marginBottom: 12 }}>
              Set the official dates, location, and customize the outline for Request ID: {schedulingRequest.id.slice(0, 8)}
            </p>
            <form onSubmit={handleScheduleTraining}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="field-label">Start Date</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.start_date}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label">End Date</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.end_date}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Training Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme HQ, Meeting Room A"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label">Custom Outline / Notes</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Details about the topics, focus areas, and schedule..."
                  value={scheduleForm.customized_outline}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, customized_outline: e.target.value }))}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={() => setSchedulingRequest(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={actionBusy === `schedule-${schedulingRequest.id}`}>
                  {actionBusy === `schedule-${schedulingRequest.id}` ? "Scheduling..." : "Create Plan & Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
