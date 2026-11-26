import { useEffect, useState } from "react";
import { EmptyState, SeverityBadge, StatusBadge, formatPortalLabel } from "../components/shared/PortalUI";

const SERVICE_SUMMARY_ENDPOINTS = [
  { key: "bug-bounty", name: "Bug Bounty", url: "/api/bug-bounty/api/whoami" },
  { key: "ai-redteam", name: "AI Red Team", url: "/api/ai-redteam/api/whoami" },
  { key: "challenge", name: "Challenges", url: "/api/challenge/api/whoami" },
  { key: "code", name: "Code Security", url: "/api/code/api/dashboard" },
  { key: "training", name: "Training", url: "/api/training/ready" },
];

export default function OversightPage({ metrics, notifications, markRead }) {
  const severityItems = Object.entries(metrics.severityMix || {});
  const maxSeverity = Math.max(...severityItems.map(([, value]) => Number(value || 0)), 1);

  const [serviceStats, setServiceStats] = useState({});
  const [bugBountyStats, setBugBountyStats] = useState(null);

  useEffect(() => {
    // Fetch service health/summary
    SERVICE_SUMMARY_ENDPOINTS.forEach((svc) => {
      fetch(svc.url, { credentials: "include", signal: AbortSignal.timeout(5000) })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        })
        .then(() => {
          setServiceStats((prev) => ({ ...prev, [svc.key]: { available: true } }));
        })
        .catch(() => {
          setServiceStats((prev) => ({ ...prev, [svc.key]: { available: false } }));
        });
    });

    // Fetch bug bounty dashboard for submission stats
    fetch("/api/bug-bounty/health", { credentials: "include", signal: AbortSignal.timeout(5000) })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setBugBountyStats({ available: true });
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="kpi-grid">
        <article className="kpi"><span>Open Programs</span><strong>{metrics.openPrograms || 0}</strong></article>
        <article className="kpi"><span>Closed Programs</span><strong>{metrics.closedPrograms || 0}</strong></article>
        <article className="kpi"><span>MTTA</span><strong>{Number(metrics.mttaHours || 0).toFixed(1)}h</strong></article>
        <article className="kpi"><span>MTTR</span><strong>{Number(metrics.mttrHours || 0).toFixed(1)}h</strong></article>
      </section>

      <section className="card">
        <h2>Service Availability</h2>
        <p className="section-intro">Real-time availability status for each platform service module.</p>
        <div className="kpi-grid">
          <article className="kpi">
            <span>Pentesting</span>
            <strong style={{ color: "#34d399" }}>Active</strong>
          </article>
          {SERVICE_SUMMARY_ENDPOINTS.map((svc) => (
            <article key={svc.key} className="kpi">
              <span>{svc.name}</span>
              <strong style={{ color: serviceStats[svc.key]?.available ? "#34d399" : serviceStats[svc.key] === undefined ? "#94a3b8" : "#f87171" }}>
                {serviceStats[svc.key] === undefined ? "Checking..." : serviceStats[svc.key]?.available ? "Active" : "Unavailable"}
              </strong>
            </article>
          ))}
        </div>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>Pentesting Findings by Severity</h2>
          <p className="section-intro">Monitor volume, response time, and severity distribution to catch backlog and SLA risk early.</p>
          <p className="muted">Findings: {metrics.findingsTotal} • SLA breaches: {metrics.slaBreached}</p>
          <div className="list compact">
            {severityItems.map(([severity, count]) => (
              <div key={severity} className="list-row">
                <div>
                  <strong><SeverityBadge severity={severity} /></strong>
                  <div className="severity-progress">
                    <span style={{ width: `${(Number(count || 0) / maxSeverity) * 100}%` }} />
                  </div>
                </div>
                <span className="metric-pill">{count}</span>
              </div>
            ))}
            {severityItems.length === 0 && (
              <EmptyState
                compact
                icon="spark"
                title="No severity data yet"
                description="Once findings start moving through triage, the severity distribution will show up here."
              />
            )}
          </div>
        </article>

        <article className="card">
          <h2>Notifications</h2>
          <p className="section-intro">Operational events and escalations requiring platform attention.</p>
          <div className="list compact">
            {notifications.map((n) => (
              <div key={n.id} className={`list-row ${n.read ? "" : "unread"}`}>
                <div>
                  <strong>{n.title}</strong>
                  <div className="badge-stack">
                    <StatusBadge status={n.read ? "read" : "unread"} />
                    {n.type ? <span className="pill tone-neutral small">{formatPortalLabel(n.type)}</span> : null}
                  </div>
                  <p>{n.message}</p>
                  <p>{n.createdAt}</p>
                </div>
                {!n.read && <button className="ghost" onClick={() => markRead(n.id)}>Mark read</button>}
              </div>
            ))}
            {notifications.length === 0 && (
              <EmptyState
                compact
                icon="inbox"
                title="No notifications right now"
                description="Important platform events, assignment updates, and escalations will appear here."
              />
            )}
          </div>
        </article>
      </section>
    </>
  );
}
