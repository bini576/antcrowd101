import { useEffect, useMemo, useState } from "react";
import {
  createTrainingRequest,
  listReports,
  listTrainingInvoices,
  listTrainingPlans,
  listTrainingPackages,
  listTrainingQuotes,
  listTrainingRequests,
  submitReportFeedback,
  updateTrainingQuoteStatus,
  uploadInvoiceReceipt
} from "@shared-api/training";
import EmptyState from "@shared-ui/EmptyState";
import PortalNavbar from "@shared-ui/PortalNavbar";
import StatusBadge from "@shared-ui/StatusBadge";
import { brandAssets } from "@ant-ui";

const TEMPLATE_KEY = "org_training_request_templates";

function loadTemplates() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTemplates(templates) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
}

function requestCode(req) {
  const day = String(new Date(req.created_at).getDate()).padStart(2, "0");
  return `TRN-${new Date(req.created_at).getFullYear()}-${day}-${req.id.slice(0, 6).toUpperCase()}`;
}

function compactCode(prefix, value) {
  if (!value) return "-";
  return `${prefix}-${String(value).slice(0, 6).toUpperCase()}`;
}

function timelineFor(req, quote) {
  return [
    { label: "Requested", done: true },
    { label: "Admin Review", done: ["approved", "scheduled", "completed"].includes(req.status) },
    { label: "Quotation", done: !!quote },
    { label: "Quotation Approved", done: quote?.status === "approved" },
    { label: "Scheduled", done: ["scheduled", "completed"].includes(req.status) },
    { label: "Completed", done: req.status === "completed" }
  ];
}

function parseApiError(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((x) => x?.msg).filter(Boolean).join("; ") || fallback;
  }
  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof err?.response?.data?.message === "string" && err.response.data.message.trim()) return err.response.data.message;
  return fallback;
}

function getRequestStage(req, quote, invoice, hasPlan, hasReport) {
  if (req.status === "rejected") return "rejected";
  if (hasReport || req.status === "completed") return "delivered";
  if (hasPlan || req.status === "scheduled") return "scheduled";
  if (invoice?.payment_verification_status === "verified") return "payment_verified";
  if (invoice?.status === "unpaid" || invoice?.payment_verification_status === "pending") return "payment_pending";
  if (quote?.status === "approved") return "quote_approved";
  if (quote?.status === "sent") return "quote_sent";
  if (req.status === "approved") return "under_preparation";
  return "requested";
}

function Input(props) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition",
        "focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20",
        props.className || ""
      ].join(" ")}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition",
        "focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20",
        props.className || ""
      ].join(" ")}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-[110px] w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition",
        "focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20",
        props.className || ""
      ].join(" ")}
    />
  );
}

