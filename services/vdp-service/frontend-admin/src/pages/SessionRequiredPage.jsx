import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bootstrapSession, login, setSession } from "../services/api";

export default function SessionRequiredPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("org-admin@acme.io");
  const [password, setPassword] = useState("Antcrowd123!");
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("00000000-0000-0000-0000-000000000001");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function connectPlatformSession() {
      try {
        const response = await bootstrapSession();
        if (!active) return;
        if (response?.user?.role === "organization_admin") {
          navigate("/admin/profile", { replace: true });
        }
      } catch {
        // Stay on the page for manual fallback if the main session is missing.
      }
    }

    connectPlatformSession();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await login({
        email: email.trim().toLowerCase(),
        password,
      });
      if (response?.user?.role !== "organization_admin") {
        setError("Use an organization admin account for this portal.");
        return;
      }
      navigate("/admin/profile", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function activateSession() {
    const cleanedToken = token.trim();
    const cleanedOrgID = orgId.trim();
    if (!cleanedToken || !cleanedOrgID) {
      setError("Token and org ID are required.");
      return;
    }
    setSession(cleanedToken, {
      role: "organization_admin",
      organization_id: cleanedOrgID,
    });
    navigate("/admin/profile", { replace: true });
  }

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h1>VDP Organization Admin Login</h1>
          <p className="muted">
            Sign in with your organization admin account or use a token handoff if another portal is brokering access.
          </p>
        </div>
        <div className="pill">Canonical role: organization_admin</div>
      </div>

      <form className="card field" onSubmit={handleLogin}>
        <label>Email</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="org-admin@acme.io"
        />
        <label>Password</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />
        <div className="actions">
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
          <Link className="btn secondary" to="/org-admin">
            Workspace Home
          </Link>
        </div>
      </form>

      <div className="card field">
        <h3>Token Handoff</h3>
        <p className="muted">
          Keep this only for compatibility while the main frontend integration is being connected.
        </p>
      </div>
      <div className="field">
        <label>Organization Session Token</label>
        <textarea
          className="input"
          rows={4}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste token from /?token=... auto-login URL"
        />
      </div>
      <div className="field">
        <label>Organization ID</label>
        <input
          className="input"
          value={orgId}
          onChange={(event) => setOrgId(event.target.value)}
          placeholder="11111111-1111-1111-1111-111111111111"
        />
      </div>
      <div className="actions">
        <button type="button" className="btn secondary" onClick={activateSession}>
          Activate Session
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}
