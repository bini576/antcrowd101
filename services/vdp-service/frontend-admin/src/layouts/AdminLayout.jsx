import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { NotificationBell } from "../components/AdminUI";
import { clearSession, listOrgNotifications } from "../services/api";
import { brandAssets } from "@ant-ui";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/org-admin" },
  { label: "Profile", path: "/admin/profile" },
  { label: "Program", path: "/admin/program" },
  { label: "Triage", path: "/admin/triage" },
  { label: "Metrics", path: "/admin/metrics" },
  { label: "Notifications", path: "/admin/notifications" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadUnreadCount() {
      try {
        const items = await listOrgNotifications();
        if (!active) return;
        setUnreadCount((items || []).filter((item) => !item.read_at && !item.readAt).length);
      } catch {
        if (!active) return;
        setUnreadCount(0);
      }
    }

    loadUnreadCount();
    return () => {
      active = false;
    };
  }, []);

  async function endSession() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error(e);
    }
    clearSession();
    const mainAppLoginUrl = (import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173").replace(/\/$/, "") + "/login";
    window.location.href = mainAppLoginUrl;
  }

  function isActive(path) {
    if (path === "/org-admin") return location.pathname === "/org-admin";
    return location.pathname.startsWith(path);
  }

  const activeLinkStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "none",
    border: "none",
    background: "rgba(245, 158, 11, 0.1)",
    color: "#f59e0b",
    borderLeft: "3px solid #f59e0b",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.2s"
  };

  const inactiveLinkStyle = {
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
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.2s"
  };

  const NAV_ITEMS_WITH_ICONS = [
    { label: "Dashboard", path: "/org-admin", icon: "📊" },
    { label: "Profile", path: "/admin/profile", icon: "👤" },
    { label: "Program", path: "/admin/program", icon: "📁" },
    { label: "Triage", path: "/admin/triage", icon: "🔍" },
    { label: "Metrics", path: "/admin/metrics", icon: "📈" },
    { label: "Notifications", path: "/admin/notifications", icon: "🔔" },
  ];

  return (
    <div className="app-shell" style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "Inter, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ position: "sticky", top: 0, height: "100vh", background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #334155" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", cursor: "pointer" }} onClick={() => navigate("/org-admin")}>
            <span style={{ color: "#f59e0b", fontWeight: "800", fontSize: "1.25rem", letterSpacing: "-0.025em" }}>AntCrowd</span>
          </div>
          <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#64748b", margin: "4px 0 0 0" }}>VDP ADMIN</p>
        </div>
        <nav style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {NAV_ITEMS_WITH_ICONS.map((item) => (
            <button
              key={item.path}
              type="button"
              style={isActive(item.path) ? activeLinkStyle : inactiveLinkStyle}
              onClick={() => navigate(item.path)}
            >
              <span style={{ fontSize: "16px" }}>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid #334155", fontSize: "12px", color: "#64748b" }}>&copy; 2026 AntCrowd</div>
      </aside>

      {/* Main Content Area */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", overflowX: "hidden" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 20, height: "60px", borderBottom: "1px solid #334155", backgroundColor: "#1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", margin: 0 }}>Organization &mdash; Vulnerability Disclosure Program</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <NotificationBell count={unreadCount} onClick={() => navigate("/admin/notifications")} />
            <button
              type="button"
              className="btn secondary"
              style={{ minHeight: 34, padding: "6px 14px", fontSize: "0.76rem", background: "#334155", color: "#f1f5f9", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
              onClick={endSession}
            >
              End session
            </button>
          </div>
        </header>

        <div className="app" style={{ flex: 1, padding: "24px", background: "#0f172a" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
