import { formatPortalLabel } from "../components/shared/PortalUI";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

const sidebarItems = [
  { label: "Dashboard", path: "/admin" },
  { label: "Pentesting", path: "/admin/pentesting" },
  { label: "VDP", path: "/admin/vdp" },
  { label: "Training", path: "/admin/training" },
  { label: "Bug Bounty", path: "/admin/bug-bounty" },
  { label: "AI Red Team", path: "/admin/ai-redteam" },
  { label: "Challenges", path: "/admin/challenges" },
  { label: "Code Security", path: "/admin/code" },
  { label: "Trust", path: "/admin/trust" },
  { label: "Researchers", path: "/admin/researchers" },
  { label: "Organizations", path: "/admin/organizations" },
  { label: "Payments", path: "/admin/payments" },
  { label: "Reports & Analytics", path: "/admin/reports" },
  { label: "Feedback", path: "/admin/feedback" },
  { label: "Disputes", path: "/admin/disputes" },
  { label: "Monitoring", path: "/admin/monitoring" },
];

const titleByPath = [
  { match: "/admin/pentesting", title: "Pentesting Workspace" },
  { match: "/admin/vdp", title: "VDP Workspace" },
  { match: "/admin/training", title: "Training Workspace" },
  { match: "/admin/bug-bounty", title: "Bug Bounty Workspace" },
  { match: "/admin/ai-redteam", title: "AI Red Team Workspace" },
  { match: "/admin/challenges", title: "Challenge Campaigns" },
  { match: "/admin/code", title: "Code Security" },
  { match: "/admin/trust", title: "Trust Service" },
  { match: "/admin/researchers", title: "Researcher Operations" },
  { match: "/admin/organizations", title: "Organization Portfolio" },
  { match: "/admin/payments", title: "Bounty Payments" },
  { match: "/admin/reports", title: "Reports & Analytics" },
  { match: "/admin/feedback", title: "Feedback Inbox" },
  { match: "/admin/disputes", title: "Dispute Resolution" },
  { match: "/admin/monitoring", title: "System Monitoring" },
  { match: "/admin/settings", title: "Platform Settings" },
  { match: "/admin/assignments", title: "Internal Assignment Queue" },
  { match: "/admin/reviews", title: "Finding Review" },
  { match: "/admin", title: "Unified Admin Dashboard" },
];

function NotificationIcon() {
  return (
    <span className="notification-pill-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M12 3.75a4.75 4.75 0 0 0-4.75 4.75v1.1c0 1.1-.36 2.17-1.02 3.05L4.7 14.7a1 1 0 0 0 .8 1.6h13a1 1 0 0 0 .8-1.6l-1.53-2.05a5.08 5.08 0 0 1-1.02-3.05V8.5A4.75 4.75 0 0 0 12 3.75Zm0 17a2.5 2.5 0 0 0 2.33-1.6H9.67A2.5 2.5 0 0 0 12 20.75Z" />
      </svg>
    </span>
  );
}

export default function AdminLayout({
  brandLogo,
  showLogo,
  setShowLogo,
  user,
  logout,
  loading,
  error,
  info,
  notifications = [],
  markRead,
  markAllRead,
}) {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const pageTitle = useMemo(() => {
    const found = titleByPath.find((item) => location.pathname.startsWith(item.match));
    return found?.title || "Unified Admin Dashboard";
  }, [location.pathname]);

  useEffect(() => {
    setShowNotifications(false);
  }, [location.pathname]);

  const recentNotifications = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 8),
    [notifications],
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          {brandLogo && showLogo ? (
            <img className="brand-logo" src={brandLogo} alt="AntCrowd logo" onError={() => setShowLogo(false)} />
          ) : null}
          <div>
            <p className="hero-tag">AntCrowd</p>
            <h2>Unified Console</h2>
          </div>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Unified Admin Navigation">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <p className="muted">Security operations across Pentesting, VDP, Training, Bug Bounty, AI Red Team, Challenges, Code Security, and Trust.</p>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="hero-tag">Platform Admin Console</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="notification-pill"
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label="Open notification center"
            >
              <NotificationIcon />
              {unreadCount > 99 ? "99+" : unreadCount}
            </button>
            <span className="user-pill">{user?.fullName} ({formatPortalLabel(user?.role)})</span>
            <button className="demo-btn" onClick={logout}>Logout</button>
          </div>
        </header>

        {showNotifications ? (
          <section className="card notification-panel">
            <div className="section-head-row">
              <h3>Notification Center</h3>
              <button type="button" className="ghost" onClick={() => markAllRead?.()}>Mark all as read</button>
            </div>
            <div className="list compact">
              {recentNotifications.map((item) => (
                <div key={item.id} className={`list-row ${item.read ? "" : "unread"}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <p>{item.createdAt || "now"}</p>
                  </div>
                  {!item.read ? (
                    <button type="button" className="ghost" onClick={() => markRead?.(item.id)}>
                      Mark read
                    </button>
                  ) : null}
                </div>
              ))}
              {recentNotifications.length === 0 ? (
                <p className="muted">No notifications yet.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {loading && <div className="notice muted">Loading service data...</div>}
        {error && <div className="notice error">{error}</div>}
        {info && <div className="notice success">{info}</div>}

        <Outlet />
      </main>
    </div>
  );
}
