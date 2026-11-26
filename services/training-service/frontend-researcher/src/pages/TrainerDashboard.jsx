import { useEffect, useMemo, useState } from "react";
import { createReport, listReports, listTrainingPlans, listTrainingRequests } from "@shared-api/training";
import EmptyState from "@shared-ui/EmptyState";
import PortalNavbar from "@shared-ui/PortalNavbar";
import StatusBadge from "@shared-ui/StatusBadge";
import { brandAssets } from "@ant-ui";
import { clearSession } from "@shared-session/session";

function parseApiError(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg).filter(Boolean).join("; ") || fallback;
  }
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  return fallback;
}

function compactCode(prefix, value) {
  if (!value) return "-";
  return `${prefix}-${String(value).slice(0, 6).toUpperCase()}`;
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
        "min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition",
        "focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20",
        props.className || ""
      ].join(" ")}
    />
  );
}

export default function TrainerDashboard() {
  const [plans, setPlans] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportFiles, setReportFiles] = useState([]);

  const [reportForm, setReportForm] = useState({
    training_plan_id: "",
    summary: "",
    weaknesses_found: "",
    recommendations: "",
    satisfaction_score: 8,
    pre_assessment_score: 0,
    post_assessment_score: 0,
    attendance_rate: 0
  });

  async function loadData() {
    setError("");
    setLoading(true);
    try {
      const [requestData, planData, reportData] = await Promise.all([
        listTrainingRequests(),
        listTrainingPlans(),
        listReports()
      ]);
      setRequests(requestData);
      setPlans(planData);
      setReports(reportData);
    } catch (err) {
      setError(parseApiError(err, "Failed to load researcher data"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!success) return undefined;
    const timer = window.setTimeout(() => setSuccess(""), 3200);
    return () => window.clearTimeout(timer);
  }, [success]);

  const reportedPlanIds = useMemo(() => new Set(reports.map((item) => item.training_plan_id)), [reports]);
  const requestById = useMemo(() => {
    const map = new Map();
    requests.forEach((request) => map.set(request.id, request));
    return map;
  }, [requests]);
  const eligiblePlans = useMemo(
    () => plans.filter((plan) => requestById.get(plan.request_id)?.status === "scheduled"),
    [plans, requestById]
  );
  const availablePlans = useMemo(
    () => eligiblePlans.filter((plan) => !reportedPlanIds.has(plan.id)),
    [eligiblePlans, reportedPlanIds]
  );

  const kpis = useMemo(
    () => ({
      assignedRequests: requests.length,
      assignedPlans: plans.length,
      readyToReport: availablePlans.length,
      submittedReports: reports.length,
      avgImprovement: reports.length
        ? (
          reports.reduce(
            (sum, item) => sum + Math.max(0, Number(item.post_assessment_score || 0) - Number(item.pre_assessment_score || 0)),
            0
          ) / reports.length
        ).toFixed(1)
        : "0.0"
    }),
    [requests, plans, availablePlans, reports]
  );

  useEffect(() => {
    setReportForm((prev) => {
      if (!availablePlans.length && prev.training_plan_id) {
        return { ...prev, training_plan_id: "" };
      }
      if (prev.training_plan_id && availablePlans.some((plan) => plan.id === prev.training_plan_id)) {
        return prev;
      }
      return { ...prev, training_plan_id: availablePlans[0]?.id || "" };
    });
  }, [availablePlans]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!reportForm.training_plan_id) {
      setError("No scheduled training plan is ready for reporting yet.");
      return;
    }
    if (reportForm.post_assessment_score < reportForm.pre_assessment_score) {
      setError("Post-assessment score must be greater than or equal to pre-assessment score.");
      return;
    }
    setSubmitting(true);

    try {
      const evidenceNames = reportFiles.map((file) => file.name).join(", ");
      const payload = {
        ...reportForm,
        recommendations: evidenceNames
          ? `${reportForm.recommendations}\n\nSupporting evidence files: ${evidenceNames}`
          : reportForm.recommendations
      };
      await createReport(payload);
      setReportForm({
        training_plan_id: "",
        summary: "",
        weaknesses_found: "",
        recommendations: "",
        satisfaction_score: 8,
        pre_assessment_score: 0,
        post_assessment_score: 0,
        attendance_rate: 0
      });
      setReportFiles([]);
      setSuccess("Training report submitted");
      await loadData();
    } catch (err) {
      setError(parseApiError(err, "Failed to submit report"));
    } finally {
      setSubmitting(false);
    }
  }

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
          <button type="button" style={linkStyle} onClick={() => window.scrollTo({ top: 250, behavior: "smooth" })}>
            <span style={{ fontSize: "16px" }}>📬</span> Assigned Requests
          </button>
          <button type="button" style={linkStyle} onClick={() => window.scrollTo({ top: 290, behavior: "smooth" })}>
            <span style={{ fontSize: "16px" }}>📂</span> Assigned Plans
          </button>
          <button type="button" style={linkStyle} onClick={() => window.scrollTo({ top: 320, behavior: "smooth" })}>
            <span style={{ fontSize: "16px" }}>📝</span> Submit Report
          </button>
          <button type="button" style={linkStyle} onClick={() => window.scrollTo({ top: 490, behavior: "smooth" })}>
            <span style={{ fontSize: "16px" }}>📁</span> Submitted Reports
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
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", margin: 0 }}>Researcher &mdash; Security Training Service</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span className="text-sm font-semibold text-slate-300">internal researcher</span>
            <button onClick={handleLogout} style={{ padding: "8px 16px", background: "#334155", color: "#f1f5f9", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Exit</button>
          </div>
        </header>

        <main style={{ flex: 1, width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Researcher Console</p>
            <h2 className="mt-2 font-space text-3xl font-bold text-white">Deliver High-Signal Training Outcomes</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-200">
              Review assigned programs, run sessions, and submit evidence-driven reports with measurable improvements.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Assigned Requests</p>
              <p className="mt-1 text-2xl font-bold text-white">{kpis.assignedRequests}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Assigned Plans</p>
              <p className="mt-1 text-2xl font-bold text-white">{kpis.assignedPlans}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Ready To Report</p>
              <p className="mt-1 text-2xl font-bold text-white">{kpis.readyToReport}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-slate-200">Avg Improvement</p>
              <p className="mt-1 text-2xl font-bold text-white">{kpis.avgImprovement} pts</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Assigned Requests</h3>
          {loading ? (
            <div className="mt-4 space-y-3">
              <div className="h-20 animate-pulse rounded-xl bg-slate-900/70" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-900/70" />
            </div>
          ) : requests.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon="users"
                title="No assigned requests yet"
                description="New organization requests will appear here after assignment."
                compact
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">{request.organization_name || "Organization"}</p>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    <span className="capitalize">{request.package_type}</span> package · {request.number_of_participants} participants · preferred {request.preferred_date}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Contact: {request.organization_contact_person || "-"} ({request.organization_contact_email || "-"})
                  </p>
                  <p className="mt-1 text-sm text-slate-300">Sector: {request.organization_sector || "-"}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Assigned Plans</h3>
          {loading ? (
            <div className="mt-4 space-y-3">
              <div className="h-20 animate-pulse rounded-xl bg-slate-900/70" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-900/70" />
            </div>
          ) : plans.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon="shield"
                title="No assigned plans found"
                description="Plans appear here after admin scheduling and payment verification."
                compact
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {plans.map((plan) => {
                const req = requestById.get(plan.request_id);
                return (
                  <div key={plan.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="font-semibold text-white">{req?.organization_name || "Organization"}</p>
                    <p className="mt-2 text-sm text-slate-300">{plan.start_date} to {plan.end_date} · {plan.location}</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Contact: {req?.organization_contact_person || "-"} ({req?.organization_contact_email || "-"})
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
        <h3 className="font-space text-xl font-bold text-white">Submit Training Report</h3>
        <p className="mt-1 text-sm text-slate-300">
          Capture key weaknesses, remediation priorities, and measurable impact metrics.
        </p>

        {availablePlans.length === 0 && (
          <div className="mt-4">
            <EmptyState
              icon="inbox"
              title="No scheduled plan is ready for report submission"
              description="Approve the request, assign the researcher, and create a training plan first."
              compact
            />
          </div>
        )}

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-200">Completed Plan</span>
            <Select
              value={reportForm.training_plan_id}
              onChange={(e) => setReportForm((prev) => ({ ...prev, training_plan_id: e.target.value }))}
              disabled={availablePlans.length === 0 || submitting}
              required
            >
              <option value="">Select completed plan</option>
              {availablePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {compactCode("PLN", plan.id)} | {plan.location}
                </option>
              ))}
            </Select>
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-1.5 lg:col-span-2">
              <span className="text-sm font-semibold text-slate-200">Executive Summary</span>
              <TextArea
                placeholder="Training context, what was delivered, and key outcomes."
                value={reportForm.summary}
                onChange={(e) => setReportForm((prev) => ({ ...prev, summary: e.target.value }))}
                disabled={submitting}
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-200">Weaknesses Found</span>
              <TextArea
                placeholder="Observed security gaps and recurring risky patterns."
                value={reportForm.weaknesses_found}
                onChange={(e) => setReportForm((prev) => ({ ...prev, weaknesses_found: e.target.value }))}
                disabled={submitting}
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-200">Recommendations</span>
              <TextArea
                placeholder="Actionable remediation guidance and next steps."
                value={reportForm.recommendations}
                onChange={(e) => setReportForm((prev) => ({ ...prev, recommendations: e.target.value }))}
                disabled={submitting}
                required
              />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-200">Supporting Evidence Files (optional)</span>
            <label className="block cursor-pointer rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-5 text-center transition hover:border-amber-300 hover:bg-amber-500/10">
              <span className="block text-sm font-semibold text-slate-200">Attach Evidence File References (optional)</span>
              <span className="mt-1 block text-xs text-slate-500">Select files to reference. Their names are appended to your recommendations for traceability — not stored on the server.</span>
              <Input
                type="file"
                multiple
                onChange={(e) => setReportFiles(Array.from(e.target.files || []))}
                disabled={submitting}
                className="sr-only"
              />
            </label>
            {reportFiles.length > 0 ? (
              <div className="grid gap-2">
                {reportFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200">
                    <span className="truncate pr-3">{file.name}</span>
                    <button
                      type="button"
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-amber-400/40 hover:text-amber-200"
                      onClick={() => setReportFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-200">Satisfaction (1-10)</span>
              <Input
                type="number"
                min="1"
                max="10"
                value={reportForm.satisfaction_score}
                onChange={(e) => setReportForm((prev) => ({ ...prev, satisfaction_score: Number(e.target.value) }))}
                disabled={submitting}
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-200">Pre-assessment (%)</span>
              <Input
                type="number"
                min="0"
                max="100"
                value={reportForm.pre_assessment_score}
                onChange={(e) => setReportForm((prev) => ({ ...prev, pre_assessment_score: Number(e.target.value) }))}
                disabled={submitting}
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-200">Post-assessment (%)</span>
              <Input
                type="number"
                min="0"
                max="100"
                value={reportForm.post_assessment_score}
                onChange={(e) => setReportForm((prev) => ({ ...prev, post_assessment_score: Number(e.target.value) }))}
                disabled={submitting}
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-200">Attendance (%)</span>
              <Input
                type="number"
                min="0"
                max="100"
                value={reportForm.attendance_rate}
                onChange={(e) => setReportForm((prev) => ({ ...prev, attendance_rate: Number(e.target.value) }))}
                disabled={submitting}
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={availablePlans.length === 0 || submitting}
            className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#0f172a] transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
        <h3 className="font-space text-xl font-bold text-white">Submitted Reports</h3>
        {reports.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="inbox"
              title="No reports submitted yet"
              description="After you submit a completed plan report, it will appear in this history."
              compact
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Satisfaction</th>
                  <th className="px-3 py-3">Pre Score</th>
                  <th className="px-3 py-3">Post Score</th>
                  <th className="px-3 py-3">Improvement</th>
                  <th className="px-3 py-3">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/80">
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-3 py-3 font-semibold text-white">{compactCode("PLN", report.training_plan_id)}</td>
                    <td className="px-3 py-3 text-slate-300">{report.satisfaction_score}/10</td>
                    <td className="px-3 py-3 text-slate-300">{report.pre_assessment_score}%</td>
                    <td className="px-3 py-3 text-slate-300">{report.post_assessment_score}%</td>
                    <td className="px-3 py-3 text-slate-300">{Math.max(0, report.post_assessment_score - report.pre_assessment_score)} pts</td>
                    <td className="px-3 py-3 text-slate-300">{report.attendance_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </main>
      </div>
    </div>
  );
}
