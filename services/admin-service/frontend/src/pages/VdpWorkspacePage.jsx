import { useEffect, useMemo, useState } from "react";
import { EmptyState, SeverityBadge, StatusBadge } from "../components/shared/PortalUI";
import { vdpApi } from "../services/vdpApi";

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function VdpWorkspacePage() {
  const vdpOrgAdminUrl = import.meta.env.VITE_VDP_ORG_ADMIN_URL || "/workspace/vdp/org/";
  const vdpPublicUrl = import.meta.env.VITE_VDP_PUBLIC_URL || "http://localhost:5284";
  const [session, setSession] = useState({ email: "platform-admin@antcrowd.local", password: "Antcrowd123!" });
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [organizations, setOrganizations] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [reports, setReports] = useState([]);
  const [events, setEvents] = useState([]);
  const [reportFilter, setReportFilter] = useState({ q: "", severity: "", status: "" });
  const [orgFilter, setOrgFilter] = useState("");

  const loggedIn = Boolean(vdpApi.getToken());

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

  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      if (reportFilter.status && item.status !== reportFilter.status) return false;
      if (reportFilter.severity && item.severity !== reportFilter.severity) return false;
      const q = reportFilter.q.trim().toLowerCase();
      if (!q) return true;
      return [item.title, item.org_name, item.id].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [reports, reportFilter]);

  const filteredPrograms = useMemo(() => {
    const q = orgFilter.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter((item) =>
      [item.org_name, item.title, item.contact_email, item.id].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [programs, orgFilter]);

  const kpis = useMemo(
    () => ({
      organizations: organizations.length,
      programs: programs.length,
      activePrograms: programs.filter((item) => String(item.status || "").toLowerCase() === "active").length,
      publicPrograms: programs.filter((item) => String(item.visibility || "").toLowerCase() === "public").length,
      reports: reports.length,
      criticalHighReports: reports.filter((r) => ["critical", "high"].includes(String(r.severity || "").toLowerCase())).length,
      slaBreachedReports: reports.filter((r) => r.overdue === true).length,
      unresolvedReports: reports.filter((r) => !["resolved", "rejected"].includes(String(r.status || "").toLowerCase())).length,
    }),
    [organizations, programs, reports],
  );

  async function bootstrapSession() {
    setLoading(true);
    setError("");
    try {
      const data = await vdpApi.bootstrap();
      vdpApi.setToken(data?.access_token || data?.token || "");
      const me = await vdpApi.me();
      if (!["platform_admin", "admin"].includes(String(me?.role || "").toLowerCase())) {
        throw new Error("VDP login requires a platform admin account.");
      }
      setAuthUser(me);
      await loadWorkspace();
      setToast("VDP admin workspace connected via platform session.");
    } catch (e) {
      setError(e.message || "Failed to bootstrap VDP session. Ensure you are signed in to the platform.");
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    setLoading(true);
    setError("");
    setToast("");
    try {
      const data = await vdpApi.login(session.email.trim().toLowerCase(), session.password);
      vdpApi.setToken(data?.access_token || data?.token || "");
      const me = await vdpApi.me();
      if (!["platform_admin", "admin"].includes(String(me?.role || "").toLowerCase())) {
        throw new Error("VDP login requires a platform admin account.");
      }
      setAuthUser(me);
      await loadWorkspace();
      setToast("VDP admin workspace connected.");
    } catch (e) {
      setError(e.message || "Failed to login to VDP service.");
      vdpApi.setToken("");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    vdpApi.setToken("");
    setAuthUser(null);
    setOrganizations([]);
    setPrograms([]);
    setReports([]);
    setEvents([]);
  }

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [orgData, programData, reportData, auditData, me] = await Promise.all([
        vdpApi.listOrganizations(),
        vdpApi.listPrograms(),
        vdpApi.listReports(),
        vdpApi.listAuditEvents(),
        vdpApi.me(),
      ]);
      setAuthUser(me);
      setOrganizations(orgData || []);
      setPrograms(programData || []);
      setReports(reportData || []);
      setEvents(auditData || []);
    } catch (e) {
      const msg = e.message || "";
      if (
        msg.toLowerCase().includes("token") ||
        msg.toLowerCase().includes("auth") ||
        msg.toLowerCase().includes("credentials") ||
        msg.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("401")
      ) {
        logout();
        await bootstrapSession();
      } else {
        setError(msg || "Failed to load VDP workspace data.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card workspace-header">
        <h2>VDP Global Oversight</h2>
        <p className="section-intro">Platform-admin visibility for all organization programs, global SLA exposure, report flow, and audit activity. Organization teams operate their own VDP portal separately.</p>
        <div className="badge-stack">
          {!loggedIn ? (
            <>
              <input
                placeholder="VDP admin email"
                value={session.email}
                onChange={(event) => setSession((prev) => ({ ...prev, email: event.target.value }))}
              />
              <input
                type="password"
                placeholder="VDP password"
                value={session.password}
                onChange={(event) => setSession((prev) => ({ ...prev, password: event.target.value }))}
              />
              <button type="button" onClick={login} disabled={loading}>{loading ? "Connecting..." : "Connect VDP"}</button>
            </>
          ) : (
            <>
              <span className="metric-pill">Signed in as {authUser?.email || "VDP admin"}</span>
              <button type="button" className="ghost" onClick={loadWorkspace} disabled={loading}>
                Refresh
              </button>
              <button type="button" className="ghost" onClick={logout}>
                Disconnect
              </button>
            </>
          )}
        </div>
        <div className="notice muted">
          Platform scope only: portfolio oversight and monitoring. Organization-level configuration, scope management, and triage actions happen in the dedicated organization VDP admin portal.
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        {toast ? <div className="notice success">{toast}</div> : null}
      </section>

      {loggedIn ? (
        <>
          <section className="kpi-grid">
            <article className="kpi"><span>Organizations</span><strong>{kpis.organizations}</strong></article>
            <article className="kpi"><span>Programs</span><strong>{kpis.programs}</strong></article>
            <article className="kpi"><span>Active Programs</span><strong>{kpis.activePrograms}</strong></article>
            <article className="kpi"><span>Public Programs</span><strong>{kpis.publicPrograms}</strong></article>
          </section>

          <section className="kpi-grid">
            <article className="kpi"><span>Reports</span><strong>{kpis.reports}</strong></article>
            <article className="kpi"><span>Critical/High</span><strong>{kpis.criticalHighReports}</strong></article>
            <article className="kpi"><span>SLA Breached</span><strong>{kpis.slaBreachedReports}</strong></article>
            <article className="kpi"><span>Unresolved</span><strong>{kpis.unresolvedReports}</strong></article>
          </section>

          <section className="grid two">
            <article className="card">
              <h3>Organizations</h3>
              <div className="list compact">
                {organizations.map((org) => (
                  <div key={org.id} className="list-row">
                    <div>
                      <strong>{org.name}</strong>
                      <p>@{org.slug}</p>
                      <p>{org.contact_email || "No contact email"} • {org.website || "No website"}</p>
                    </div>
                    <span className="metric-pill">{org.id.slice(0, 8)}</span>
                  </div>
                ))}
                {organizations.length === 0 ? (
                  <EmptyState compact icon="inbox" title="No VDP organizations found" description="Create organizations before publishing VDP programs." />
                ) : null}
              </div>
            </article>

            <article className="card">
              <h3>Program Portfolio</h3>
              <p className="section-intro">Global read-only portfolio view for all VDP programs across onboarded organizations.</p>
              <div className="filter-row">
                <input
                  placeholder="Filter by organization, title, or contact"
                  value={orgFilter}
                  onChange={(event) => setOrgFilter(event.target.value)}
                />
              </div>
              <div className="list compact">
                {filteredPrograms.map((program) => (
                  <div key={program.id} className="list-row">
                    <div>
                      <strong>{program.title || program.org_name}</strong>
                      <p>{program.org_name} • {program.contact_email || "No contact"}</p>
                      <div className="badge-stack">
                        <StatusBadge status={program.status} />
                        <StatusBadge status={program.visibility} />
                      </div>
                    </div>
                    <span className="metric-pill">{program.id.slice(0, 8)}</span>
                  </div>
                ))}
                {filteredPrograms.length === 0 ? (
                  <EmptyState compact icon="shield" title="No VDP programs yet" description="Programs will appear here after organization setup and publication." />
                ) : null}
              </div>
            </article>
          </section>

          <section className="grid two">
            <article className="card">
              <h3>Report Queue</h3>
              <p className="section-intro">Unresolved reports: {kpis.unresolvedReports}</p>
              <div className="filter-row">
                <input
                  placeholder="Search report title or organization"
                  value={reportFilter.q}
                  onChange={(event) => setReportFilter((prev) => ({ ...prev, q: event.target.value }))}
                />
                <select
                  value={reportFilter.severity}
                  onChange={(event) => setReportFilter((prev) => ({ ...prev, severity: event.target.value }))}
                >
                  <option value="">All severities</option>
                  <option value="critical">critical</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
                <select
                  value={reportFilter.status}
                  onChange={(event) => setReportFilter((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="">All statuses</option>
                  <option value="new">new</option>
                  <option value="triaged">triaged</option>
                  <option value="accepted">accepted</option>
                  <option value="resolved">resolved</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
              <div className="review-table-wrap">
                <table className="review-table">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Title</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((report) => (
                      <tr key={report.id}>
                        <td>{report.org_name}</td>
                        <td>{report.title}</td>
                        <td><SeverityBadge severity={report.severity} /></td>
                        <td><StatusBadge status={report.status} /></td>
                        <td>{formatDate(report.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredReports.length === 0 ? (
                <EmptyState compact icon="search" title="No reports match current filters" description="Adjust severity/status filters or clear search keywords." />
              ) : null}
            </article>

            <article className="card">
              <h3>Audit Activity</h3>
              <div className="list compact">
                {events.map((event) => (
                  <div key={event.id} className="list-row">
                    <div>
                      <strong>{event.event_type}</strong>
                      <p>{event.actor_type} • {event.actor_email || event.actor_id || "system"}</p>
                      <p>Report: {event.report_id ? event.report_id.slice(0, 8) : "-"}</p>
                      <p>{formatDate(event.created_at)}</p>
                    </div>
                  </div>
                ))}
                {events.length === 0 ? (
                  <EmptyState compact icon="spark" title="No audit events available" description="Event stream will populate when report lifecycle events are generated." />
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : (
        <section className="card">
          <EmptyState
            icon="shield"
            title="Connect VDP admin session"
            description="Sign in with a VDP platform-admin account to load organizations, reports, and audit data directly in this console."
          />
        </section>
      )}
    </>
  );
}
