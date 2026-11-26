import { useMemo } from "react";
import { Link } from "react-router-dom";
import { EmptyState, SeverityBadge, StatusBadge } from "../components/shared/PortalUI";

function formatDate(value) {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleString();
}

export default function UnifiedDashboardPage({
  dashboard,
  metrics,
  notifications = [],
  findings = [],
  internalRequests = [],
  workspaceSummary = {},
  authOverview = {},
  researcherVerificationQueue = [],
  organizationApprovalQueue = [],
}) {
  const activityFeed = useMemo(() => {
    const findingEvents = findings.slice(0, 6).map((item) => ({
      id: `finding-${item.id}`,
      title: `Finding: ${item.title}`,
      detail: `${item.jobTitle} · ${item.status}`,
      createdAt: item.createdAt,
      severity: item.severity,
      status: item.status,
      type: "finding",
    }));
    const requestEvents = internalRequests.slice(0, 6).map((item) => ({
      id: `internal-${item.id}`,
      title: `Internal Request: ${item.engagementName}`,
      detail: item.assignedResearcher ? `Assigned to ${item.assignedResearcher}` : "Pending assignment",
      createdAt: item.createdAt,
      status: item.status,
      type: "assignment",
    }));
    const noteEvents = notifications.slice(0, 8).map((item) => ({
      id: `notification-${item.id}`,
      title: item.title,
      detail: item.message,
      createdAt: item.createdAt,
      status: item.read ? "read" : "unread",
      type: "notification",
    }));

    return [...findingEvents, ...requestEvents, ...noteEvents]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 12);
  }, [findings, internalRequests, notifications]);

  const pendingResearcherApprovals = useMemo(
    () =>
      researcherVerificationQueue
        .filter((item) => ["submitted", "pending_submission", "rejected"].includes(String(item?.verification?.status || "").toLowerCase()))
        .slice(0, 4),
    [researcherVerificationQueue],
  );

  const pendingOrganizationApprovals = useMemo(
    () =>
      organizationApprovalQueue
        .filter((item) => !["approved", "not_required"].includes(String(item.approvalStatus || item.ownerApprovalStatus || "").toLowerCase()))
        .slice(0, 4),
    [organizationApprovalQueue],
  );

  return (
    <>
      <section className="org-hero unified-hero">
        <div className="org-copy">
          <p className="hero-tag">Unified Security Operations</p>
          <h1>One Console For All Eight Security Services</h1>
          <p>
            Manage researcher onboarding, program approvals, disclosure triage, training delivery, payouts, and audit-ready analytics
            from a single admin workspace.
          </p>
        </div>
        <div className="org-visual">
          <div className="visual-card">Pentesting governance and assignment queue</div>
          <div className="visual-card">VDP intake and report triage orchestration</div>
          <div className="visual-card">Training operations and delivery lifecycle</div>
          <div className="visual-photo" />
        </div>
      </section>

      <section className="kpi-grid unified-kpis">
        <article className="kpi"><span>Open Engagements</span><strong>{dashboard.openEngagements}</strong></article>
        <article className="kpi"><span>High/Critical Findings</span><strong>{dashboard.highCriticalFindings}</strong></article>
        <article className="kpi"><span>SLA Breaches</span><strong>{metrics.slaBreached || 0}</strong></article>
        <article className="kpi"><span>Unread Notifications</span><strong>{notifications.filter((item) => !item.read).length}</strong></article>
      </section>

      <section className="grid four">
        <article className="card compact-card">
          <h3>Pending Assignments</h3>
          <p className="stat">{workspaceSummary.pendingAssignments || 0}</p>
          <p className="muted">Internal assignment requests awaiting routing.</p>
        </article>
        <article className="card compact-card">
          <h3>Finding Review Queue</h3>
          <p className="stat">{workspaceSummary.reviewQueue || 0}</p>
          <p className="muted">Submitted findings ready for triage decisions.</p>
        </article>
        <article className="card compact-card">
          <h3>Payout Queue</h3>
          <p className="stat">{workspaceSummary.payoutQueue || 0}</p>
          <p className="muted">Accepted findings waiting for payout authorization.</p>
        </article>
        <article className="card compact-card">
          <h3>High/Critical Open</h3>
          <p className="stat">{workspaceSummary.highCriticalOpen || 0}</p>
          <p className="muted">Unresolved high-priority issues across active programs.</p>
        </article>
      </section>

      <section className="grid three">
        <article className="card compact-card">
          <h3>Organization approvals</h3>
          <p className="stat">{Number(authOverview.organizations || 0)}</p>
          <p className="muted">Registered organization workspaces tracked in auth onboarding.</p>
        </article>
        <article className="card compact-card">
          <h3>Researcher verification queue</h3>
          <p className="stat">{workspaceSummary.pendingResearcherApprovals || 0}</p>
          <p className="muted">Internal and external researcher identity reviews awaiting decisions.</p>
        </article>
        <article className="card compact-card">
          <h3>Organization review queue</h3>
          <p className="stat">{workspaceSummary.pendingOrganizationApprovals || 0}</p>
          <p className="muted">New organizations pending platform admin approval before first access.</p>
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="section-head-row">
            <h2>Researcher Approval Inbox</h2>
            <Link className="ghost" to="/admin/researchers">Open queue</Link>
          </div>
          <p className="section-intro">National ID and certification submissions from internal and external researchers.</p>
          <div className="list compact">
            {pendingResearcherApprovals.map((item) => (
              <div key={item.userId} className="list-row">
                <div>
                  <strong>{item.firstName} {item.lastName}</strong>
                  <p>{item.email}</p>
                  <p>{item.researcherType} researcher</p>
                </div>
                <div className="badge-stack">
                  <StatusBadge status={item?.verification?.status || "submitted"} />
                </div>
              </div>
            ))}
            {pendingResearcherApprovals.length === 0 ? (
              <EmptyState compact icon="shield" title="No researcher approvals waiting" description="New submissions will appear here as soon as researchers upload verification documents." />
            ) : null}
          </div>
        </article>

        <article className="card">
          <div className="section-head-row">
            <h2>Organization Approval Inbox</h2>
            <Link className="ghost" to="/admin/organizations">Open queue</Link>
          </div>
          <p className="section-intro">New organization registrations waiting for platform-admin approval.</p>
          <div className="list compact">
            {pendingOrganizationApprovals.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.ownerEmail || item.billingEmail}</p>
                  <p>Members: {Number(item.memberCount || 0)}</p>
                </div>
                <div className="badge-stack">
                  <StatusBadge status={item.approvalStatus || item.ownerApprovalStatus || "submitted"} />
                </div>
              </div>
            ))}
            {pendingOrganizationApprovals.length === 0 ? (
              <EmptyState compact icon="shield" title="No organization approvals waiting" description="New organization signups will appear here for review." />
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid three">
        <article className="card">
          <h2>Service Modules</h2>
          <p className="section-intro">Jump directly into each admin service area.</p>
          <div className="list compact">
            <Link className="list-row action-row" to="/admin/pentesting">
              <div>
                <strong>Penetration Testing</strong>
                <p>Programs, assignments, finding review, and oversight.</p>
              </div>
            </Link>
            <Link className="list-row action-row" to="/admin/vdp">
              <div>
                <strong>Vulnerability Disclosure Program (VDP)</strong>
                <p>Global program portfolio, SLA monitoring, and platform-wide report oversight.</p>
              </div>
            </Link>
            <Link className="list-row action-row" to="/admin/training">
              <div>
                <strong>Security Training</strong>
                <p>Pricing setup, operations queue, and program lifecycle management.</p>
              </div>
            </Link>
            <Link className="list-row action-row" to="/admin/bug-bounty">
              <div>
                <strong>Bug Bounty</strong>
                <p>Program approvals, submission oversight, payout requests, and leaderboard.</p>
              </div>
            </Link>
            <Link className="list-row action-row" to="/admin/ai-redteam">
              <div>
                <strong>AI Red Team</strong>
                <p>AI system registrations, scan results, and impact-rated submission oversight.</p>
              </div>
            </Link>
            <Link className="list-row action-row" to="/admin/challenges">
              <div>
                <strong>Challenge</strong>
                <p>CTF program approvals, flag validation, and challenge leaderboard.</p>
              </div>
            </Link>
            <Link className="list-row action-row" to="/admin/code">
              <div>
                <strong>Code Security Review</strong>
                <p>Code review request queue, researcher assignment, and findings.</p>
              </div>
            </Link>
            <Link className="list-row action-row" to="/admin/trust">
              <div>
                <strong>Security Trust Center</strong>
                <p>Trust page management, compliance content, and demo request leads.</p>
              </div>
            </Link>
          </div>
        </article>

        <article className="card">
          <h2>Severity Mix</h2>
          <p className="section-intro">Current finding distribution from the pentesting pipeline.</p>
          <div className="list compact">
            {Object.entries(metrics.severityMix || {}).map(([severity, count]) => (
              <div key={severity} className="list-row">
                <SeverityBadge severity={severity} />
                <span className="metric-pill">{count}</span>
              </div>
            ))}
            {Object.keys(metrics.severityMix || {}).length === 0 ? (
              <EmptyState compact icon="spark" title="No severity data yet" description="Severity mix will populate as findings are reviewed." />
            ) : null}
          </div>
        </article>

        <article className="card">
          <h2>Recent Activity</h2>
          <p className="section-intro">Live activity feed across findings, assignments, and notifications.</p>
          <div className="list compact">
            {activityFeed.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <p>{formatDate(item.createdAt)}</p>
                </div>
                <div className="badge-stack">
                  {item.severity ? <SeverityBadge severity={item.severity} /> : null}
                  {item.status ? <StatusBadge status={item.status} /> : null}
                </div>
              </div>
            ))}
            {activityFeed.length === 0 ? (
              <EmptyState compact icon="inbox" title="No recent activity yet" description="Operational events will stream here once workflows start moving." />
            ) : null}
          </div>
        </article>
      </section>
    </>
  );
}
