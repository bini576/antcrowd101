import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, StatusBadge } from "../components/AdminUI";
import { useOrgSession } from "../hooks/useOrgSession";
import { bootstrapSession } from "../services/api";

export default function OrganizationAdminLandingPage() {
  const navigate = useNavigate();
  const { hasSession, orgId } = useOrgSession();

  useEffect(() => {
    if (hasSession) {
      navigate("/admin/profile", { replace: true });
      return;
    }

    let active = true;

    async function connectPlatformSession() {
      try {
        const response = await bootstrapSession();
        if (!active) return;
        if (response?.user?.role === "organization_admin") {
          navigate("/admin/profile", { replace: true });
        }
      } catch {
        // Leave the landing page visible when the platform session is missing.
      }
    }

    connectPlatformSession();

    return () => {
      active = false;
    };
  }, [hasSession, navigate]);

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h1>Organization Admin Portal</h1>
          <p className="muted">
            This workspace is for organization teams to configure VDP policy, triage reports, and manage notifications.
          </p>
        </div>
        <StatusBadge status={hasSession ? "active" : "inactive"} />
      </div>

      <div className="card-grid">
        <div className="card field">
          <h3>Access Flow</h3>
          <ol className="list">
            <li>Sign in as an organization admin or arrive from a trusted token handoff.</li>
            <li>Confirm organization profile and disclosure procedure.</li>
            <li>Publish your VDP and triage incoming reports with SLA visibility.</li>
          </ol>
          {orgId ? <div className="card-meta">Org ID: {orgId}</div> : null}
        </div>
        <EmptyState
          compact
          icon="shield"
          title="Security teams start here"
          description="Profile, program setup, triage, metrics, and notifications are all organized in one VDP workspace."
        />
      </div>

      <div className="actions">
        <button className="btn" type="button" onClick={() => navigate(hasSession ? "/admin/profile" : "/login")}>
          {hasSession ? "Open Admin Workspace" : "Sign In"}
        </button>
        <Link className="btn secondary" to="/admin/triage">
          Jump To Triage
        </Link>
      </div>
    </div>
  );
}
