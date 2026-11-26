import { useEffect, useMemo, useState } from "react";
import { EmptyState, StatusBadge } from "../components/shared/PortalUI";
import { challengeApi } from "../services/challengeApi";

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function ChallengeWorkspacePage() {
  const workspaceUrl = import.meta.env.VITE_CHALLENGE_WORKSPACE_URL || "http://localhost:8089/workspace/challenge/";
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [summary, setSummary] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [programFilter, setProgramFilter] = useState("");

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredPrograms = useMemo(() => {
    const q = programFilter.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter((item) =>
      [item.title, item.owner, item.id, item.track].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [programs, programFilter]);

  const kpis = useMemo(() => {
    const s = summary || {};
    const ds = dashboardData?.summary || {};
    return {
      approvedPrograms: s.approvedPrograms ?? ds.approvedPrograms ?? 0,
      pendingPrograms: s.pendingPrograms ?? ds.pendingPrograms ?? 0,
      totalSubmissions: s.totalSubmissions ?? ds.submissions ?? 0,
      totalParticipants: s.totalParticipants ?? ds.participants ?? 0,
    };
  }, [summary, dashboardData]);

  async function loadWorkspace() {
    setLoading(true);
    setError("");
    try {
      const [whoami, summaryData, dashData, publicData] = await Promise.allSettled([
        challengeApi.whoami(),
        challengeApi.adminSummary(),
        challengeApi.dashboard(),
        challengeApi.publicData(),
      ]);
      if (whoami.status === "fulfilled") setAuthUser(whoami.value);
      if (summaryData.status === "fulfilled") setSummary(summaryData.value);
      if (dashData.status === "fulfilled") setDashboardData(dashData.value);
      if (publicData.status === "fulfilled") {
        setPrograms(publicData.value?.programs || []);
      }
      setToast("Challenge workspace loaded.");
    } catch (e) {
      setError(e.message || "Failed to load Challenge workspace data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card workspace-header">
        <h2>Challenge Campaigns Platform Oversight</h2>
        <p className="section-intro">Platform-admin visibility for all CTF challenges and campaigns, flag submissions, and researcher performance across organizations.</p>
        <div className="badge-stack">
          <span className="metric-pill">Signed in as {authUser?.email || "Platform Admin"}</span>
          <button type="button" className="ghost" onClick={loadWorkspace} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="ghost workspace-open-link" onClick={() => window.open(workspaceUrl, "_blank", "noopener,noreferrer")}>
            Open Challenge Workspace
          </button>
        </div>
        {error ? <div className="notice error">{error}</div> : null}
        {toast ? <div className="notice success">{toast}</div> : null}
      </section>

      <section className="kpi-grid">
        <article className="kpi"><span>Approved Challenges</span><strong>{kpis.approvedPrograms}</strong></article>
        <article className="kpi"><span>Pending Challenges</span><strong>{kpis.pendingPrograms}</strong></article>
        <article className="kpi"><span>Total Submissions</span><strong>{kpis.totalSubmissions}</strong></article>
        <article className="kpi"><span>Active Researchers</span><strong>{kpis.totalParticipants}</strong></article>
      </section>

      <section className="grid two">
        <article className="card">
          <h3>Challenge Campaigns</h3>
          <p className="section-intro">{programs.length} campaigns across all organizations.</p>
          <div className="filter-row">
            <input
              placeholder="Filter by title, owner, or track"
              value={programFilter}
              onChange={(event) => setProgramFilter(event.target.value)}
            />
          </div>
          <div className="list compact">
            {filteredPrograms.map((program) => (
              <div key={program.id} className="list-row">
                <div>
                  <strong>{program.title}</strong>
                  <p>{program.track || "General"} • {program.participantCount ?? 0} researchers • {program.submissionCount ?? 0} submissions</p>
                  <div className="badge-stack">
                    <StatusBadge status={program.status} />
                    {program.reward ? <span className="metric-pill">{program.reward}</span> : null}
                  </div>
                </div>
                <span className="metric-pill">{String(program.id).slice(0, 12)}</span>
              </div>
            ))}
            {filteredPrograms.length === 0 ? (
              <EmptyState compact icon="shield" title="No challenge campaigns found" description="Campaigns will appear after organizations create them." />
            ) : null}
          </div>
        </article>

        <article className="card">
          <h3>Dashboard Metrics</h3>
          <div className="list compact">
            {(dashboardData?.metrics || []).map((metric, index) => (
              <div key={index} className="list-row">
                <div><strong>{metric.label}</strong></div>
                <span className="metric-pill">{metric.value}</span>
              </div>
            ))}
            {(!dashboardData?.metrics || dashboardData.metrics.length === 0) ? (
              <EmptyState compact icon="spark" title="No metrics available" description="Metrics will populate as campaigns and submissions are created." />
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
