import { useEffect, useMemo, useState } from "react";
import { EmptyState, StatusBadge } from "../components/shared/PortalUI";
import { trustApi } from "../services/trustApi";

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString();
}

export default function TrustWorkspacePage() {
  const workspaceUrl = import.meta.env.VITE_TRUST_WORKSPACE_URL || "http://localhost:8089/workspace/trust-admin/";
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [summary, setSummary] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [actionBusy, setActionBusy] = useState("");

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const kpis = useMemo(() => {
    const s = summary || {};
    return {
      organizationsWithTrustPages: s.organizationsWithTrustPages ?? 0,
      publishedTrustPages: s.publishedTrustPages ?? 0,
      pendingAccessRequests: s.pendingAccessRequests ?? 0,
      totalAccessRequests: accessRequests.length,
    };
  }, [summary, accessRequests]);

  const pendingRequests = useMemo(
    () => accessRequests.filter((r) => r.status === "pending"),
    [accessRequests],
  );

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [whoami, summaryData, orgsData] = await Promise.allSettled([
        trustApi.whoami(),
        trustApi.adminSummary(),
        trustApi.listOrganizations(),
      ]);
      if (whoami.status === "fulfilled") setAuthUser(whoami.value);
      if (summaryData.status === "fulfilled") setSummary(summaryData.value);
      const orgs = orgsData.status === "fulfilled" ? (orgsData.value || []) : [];
      setOrganizations(orgs);

      // Load access requests for all organizations
      if (orgs.length > 0) {
        const allRequests = [];
        const requestResults = await Promise.allSettled(
          orgs.map((org) => trustApi.listAccessRequests(org.id)),
        );
        requestResults.forEach((result, idx) => {
          if (result.status === "fulfilled" && Array.isArray(result.value)) {
            result.value.forEach((r) => {
              allRequests.push({ ...r, org_name: orgs[idx].name });
            });
          }
        });
        setAccessRequests(allRequests);
      }

      setToast("Trust service workspace loaded.");
    } catch (e) {
      setError(e.message || "Failed to load Trust workspace data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccessRequestAction(requestId, status) {
    const key = `${requestId}-${status}`;
    setActionBusy(key);
    setError("");
    try {
      await trustApi.updateAccessRequestStatus(requestId, status);
      setAccessRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r)),
      );
      setToast(`Access request ${status}.`);
      // Refresh summary counts
      try {
        const newSummary = await trustApi.adminSummary();
        setSummary(newSummary);
      } catch { /* ignore */ }
    } catch (e) {
      setError(e.message || `Failed to ${status} access request.`);
    } finally {
      setActionBusy("");
    }
  }

  return (
    <>
      <section className="card workspace-header">
        <h2>Trust Center Platform Oversight</h2>
        <p className="section-intro">
          As platform admin, you oversee the global security posture page, review and approve pending access requests, and manage platform-wide compliance attestations. Organization admins manage their own trust content in their own workspace.
        </p>
        <div className="badge-stack">
          <span className="metric-pill">Signed in as {authUser?.email || "Platform Admin"}</span>
          <button type="button" className="ghost" onClick={loadWorkspace} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        {toast ? <div className="notice success">{toast}</div> : null}
      </section>

      <section className="kpi-grid">
        <article className="kpi"><span>Trust Pages</span><strong>{kpis.organizationsWithTrustPages}</strong></article>
        <article className="kpi"><span>Published</span><strong>{kpis.publishedTrustPages}</strong></article>
        <article className="kpi"><span>Pending Requests</span><strong>{pendingRequests.length}</strong></article>
        <article className="kpi"><span>Total Requests</span><strong>{kpis.totalAccessRequests}</strong></article>
      </section>

      <section className="grid two">
        {/* Pending Access Requests */}
        <article className="card">
          <h3>Pending Access Requests</h3>
          <p className="section-intro">Access requests submitted by visitors to organization trust centers that need admin review.</p>
          <div className="list compact">
            {pendingRequests.map((req) => (
              <div key={req.id} className="list-row">
                <div>
                  <strong>{req.full_name || req.email}</strong>
                  <p>{req.company_name ? `${req.company_name} — ` : ""}{req.email}</p>
                  <p>Organization: {req.org_name || "Unknown"} • {formatDate(req.created_at)}</p>
                  {req.reason ? <p style={{ fontStyle: "italic", opacity: 0.8 }}>{req.reason}</p> : null}
                </div>
                <div className="badge-stack" style={{ gap: "6px", flexShrink: 0 }}>
                  <button
                    type="button"
                    className="action-btn"
                    disabled={actionBusy === `${req.id}-approved`}
                    onClick={() => handleAccessRequestAction(req.id, "approved")}
                  >
                    {actionBusy === `${req.id}-approved` ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={actionBusy === `${req.id}-rejected`}
                    onClick={() => handleAccessRequestAction(req.id, "rejected")}
                  >
                    {actionBusy === `${req.id}-rejected` ? "…" : "Reject"}
                  </button>
                </div>
              </div>
            ))}
            {pendingRequests.length === 0 ? (
              <EmptyState compact icon="shield" title="No pending requests" description="All access requests have been reviewed. New submissions will appear here." />
            ) : null}
          </div>
        </article>

        {/* All Access Requests */}
        <article className="card">
          <h3>All Access Requests</h3>
          <p className="section-intro">Complete history of all access requests across all organizations.</p>
          <div className="review-table-wrap">
            <table className="review-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Organization</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {accessRequests.map((req) => (
                  <tr key={req.id}>
                    <td>{req.full_name || req.email}</td>
                    <td>{req.org_name || "—"}</td>
                    <td>{req.company_name || "—"}</td>
                    <td><StatusBadge status={req.status} /></td>
                    <td>{formatDate(req.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {accessRequests.length === 0 ? (
            <EmptyState compact icon="inbox" title="No access requests yet" description="Access request submissions from trust center visitors will appear here." />
          ) : null}
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <h3>Platform Compliance Status</h3>
          <p className="section-intro">Compliance frameworks and their current certification status across the AntCrowd platform.</p>
          <div className="list compact">
            {[
              { name: "SOC 2 Type II", status: "Certified", description: "Annual audit completed. Report available to enterprise customers under NDA." },
              { name: "ISO 27001", status: "In Progress", description: "Implementation phase. Certification audit scheduled for Q3 2026." },
              { name: "GDPR", status: "Compliant", description: "Data processing agreements, privacy impact assessments, and DPO appointment in place." },
              { name: "PCI DSS", status: "Planned", description: "Scoping assessment underway for payment processing components." },
            ].map((fw) => (
              <div key={fw.name} className="list-row">
                <div>
                  <strong>{fw.name}</strong>
                  <p>{fw.description}</p>
                </div>
                <span className={`metric-pill ${fw.status === "Certified" || fw.status === "Compliant" ? "tone-success" : fw.status === "In Progress" ? "tone-warning" : ""}`}>
                  {fw.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h3>Platform Overview Settings</h3>
          <p className="section-intro">Full trust content management — compliance certifications, subprocessors, FAQ, and security updates.</p>
          <div className="list compact">
            <div className="list-row action-row" style={{ cursor: "pointer" }} onClick={() => window.open(workspaceUrl, "_blank", "noopener,noreferrer")}>
              <div>
                <strong>Open Trust Admin Workspace</strong>
                <p>Open the full Security Trust admin frontend for content management in a new tab.</p>
              </div>
            </div>
            <div className="list-row">
              <div>
                <strong>Organizations with Trust Pages</strong>
                <p>Organizations that have created and configured trust portal content.</p>
              </div>
              <span className="metric-pill">{kpis.organizationsWithTrustPages}</span>
            </div>
            <div className="list-row">
              <div>
                <strong>Published Trust Pages</strong>
                <p>Trust pages that are publicly visible to external visitors.</p>
              </div>
              <span className="metric-pill">{kpis.publishedTrustPages}</span>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
