import { Link } from "react-router-dom";
import { adminStages } from "../hooks/useAdminPortal";
import { SeverityBadge } from "../components/shared/PortalUI";

export default function ConsolePage({ dashboard, metrics, workspaceSummary = {} }) {
  return (
    <>
      <section className="org-hero">
        <div className="org-copy">
          <p className="hero-tag">Pentesting Operations</p>
          <h1>Platform Control Plane For Crowdsourced Pentesting</h1>
          <p>
            Run researcher onboarding, internal assignment governance, and quality oversight with
            real-time visibility over findings, SLA exposure, and remediation throughput.
          </p>
          <div className="badge-stack hero-badges">
            <Link className="ghost" to="/admin/assignments">Internal Assignment Queue</Link>
            <Link className="ghost" to="/admin/reviews">Finding Review & Approval</Link>
            <Link className="ghost" to="/admin/reports">Reports & Analytics</Link>
          </div>
        </div>
        <div className="org-visual">
          <div className="visual-card">Program lifecycle and triage governance</div>
          <div className="visual-card">Researcher operations and assignment routing</div>
          <div className="visual-card">Quality and SLA trend monitoring</div>
          <div className="visual-photo" />
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi"><span>Open Engagements</span><strong>{dashboard.openEngagements}</strong></article>
        <article className="kpi"><span>High/Critical Findings</span><strong>{dashboard.highCriticalFindings}</strong></article>
        <article className="kpi"><span>Ready For Retest</span><strong>{dashboard.readyForRetest || 0}</strong></article>
        <article className="kpi"><span>SLA Breaches</span><strong>{metrics?.slaBreached || 0}</strong></article>
      </section>

      <section className="grid four">
        <article className="card compact-card">
          <h3>Program Health</h3>
          <p className="stat">{metrics?.openPrograms || 0}</p>
          <p className="muted">Open programs under active management.</p>
        </article>
        <article className="card compact-card">
          <h3>Findings Total</h3>
          <p className="stat">{metrics?.findingsTotal || 0}</p>
          <p className="muted">Reviewed and in-flight findings.</p>
        </article>
        <article className="card compact-card">
          <h3>MTTA</h3>
          <p className="stat">{Number(metrics?.mttaHours || 0).toFixed(1)}h</p>
          <p className="muted">Mean time to acknowledge.</p>
        </article>
        <article className="card compact-card">
          <h3>MTTR</h3>
          <p className="stat">{Number(metrics?.mttrHours || 0).toFixed(1)}h</p>
          <p className="muted">Mean time to remediate.</p>
        </article>
      </section>

      <section className="grid four">
        {adminStages.map((stage) => (
          <article className="card process-card" key={stage.title}>
            <h3>{stage.title}</h3>
            <p className="muted">{stage.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid two">
        <article className="card">
          <h2>Operations Queue</h2>
          <p className="section-intro">Cross-workspace actions connected to the same live pentesting state.</p>
          <div className="list compact">
            <Link className="list-row action-row" to="/admin/assignments">
              <div>
                <strong>Internal Assignment Queue</strong>
                <p>Pending requests that need internal researcher assignment.</p>
              </div>
              <span className="metric-pill">{workspaceSummary.pendingAssignments || 0}</span>
            </Link>
            <Link className="list-row action-row" to="/admin/reviews">
              <div>
                <strong>Finding Review & Approval</strong>
                <p>Submitted findings awaiting review decisions and workflow actions.</p>
              </div>
              <span className="metric-pill">{workspaceSummary.reviewQueue || 0}</span>
            </Link>
            <Link className="list-row action-row" to="/admin/payments">
              <div>
                <strong>Payout Authorization</strong>
                <p>Accepted findings waiting for payout approval and reference capture.</p>
              </div>
              <span className="metric-pill">{workspaceSummary.payoutQueue || 0}</span>
            </Link>
          </div>
        </article>

        <article className="card">
          <h2>Coverage Mix</h2>
          <p className="section-intro">Severity mix snapshot aligned with the finding review board and reports.</p>
          <div className="list compact">
            {Object.entries(metrics?.severityMix || {}).map(([severity, count]) => (
              <div className="list-row" key={severity}>
                <SeverityBadge severity={severity} />
                <span className="metric-pill">{count}</span>
              </div>
            ))}
            {Object.keys(metrics?.severityMix || {}).length === 0 ? (
              <p className="muted">Severity distribution will populate as findings move through triage.</p>
            ) : null}
          </div>
        </article>
      </section>
    </>
  );
}