function StepBadge({ done, children }) {
  return (
    <span
      className={[
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        done ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-900 text-slate-300"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export default function OrganizationDashboard() {
  const user = JSON.parse(localStorage.getItem("auth_user") || "null");
  const [requests, setRequests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState(loadTemplates());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedQuote, setSelectedQuote] = useState(null);

  const [formData, setFormData] = useState({
    organization_id: user?.organization_id || "",
    package_type: "basic",
    number_of_participants: 10,
    preferred_date: "",
    special_focus: "",
    location: "Addis Ababa",
    compliance_needs: ""
  });

  const [templateName, setTemplateName] = useState("");
  const [receiptForms, setReceiptForms] = useState({});
  const [feedbackForms, setFeedbackForms] = useState({});

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [requestData, packageData, quoteData, invoiceData, planData, reportData] = await Promise.all([
        listTrainingRequests(),
        listTrainingPackages(),
        listTrainingQuotes(),
        listTrainingInvoices(),
        listTrainingPlans(),
        listReports()
      ]);
      setRequests(requestData);
      setPackages(packageData);
      setQuotes(quoteData);
      setInvoices(invoiceData);
      setPlans(planData);
      setReports(reportData);
    } catch (err) {
      setError(parseApiError(err, "Failed to load training workspace"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    if (!success) return undefined;
    const timer = window.setTimeout(() => setSuccess(""), 3200);
    return () => window.clearTimeout(timer);
  }, [success]);

  const quotesByRequest = useMemo(() => {
    const map = new Map();
    quotes.forEach((quote) => map.set(quote.request_id, quote));
    return map;
  }, [quotes]);

  const pendingActions = useMemo(() => {
    const actions = [];
    requests.forEach((req) => {
      const quote = quotesByRequest.get(req.id);
      const invoice = quote ? invoices.find((item) => item.quote_id === quote.id) : null;
      if (quote?.status === "sent") actions.push({ type: "quote", request: req, quote });
      if (invoice?.payment_verification_status === "rejected") actions.push({ type: "receipt", request: req, invoice });
      if (invoice?.status === "unpaid" && !invoice?.receipt_reference) actions.push({ type: "receipt", request: req, invoice });
    });
    return actions;
  }, [requests, quotesByRequest, invoices]);

  const planByRequest = useMemo(() => {
    const map = new Map();
    plans.forEach((plan) => map.set(plan.request_id, plan));
    return map;
  }, [plans]);

  const reportByPlan = useMemo(() => {
    const map = new Map();
    reports.forEach((report) => map.set(report.training_plan_id, report));
    return map;
  }, [reports]);

  const kpis = useMemo(() => {
    const totalRequests = requests.length;
    const activePrograms = requests.filter((req) => ["approved", "scheduled"].includes(req.status)).length;
    const deliveredPrograms = requests.filter((req) => req.status === "completed").length;
    const pendingApprovals = pendingActions.filter((item) => item.type === "quote").length;
    return { totalRequests, activePrograms, deliveredPrograms, pendingApprovals };
  }, [requests, pendingActions]);
  const wizardProgress = Math.round((wizardStep / 3) * 100);

  function resetWizard() {
    setFormData((prev) => ({
      ...prev,
      preferred_date: "",
      special_focus: "",
      compliance_needs: "",
      package_type: "basic",
      number_of_participants: 10
    }));
    setWizardStep(1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!formData.organization_id) {
      setError("Organization session is missing. Please login again from this organization portal.");
      return;
    }

    try {
      const payload = {
        organization_id: formData.organization_id,
        package_type: formData.package_type,
        number_of_participants: formData.number_of_participants,
        preferred_date: formData.preferred_date,
        special_focus: [
          formData.special_focus,
          formData.location ? `Location: ${formData.location}` : "",
          formData.compliance_needs ? `Compliance: ${formData.compliance_needs}` : ""
        ]
          .filter(Boolean)
          .join(" | ")
      };

      await createTrainingRequest(payload);
      setSuccess("Training request submitted successfully");
      resetWizard();
      loadWorkspace();
    } catch (err) {
      setError(parseApiError(err, "Failed to submit request"));
    }
  }

  function saveCurrentAsTemplate() {
    if (!templateName.trim()) {
      setError("Give template a name before saving");
      return;
    }
    const next = [{ name: templateName.trim(), data: formData }, ...templates].slice(0, 8);
    setTemplates(next);
    saveTemplates(next);
    setTemplateName("");
    setSuccess("Template saved");
  }

  function applyTemplate(template) {
    setFormData({ ...template.data, organization_id: user?.organization_id || formData.organization_id });
    setSuccess(`Template loaded: ${template.name}`);
    setWizardStep(1);
  }

  async function handleQuoteDecision(quoteId, status) {
    setError("");
    setSuccess("");
    try {
      await updateTrainingQuoteStatus(quoteId, status);
      setSuccess(`Quotation ${status}`);
      loadWorkspace();
    } catch (err) {
      setError(parseApiError(err, "Failed to update quote status"));
    }
  }

  async function handleUploadReceipt(invoiceId) {
    const form = receiptForms[invoiceId] || {};
    if (!form.receipt_reference) {
      setError("Add receipt reference before uploading");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await uploadInvoiceReceipt(invoiceId, {
        receipt_reference: form.receipt_reference,
        receipt_note: form.receipt_note || ""
      });
      setSuccess("Payment receipt uploaded for verification");
      setReceiptForms((prev) => ({ ...prev, [invoiceId]: { receipt_reference: "", receipt_note: "" } }));
      loadWorkspace();
    } catch (err) {
      setError(parseApiError(err, "Failed to upload receipt"));
    }
  }

  async function handleSubmitFeedback(reportId) {
    const form = feedbackForms[reportId] || {};
    if (!form.organization_rating || !form.organization_feedback) {
      setError("Please provide both rating and feedback");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await submitReportFeedback(reportId, {
        organization_rating: Number(form.organization_rating),
        organization_feedback: form.organization_feedback
      });
      setSuccess("Feedback submitted");
      loadWorkspace();
    } catch (err) {
      setError(parseApiError(err, "Failed to submit feedback"));
    }
  }

  function requestFollowUp(req) {
    setFormData((prev) => ({
      ...prev,
      package_type: req.package_type,
      number_of_participants: req.number_of_participants,
      special_focus: `Follow-up training for ${requestCode(req)}: `,
      preferred_date: ""
    }));
    setWizardStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSuccess(`Follow-up request prefilled from ${requestCode(req)}`);
  }

  const packageOptions = packages.filter((item) => ["basic", "premium"].includes(item.package_type));

  const linkStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "none",
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
    cursor: "pointer"
  };

  const handleLogout = () => {
    clearSession();
    const base = (import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173").replace(/\/$/, "");
    window.location.assign(base + "/login");
  };

  return (
    <div className="app-shell" style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "Inter, -apple-system, sans-serif" }}>
      {/* Left Sidebar aside */}
      <aside style={{ position: "sticky", top: 0, height: "100vh", background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #334155" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", cursor: "pointer" }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span style={{ color: "#f59e0b", fontWeight: "800", fontSize: "1.25rem", letterSpacing: "-0.025em" }}>AntCrowd</span>
          </div>
          <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#64748b", margin: "4px 0 0 0" }}>TRAINING</p>
        </div>
        <nav style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <button type="button" style={linkStyle} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span style={{ fontSize: "16px" }}>📊</span> Dashboard
          </button>
          <button type="button" style={linkStyle} onClick={() => window.scrollTo({ top: 480, behavior: "smooth" })}>
            <span style={{ fontSize: "16px" }}>📝</span> Create Request
          </button>
          <button type="button" style={linkStyle} onClick={() => window.scrollTo({ top: 680, behavior: "smooth" })}>
            <span style={{ fontSize: "16px" }}>⏳</span> Timeline
          </button>
          <button type="button" style={linkStyle} onClick={() => window.scrollTo({ top: 840, behavior: "smooth" })}>
            <span style={{ fontSize: "16px" }}>📁</span> Reports
          </button>
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid #334155", fontSize: "12px", color: "#64748b" }}>
          <button
            type="button"
            onClick={handleLogout}
            style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", padding: 0 }}
          >
            ↪ Sign Out
          </button>
        </div>
      </aside>

      {/* Content wrapper */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", overflowX: "hidden" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 20, height: "60px", borderBottom: "1px solid #334155", backgroundColor: "#1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", margin: 0 }}>Organization &mdash; Security Training Service</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span className="text-sm font-semibold text-slate-300">organization admin</span>
            <button onClick={handleLogout} style={{ padding: "8px 16px", background: "#334155", color: "#f1f5f9", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Exit</button>
          </div>
        </header>

        <main style={{ flex: 1, width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
          {!formData.organization_id && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
              Session is incomplete (missing organization id). Please sign out and log in again as an organization user.
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
              {success}
            </div>
          )}

      <section className="mb-6 overflow-hidden rounded-[1.75rem] border border-slate-800 bg-[radial-gradient(circle_at_90%_0%,rgba(245,158,11,0.15),transparent_24%),linear-gradient(135deg,#0f172a_0%,#111827_55%,#0b1220_100%)] shadow-[0_24px_70px_rgba(2,6,23,0.42)]">
        <div className="grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Organization Workspace</p>
            <h2 className="mt-2 font-space text-3xl font-bold text-white">Security Training Lifecycle</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-200">
              Request tailored in-person programs, approve ETB quotations, upload payment proof,
              and track delivery from request to completion.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Total Requests</p>
              <p className="mt-1 text-2xl font-bold text-white">{kpis.totalRequests}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Active Programs</p>
              <p className="mt-1 text-2xl font-bold text-white">{kpis.activePrograms}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Delivered</p>
              <p className="mt-1 text-2xl font-bold text-white">{kpis.deliveredPrograms}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Pending Approvals</p>
              <p className="mt-1 text-2xl font-bold text-white">{kpis.pendingApprovals}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Pending Actions</h3>
          {pendingActions.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon="shield"
                title="No pending actions right now"
                description="Approvals, payment requests, and follow-up tasks will appear here."
                compact
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {pendingActions.slice(0, 6).map((item, idx) => (
                <div key={`${item.type}-${idx}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="font-semibold text-white">{requestCode(item.request)}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {item.type === "quote"
                      ? "Quotation is waiting for your approval."
                      : "Invoice requires payment receipt upload or re-upload."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Request Templates</h3>
          <p className="mt-1 text-sm text-slate-300">
            Save common request settings to speed up repeat submissions.
          </p>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Template name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={saveCurrentAsTemplate}
            >
              Save Current Form as Template
            </button>
            {templates.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No templates saved yet"
                description="Save reusable request templates to speed up repeat submissions."
                compact
              />
            ) : (
              templates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="inline-flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-left text-sm font-medium text-slate-200 transition hover:border-amber-400/40 hover:text-amber-200"
                >
                  <span>{template.name}</span>
                  <span className="text-xs text-slate-500">Load</span>
                </button>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-space text-xl font-bold text-white">Create Training Request</h3>
            <p className="text-sm text-slate-300">A guided workflow to submit complete and accurate requests.</p>
            <div className="mt-3 w-full max-w-md">
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${wizardProgress}%` }} />
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Step {wizardStep} of 3 · {wizardProgress}% complete</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((step) => (
              <button
                key={step}
                type="button"
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  wizardStep === step
                    ? "bg-amber-500 text-[#0f172a] font-bold"
                    : "bg-slate-900/70 text-slate-200 hover:border-amber-400/40 hover:text-amber-200"
                ].join(" ")}
                onClick={() => setWizardStep(step)}
              >
                {step === 1 ? "1. Package" : step === 2 ? "2. Goals" : "3. Schedule"}
              </button>
            ))}
          </div>
        </div>

        <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
            {wizardStep === 1 && "Choose the package and review pricing before moving forward."}
            {wizardStep === 2 && "Capture training objectives, participant profile, and compliance needs."}
            {wizardStep === 3 && "Confirm preferred date and review request details before submitting."}
          </div>
          {wizardStep === 1 && (
            <div className="space-y-4">
              <Select
                value={formData.package_type}
                onChange={(e) => setFormData((prev) => ({ ...prev, package_type: e.target.value }))}
                required
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </Select>

              {packageOptions.length === 0 ? (
                <EmptyState
                  icon="inbox"
                  title="Package pricing is not configured yet"
                  description="Ask the platform admin to configure Basic and Premium pricing profiles."
                  compact
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {packageOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, package_type: item.package_type }))}
                      className={[
                        "rounded-xl border p-4 text-left transition",
                        formData.package_type === item.package_type
                          ? "border-amber-400 bg-amber-500/10"
                          : "border-slate-800 bg-slate-900/70 hover:border-amber-400/35"
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-white">{item.display_name}</p>
                        <span className="rounded-full bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-300">
                          {item.duration_days} days
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                        <p className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                          Base: <strong>{item.base_price_etb.toLocaleString()} ETB</strong>
                        </p>
                        <p className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                          Per participant: <strong>{item.per_participant_etb.toLocaleString()} ETB</strong>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {wizardStep === 2 && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-1">
                <span className="text-sm font-semibold text-slate-200">Number of Participants</span>
                <Input
                  type="number"
                  min="1"
                  value={formData.number_of_participants}
                  onChange={(e) => setFormData((prev) => ({ ...prev, number_of_participants: Number(e.target.value) }))}
                  required
                />
              </label>

              <label className="space-y-1.5 md:col-span-1">
                <span className="text-sm font-semibold text-slate-200">Location</span>
                <Input
                  placeholder="Addis Ababa"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-slate-200">Training Objectives and Focus</span>
                <TextArea
                  placeholder="Describe use-cases, skill gaps, and expected outcomes."
                  value={formData.special_focus}
                  onChange={(e) => setFormData((prev) => ({ ...prev, special_focus: e.target.value }))}
                />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-slate-200">Compliance Needs (optional)</span>
                <Input
                  placeholder="ISO 27001, PCI DSS, secure SDLC alignment..."
                  value={formData.compliance_needs}
                  onChange={(e) => setFormData((prev) => ({ ...prev, compliance_needs: e.target.value }))}
                />
              </label>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-200">Preferred Date</span>
                <Input
                  type="date"
                  value={formData.preferred_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, preferred_date: e.target.value }))}
                  required
                />
              </label>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">Request Summary</p>
                <p className="mt-2">
                  Package: <strong className="capitalize">{formData.package_type}</strong>
                </p>
                <p>
                  Participants: <strong>{formData.number_of_participants}</strong>
                </p>
                <p>
                  Date: <strong>{formData.preferred_date || "-"}</strong>
                </p>
                <p>
                  Location: <strong>{formData.location || "-"}</strong>
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {wizardStep > 1 && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-amber-400/40 hover:text-amber-200"
                onClick={() => setWizardStep((s) => s - 1)}
              >
                Back
              </button>
            )}
            {wizardStep < 3 && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#0f172a] transition hover:bg-amber-600"
                onClick={() => setWizardStep((s) => s + 1)}
              >
                Next
              </button>
            )}
            {wizardStep === 3 && (
              <button
                type="submit"
                disabled={!formData.organization_id}
                className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#0f172a] transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit Training Request
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
        <h3 className="font-space text-xl font-bold text-white">Requests and Workflow Timeline</h3>
        {loading ? (
          <div className="mt-4 space-y-3">
              <div className="h-24 animate-pulse rounded-xl bg-slate-900/70" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-900/70" />
          </div>
        ) : requests.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="spark"
              title="No requests found yet"
              description="Submit your first training request using the guided wizard above."
              compact
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {requests.map((request) => {
              const quote = quotesByRequest.get(request.id);
              const invoice = quote ? invoices.find((item) => item.quote_id === quote.id) : null;
              const plan = planByRequest.get(request.id);
              const report = plan ? reportByPlan.get(plan.id) : null;
              const steps = timelineFor(request, quote);
              const stage = getRequestStage(request, quote, invoice, Boolean(plan), Boolean(report));

              return (
                <article key={request.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-white">{requestCode(request)}</strong>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      <StatusBadge status={stage} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="capitalize">{request.package_type}</span> | {request.number_of_participants} participants | preferred: {request.preferred_date}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {steps.map((step) => (
                      <StepBadge key={step.label} done={step.done}>
                        {step.label}
                      </StepBadge>
                    ))}
                  </div>

                  {quote && (
                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-slate-300">
                          Quotation: <strong>{quote.total_price_etb.toLocaleString()} ETB</strong>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={quote.status} />
                          <button
                            type="button"
                            className="inline-flex rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-400/40 hover:text-amber-200"
                            onClick={() => setSelectedQuote(quote)}
                          >
                            View Breakdown
                          </button>
                        </div>
                      </div>
                      {quote.status === "sent" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="inline-flex rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#0f172a] transition hover:bg-amber-600"
                            onClick={() => handleQuoteDecision(quote.id, "approved")}
                          >
                            Approve Quotation
                          </button>
                          <button
                            type="button"
                            className="inline-flex rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                            onClick={() => handleQuoteDecision(quote.id, "rejected")}
                          >
                            Reject Quotation
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {invoice && (
                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-slate-300">
                          Invoice {invoice.invoice_number}: <strong>{invoice.amount_etb.toLocaleString()} ETB</strong>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={invoice.status} />
                          <StatusBadge status={invoice.payment_verification_status} />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <Input
                          placeholder="Payment receipt reference (bank transfer code or URL)"
                          value={receiptForms[invoice.id]?.receipt_reference || ""}
                          onChange={(e) =>
                            setReceiptForms((prev) => ({
                              ...prev,
                              [invoice.id]: { ...(prev[invoice.id] || {}), receipt_reference: e.target.value }
                            }))
                          }
                        />
                        <TextArea
                          placeholder="Payment note (optional)"
                          value={receiptForms[invoice.id]?.receipt_note || ""}
                          onChange={(e) =>
                            setReceiptForms((prev) => ({
                              ...prev,
                              [invoice.id]: { ...(prev[invoice.id] || {}), receipt_note: e.target.value }
                            }))
                          }
                          className="min-h-[90px]"
                        />
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                          onClick={() => handleUploadReceipt(invoice.id)}
                        >
                          Upload Payment Receipt
                        </button>
                      </div>
                    </div>
                  )}

                  {plan && (
                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400">Scheduled Training Details</h4>
                      <div className="mt-2 grid gap-1.5 text-sm text-slate-300">
                        <p>🗓️ <strong>Dates:</strong> {plan.start_date} to {plan.end_date}</p>
                        <p>📍 <strong>Location:</strong> {plan.location}</p>
                        <p>📝 <strong>Customized Outline:</strong></p>
                        <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-900/50 p-2 text-xs text-slate-400 font-mono">
                          {plan.customized_outline}
                        </p>
                      </div>
                    </div>
                  )}

                  {request.status === "completed" && (
                    <button
                      type="button"
                      className="mt-4 inline-flex rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400/40 hover:text-amber-200"
                      onClick={() => requestFollowUp(request)}
                    >
                      Request Follow-up Session
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
        <h3 className="font-space text-xl font-bold text-white">Completed Programs and Reports</h3>
        {reports.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="inbox"
              title="No reports available yet"
              description="Completed program reports will appear once internal researchers submit delivery outcomes."
              compact
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {reports.map((report) => (
              <article key={report.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="font-semibold text-white">
                  Report {compactCode("RPT", report.id)} | Plan {compactCode("PLN", report.training_plan_id)}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  <strong>Summary:</strong> {report.summary}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  <strong>Recommendations:</strong> {report.recommendations}
                </p>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800 pt-4">
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">Satisfaction Score</span>
                    <strong className="block text-lg text-amber-400 mt-1">{report.satisfaction_score ?? 0} / 10</strong>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">Attendance Rate</span>
                    <strong className="block text-lg text-emerald-400 mt-1">{report.attendance_rate ?? 0}%</strong>
                  </div>
                  <div className="col-span-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">Knowledge Assessment Improvement</span>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Pre-test: {report.pre_assessment_score ?? 0}%</span>
                        <span className="font-semibold text-indigo-400">Post-test: {report.post_assessment_score ?? 0}%</span>
                      </div>
                      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-slate-600 rounded-full" 
                          style={{ width: `${report.pre_assessment_score ?? 0}%` }}
                        />
                        <div 
                          className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full opacity-70" 
                          style={{ width: `${report.post_assessment_score ?? 0}%` }}
                        />
                      </div>
                      <span className="block text-[10px] text-slate-400 mt-1 text-right font-medium">
                        +{Math.max(0, (report.post_assessment_score ?? 0) - (report.pre_assessment_score ?? 0))} pts increase
                      </span>
                    </div>
                  </div>
                </div>


                {report.organization_feedback ? (
                  <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                    Your feedback: {report.organization_rating}/5 - {report.organization_feedback}
                  </p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-200">Organization rating (1 to 5)</span>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        value={feedbackForms[report.id]?.organization_rating || ""}
                        onChange={(e) =>
                          setFeedbackForms((prev) => ({
                            ...prev,
                            [report.id]: { ...(prev[report.id] || {}), organization_rating: e.target.value }
                          }))
                        }
                      />
                    </label>
                    <TextArea
                      placeholder="Share feedback about the training quality and impact"
                      value={feedbackForms[report.id]?.organization_feedback || ""}
                      onChange={(e) =>
                        setFeedbackForms((prev) => ({
                          ...prev,
                          [report.id]: { ...(prev[report.id] || {}), organization_feedback: e.target.value }
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-[#0f172a] transition hover:bg-amber-600"
                      onClick={() => handleSubmitFeedback(report.id)}
                    >
                      Submit Feedback
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedQuote && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-8">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-300 shadow-2xl">
            <h3 className="font-space text-xl font-bold text-white">Quotation Breakdown</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>Request ID: {compactCode("TRN", selectedQuote.request_id)}</p>
              <p>Base Price: {selectedQuote.base_price_etb.toLocaleString()} ETB</p>
              <p>Per Participant: {selectedQuote.per_participant_etb.toLocaleString()} ETB</p>
              <p>Participants: {selectedQuote.number_of_participants}</p>
              <p className="font-semibold text-white">
                Total: {selectedQuote.total_price_etb.toLocaleString()} ETB
              </p>
            </div>
            <button
              type="button"
              className="mt-4 inline-flex rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#0f172a] transition hover:bg-amber-400"
              onClick={() => setSelectedQuote(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
