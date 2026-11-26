import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useWorkspaceOverview } from '../hooks/useWorkspaceOverview';
import WorkspaceLaunchLink from '../components/WorkspaceLaunchLink';
import { brandAssets } from '@ant-ui';
import {
  getLiveWorkspacesForUser,
  getRoadmapWorkspacesForUser,
  getWorkspaceCountLabel,
  type WorkspaceDefinition
} from '../services/workspaceAccess';
import './OrganizationDashboard.css';

/* ── Skeleton Loaders ─────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="org-skeleton org-skeleton--card">
      <div className="org-skeleton-inner">
        <div className="org-skeleton org-skeleton--row org-skeleton--row-sm" />
        <div className="org-skeleton org-skeleton--row org-skeleton--row-lg" />
        <div className="org-skeleton org-skeleton--row org-skeleton--row-md" />
        <div className="org-skeleton org-skeleton--row org-skeleton--row-sm" />
      </div>
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="org-skeleton org-skeleton--stat">
      <div className="org-skeleton-inner">
        <div className="org-skeleton org-skeleton--row org-skeleton--row-sm" />
        <div className="org-skeleton org-skeleton--row org-skeleton--row-lg" />
      </div>
    </div>
  );
}

/* ── Arrow Icon ───────────────────────────────────────────────── */
function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17L17 7M17 7H7M17 7V17" />
    </svg>
  );
}

/* ── Workspace Card ───────────────────────────────────────────── */
function WsCard({ ws }: { ws: WorkspaceDefinition }) {
  const isLive = ws.status === 'live';
  const inner = (
    <>
      <div className="org-ws-card-top">
        <span className="org-ws-service">{ws.service}</span>
        <span className={`org-badge ${isLive ? 'org-badge--live' : 'org-badge--roadmap'}`}>
          {ws.badge}
        </span>
      </div>
      <h3 className="org-ws-title">{ws.title}</h3>
      <p className="org-ws-desc">{ws.description}</p>
      {isLive && ws.href && (
        <span className="org-ws-open">
          Open workspace <ArrowIcon />
        </span>
      )}
    </>
  );

  if (isLive && ws.href) {
    return (
      <WorkspaceLaunchLink href={ws.href} className="org-ws-card">
        {inner}
      </WorkspaceLaunchLink>
    );
  }

  return <article className="org-roadmap-card">{inner}</article>;
}

