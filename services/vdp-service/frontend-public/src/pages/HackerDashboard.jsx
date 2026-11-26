import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function severityTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (["critical", "high", "medium", "low", "informational"].includes(normalized)) return normalized;
  return "informational";
}

function statusTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (["resolved", "accepted", "paid"].includes(normalized)) return "low";
  if (["triaged", "needs_info", "pending"].includes(normalized)) return "medium";
  if (["rejected"].includes(normalized)) return "critical";
  return "informational";
}

export default function HackerDashboard() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/my-reports")
      .then((res) => setReports(res.data || []))
      .catch(() => setError("Sign in is required to view your reports."));
  }, []);

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h1>Researcher Dashboard</h1>
          <p className="muted">Track all submitted reports, severity, and status updates from triage through resolution.</p>
        </div>
        <div className="actions">
          <span className="pill">{reports.length} report{reports.length === 1 ? "" : "s"}</span>
          <Link className="btn secondary" to="/">Back to VDP</Link>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {reports.length === 0 ? (
        <div className="callout field">
          <h3>No reports yet</h3>
          <p>Once you submit through an organization VDP portal, your report timeline will appear here.</p>
        </div>
      ) : null}

      {reports.map((r) => (
        <article key={r.id} className="card field">
          <div className="section-head-row">
            <div className="card-title">{r.title}</div>
            <div className="actions">
              <span className={`severity-chip ${severityTone(r.severity)}`}>{r.severity || "informational"}</span>
              <span className={`severity-chip ${statusTone(r.status)}`}>{r.status || "submitted"}</span>
            </div>
          </div>
          <p className="card-sub">Report ID: {r.id}</p>
          <p>{r.description}</p>
        </article>
      ))}
    </div>
  );
}
