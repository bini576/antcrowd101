import { Link, Outlet, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Intake Directory", path: "/" },
];

export default function PublicLayout() {
  const location = useLocation();

  function isActive(path) {
    if (path === "/") return location.pathname === "/" || location.pathname === "";
    return location.pathname.startsWith(path);
  }

  return (
    <div className="app-shell">
      {/* Top gradient strip */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(to right, #f59e0b, #f97316, #f59e0b)", zIndex: 1000 }} />

      {/* Sidebar */}
      <aside className="sidebar-shell">
        <div style={{ padding: "20px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", marginTop: "3px" }}>
          <a href="/" className="sidebar-brand-link">
            <span style={{ color: "#f59e0b", fontWeight: "800", fontSize: "1.25rem", letterSpacing: "-0.025em" }}>AntCrowd</span>
          </a>
          <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#64748b", margin: "4px 0 0 0" }}>PUBLIC VDP</p>
        </div>
        <nav style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={isActive(item.path) ? "sidebar-link active" : "sidebar-link"}
            >
              <span style={{ fontSize: "16px" }}>📁</span> {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", fontSize: "12px", color: "#64748b" }}>&copy; 2026 AntCrowd</div>
      </aside>

      {/* Main Content Area */}
      <div className="main-shell">
        <header className="app-header">
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", margin: 0 }}>Public &mdash; Vulnerability Disclosure Program</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span
              className="badge"
              style={{ fontSize: "0.72rem", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.2)", padding: "4px 12px", borderRadius: "20px", fontWeight: "600" }}
            >
              No login required for intake
            </span>
          </div>
        </header>

        <div className="app" style={{ flex: 1, padding: "24px" }}>
          <Outlet />

          {/* Safe harbor */}
          <div className="section" style={{ marginTop: 24, border: "1px solid rgba(255, 255, 255, 0.05)", background: "rgba(11, 15, 25, 0.6)", borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ margin: "0 0 8px", fontFamily: '"Space Grotesk", sans-serif', color: "#fff", fontSize: "1.1rem" }}>
              Safe Harbor
            </h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.84rem", lineHeight: 1.6 }}>
              Safe harbor text is always visible before submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