/* ── Main Dashboard ───────────────────────────────────────────── */
export default function CompanyOnboarding() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { overview, loading, error } = useWorkspaceOverview(user);
  const liveWorkspaces = getLiveWorkspacesForUser(user);
  const roadmapWorkspaces = getRoadmapWorkspacesForUser(user);
  const { liveCount, roadmapCount } = getWorkspaceCountLabel(user);

  const orgName = user?.organization?.name ?? 'Organization';
  const ownerName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'Owner';
  const ownerRole = user?.organization?.role ?? 'owner';

  return (
    <div className="org-page">
      {/* ── Top Bar ────────────────────────────────── */}
      <header className="org-topbar">
        <div className="org-brand">
          <img src={brandAssets.antCrowdLogo} alt="AntCrowd" />
          <span>ANTCROWD</span>
        </div>
        <nav className="org-nav">
          <button className="org-nav-btn is-active" onClick={() => navigate('/organization/workspace')} type="button">
            Dashboard
          </button>
          <button className="org-nav-btn" onClick={() => navigate('/researchers')} type="button">
            Researchers
          </button>
          <button className="org-nav-btn" onClick={() => navigate('/organization/invite')} type="button">
            Team
          </button>
          <button className="org-nav-btn" onClick={() => navigate('/security/2fa')} type="button">
            Security
          </button>
        </nav>
        <button className="org-signout" onClick={() => void signOut()} type="button">
          Sign out
        </button>
      </header>

      <div className="org-container">
        {/* ── Hero ──────────────────────────────────── */}
        <section className="org-hero">
          <p className="org-eyebrow">Organization Dashboard</p>
          <h1 className="org-hero-title">{orgName}</h1>
          <p className="org-hero-sub">
            Manage your security programs, track vulnerability reports, and coordinate across pentest, VDP, and training
            services.
          </p>
        </section>

        {/* ── Quick Stats ───────────────────────────── */}
        <div className="org-stats-row">
          <div className="org-card">
            <div className="org-stat-label">Owner</div>
            <div className="org-stat-value org-stat-value--sm">{ownerName}</div>
            <div className="org-stat-detail">{user?.email}</div>
          </div>
          <div className="org-card">
            <div className="org-stat-label">Role</div>
            <div className="org-stat-value">{ownerRole}</div>
            <div className="org-stat-detail">Organization-level access</div>
          </div>
          <div className="org-card">
            <div className="org-stat-label">Active services</div>
            <div className="org-stat-value">{liveCount}</div>
            <div className="org-stat-detail">{roadmapCount} more on roadmap</div>
          </div>
          <div className="org-card">
            <div className="org-stat-label">2FA status</div>
            <div className={`org-stat-value ${user?.twoFactorEnabled ? 'org-stat-value--green' : 'org-stat-value--amber'}`}>
              {user?.twoFactorEnabled ? 'Enabled' : 'Off'}
            </div>
            <div className="org-stat-detail">
              {user?.twoFactorEnabled ? (
                'Account protected'
              ) : (
                <Link to="/security/2fa">Enable now →</Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Live Workspaces ──────────────────────── */}
        <div className="org-section-header">
          <h2 className="org-section-title">Workspaces</h2>
          <span className="org-section-count">{liveCount} live</span>
        </div>
        <div className="org-ws-grid">
          {liveWorkspaces.map((ws) => (
            <WsCard ws={ws} key={ws.key} />
          ))}
        </div>

        {/* ── Operational Summary ──────────────────── */}
        <div className="org-section-header">
          <h2 className="org-section-title">Operational Summary</h2>
        </div>
        {loading ? (
          <div className="org-summary-grid">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : overview.summaryCards.length > 0 ? (
          <div className="org-summary-grid">
            {overview.summaryCards.map((card) => (
              <div className="org-card" key={card.title}>
                <div className="org-summary-label">{card.service}</div>
                <div className="org-summary-title">{card.title}</div>
                <div className="org-summary-value">
                  {card.tone === 'warning' && <span className="org-warning-dot" />}
                  {card.value}
                </div>
                <div className="org-summary-detail">{card.detail}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="org-empty" style={{ marginBottom: 40 }}>
            Service summaries will appear once connected workspaces begin recording activity.
          </div>
        )}

        {error && (
          <div className="org-list-item org-list-item--warning" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        {overview.serviceErrors.length > 0 && (
          <div className="org-list-item org-list-item--warning" style={{ marginBottom: 20 }}>
            Some services are still loading: {overview.serviceErrors.join(' · ')}
          </div>
        )}

        {/* ── Action Queue + Activity ─────────────── */}
        <div className="org-two-col">
          <div className="org-card">
            <div className="org-panel-title">Action Queue</div>
            {loading ? (
              <>
                <SkeletonStat />
                <div style={{ height: 8 }} />
                <SkeletonStat />
              </>
            ) : overview.attentionItems.length > 0 ? (
              overview.attentionItems.map((item) => (
                <div className="org-list-item" key={item}>
                  <span className="org-warning-dot" />
                  {item}
                </div>
              ))
            ) : (
              <div className="org-list-item org-list-item--success">
                No urgent actions — all services operating normally.
              </div>
            )}
          </div>
          <div className="org-card">
            <div className="org-panel-title">Recent Activity</div>
            {loading ? (
              <>
                <SkeletonStat />
                <div style={{ height: 8 }} />
                <SkeletonStat />
              </>
            ) : overview.activity.length > 0 ? (
              overview.activity.slice(0, 5).map((item) => (
                <div className="org-activity-item" key={item.id}>
                  <div className="org-activity-service">{item.service}</div>
                  <div className="org-activity-title">{item.title}</div>
                  <div className="org-activity-detail">{item.detail}</div>
                  {item.occurredAt && (
                    <div className="org-activity-time">{new Date(item.occurredAt).toLocaleString()}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="org-empty">Activity will appear as services process events.</div>
            )}
          </div>
        </div>

        {/* ── Roadmap ─────────────────────────────── */}
        {roadmapWorkspaces.length > 0 && (
          <>
            <div className="org-section-header">
              <h2 className="org-section-title">Roadmap</h2>
              <span className="org-section-count">{roadmapCount} planned</span>
            </div>
            <div className="org-ws-grid">
              {roadmapWorkspaces.map((ws) => (
                <WsCard ws={ws} key={ws.key} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
