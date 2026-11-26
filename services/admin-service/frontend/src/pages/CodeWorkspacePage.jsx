import { useEffect, useMemo, useState } from "react";
import { EmptyState, StatusBadge } from "../components/shared/PortalUI";
import { codeApi } from "../services/codeApi";

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function CodeWorkspacePage() {
  const workspaceUrl = import.meta.env.VITE_CODE_WORKSPACE_URL || "http://localhost:5173/workspace/code/";
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [summary, setSummary] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestFilter, setRequestFilter] = useState("");

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredRequests = useMemo(() => {
    const q = requestFilter.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((item) =>
      [item.repository_name, item.organization_email, item.review_type, item.status].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [requests, requestFilter]);

  const kpis = useMemo(() => {
    const s = summary || {};
    return {
      total: s.total ?? 0,
      pending: s.pending ?? 0,
      inReview: s.inReview ?? 0,
      completed: s.completed ?? 0,
      findings: s.findings ?? 0,
    };
  }, [summary]);

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [whoami, summaryData, dashData, requestsData] = await Promise.allSettled([
        codeApi.whoami(),
        codeApi.adminSummary(),
        codeApi.dashboard(),
        codeApi.requests(),
      ]);
      if (whoami.status === "fulfilled") setAuthUser(whoami.value);
      if (summaryData.status === "fulfilled") setSummary(summaryData.value);
      if (dashData.status === "fulfilled") setDashboardData(dashData.value);
      if (requestsData.status === "fulfilled") setRequests(requestsData.value || []);
      setToast("Code Security workspace loaded.");
    } catch (e) {
      setError(e.message || "Failed to load Code Security workspace data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card workspace-header">
        <h2>Code Security Platform Oversight</h2>
        <p className="section-intro">Platform-admin visibility for all code review requests, reviewer assignments, and security findings across organizations.</p>
        <div className="badge-stack">
          <span className="metric-pill">Signed in as {authUser?.email || "Platform Admin"}</span>
          <button type="button" className="ghost" onClick={loadWorkspace} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="ghost workspace-open-link" onClick={() => window.open(workspaceUrl, "_blank", "noopener,noreferrer")}>
            Open Code Security Workspace
          </button>
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        {toast ? <div className="notice success">{toast}</div> : null}
      </section>

      <section className="kpi-grid">
        <article className="kpi"><span>Total Requests</span><strong>{kpis.total}</strong></article>
        <article className="kpi"><span>Pending Review</span><strong>{kpis.pending}</strong></article>
        <article className="kpi"><span>In Review</span><strong>{kpis.inReview}</strong></article>
        <article className="kpi"><span>Completed</span><strong>{kpis.completed}</strong></article>
        <article className="kpi"><span>Total Findings</span><strong>{kpis.findings}</strong></article>
      </section>

      <section className="grid two">
        <article className="card">
          <h3>Code Review Requests</h3>
          <p className="section-intro">{requests.length} requests across all organizations.</p>
          <div className="filter-row">
            <input
              placeholder="Filter by repository, organization, or type"
              value={requestFilter}
              onChange={(event) => setRequestFilter(event.target.value)}
            />
          </div>
          <div className="list compact">
            {filteredRequests.map((req) => (
              <div key={req.id} className="list-row">
                <div>
                  <strong>{req.repository_name}</strong>
                  <p>{req.review_type} • {req.primary_language} • Priority: {req.priority} • {req.organization_email}</p>
                  <div className="badge-stack">
                    <StatusBadge status={req.status} />
                    {req.assigned_to ? <span className="metric-pill">Assigned: {req.assigned_to}</span> : null}
                  </div>
                </div>
                <span className="metric-pill">#{req.id}</span>
              </div>
            ))}
            {filteredRequests.length === 0 ? (
              <EmptyState compact icon="shield" title="No code review requests found" description="Requests will appear after organizations submit them." />
            ) : null}
          </div>
        </article>

        <article className="card">
          <h3>Dashboard Metrics</h3>
          <div className="list compact">
            {(dashboardData?.metrics || []).map((metric, index) => (
              <div key={index} className="list-row">
                <div>
                  <strong>{metric.label}</strong>
                </div>
                <span className="metric-pill">{metric.value}</span>
              </div>
            ))}
            {(!dashboardData?.metrics || dashboardData.metrics.length === 0) ? (
              <EmptyState compact icon="spark" title="No metrics available" description="Metrics will populate as requests and findings are created." />
            ) : null}
          </div>
          {dashboardData?.notifications ? (
            <>
              <h3 style={{ marginTop: "1.5rem" }}>Recent Notifications</h3>
              <div className="list compact">
                {dashboardData.notifications.slice(0, 5).map((notif) => (
                  <div key={notif.id} className="list-row">
                    <div>
                      <strong>{notif.title}</strong>
                      <p>{notif.message}</p>
                      <p>{formatDate(notif.created_at)}</p>
                    </div>
                  </div>
                ))}
                {dashboardData.notifications.length === 0 ? (
                  <EmptyState compact icon="inbox" title="No notifications" description="Activity notifications will appear here." />
                ) : null}
              </div>
            </>
          ) : null}
        </article>
      </section>
    </>
  );
}
