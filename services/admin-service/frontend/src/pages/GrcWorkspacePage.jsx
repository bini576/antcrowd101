import { useEffect, useState } from "react";

const GRC_SUMMARY_URL = "/api/grc/api/v1/platform/summary";

export default function GrcWorkspacePage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(GRC_SUMMARY_URL, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`GRC summary returned ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <section className="org-hero">
        <div className="org-copy">
          <p className="hero-tag">Governance, Risk & Compliance</p>
          <h1>GRC & Compliance Workspace</h1>
          <p>
            Manage controls, risks, and frameworks across the platform.
            Monitor compliance posture, evidence collection, and audit readiness
            from a single operational surface.
          </p>
          <div className="badge-stack hero-badges">
            <span className="ghost">Controls & Frameworks</span>
            <span className="ghost">Risk Assessment</span>
            <span className="ghost">Evidence Tracking</span>
          </div>
        </div>
        <div className="org-visual">
          <div className="visual-card">Framework management and control mapping</div>
          <div className="visual-card">Organizational risk register oversight</div>
          <div className="visual-card">Audit-ready evidence and compliance tracking</div>
          <div className="visual-photo" />
        </div>
      </section>

      {loading && <div className="notice muted">Loading GRC summary...</div>}
      {error && <div className="notice error">{error}</div>}

      {summary && (
        <>
          <section className="kpi-grid">
            <article className="kpi">
              <span>Total Controls</span>
              <strong>{summary.totalControls ?? 0}</strong>
            </article>
            <article className="kpi">
              <span>Total Risks</span>
              <strong>{summary.totalRisks ?? 0}</strong>
            </article>
            <article className="kpi">
              <span>Frameworks</span>
              <strong>{summary.totalFrameworks ?? 0}</strong>
            </article>
            <article className="kpi">
              <span>Organizations</span>
              <strong>{summary.totalOrganizations ?? 0}</strong>
            </article>
          </section>

          <section className="grid two">
            <article className="card">
              <h2>GRC Operations</h2>
              <p className="section-intro">
                Compliance controls, framework mapping, and risk registers are managed through the GRC workspace service.
              </p>
              <div className="list compact">
                <div className="list-row">
                  <div>
                    <strong>Control Library</strong>
                    <p>Define, map, and evaluate security controls across frameworks.</p>
                  </div>
                  <span className="metric-pill">{summary.totalControls ?? 0}</span>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Risk Register</strong>
                    <p>Track identified risks, likelihood, impact, and treatment plans.</p>
                  </div>
                  <span className="metric-pill">{summary.totalRisks ?? 0}</span>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Regulatory Frameworks</strong>
                    <p>Manage framework requirements and track coverage gaps.</p>
                  </div>
                  <span className="metric-pill">{summary.totalFrameworks ?? 0}</span>
                </div>
              </div>
            </article>

            <article className="card">
              <h2>Compliance Posture</h2>
              <p className="section-intro">
                Platform-wide compliance status. Connect to the GRC workspace for detailed evidence and audit management.
              </p>
              <div className="list compact">
                <div className="list-row">
                  <div>
                    <strong>Evidence Collection</strong>
                    <p>Automated and manual evidence gathering for compliance frameworks.</p>
                  </div>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Audit Readiness</strong>
                    <p>Pre-audit checklist generation and gap analysis reporting.</p>
                  </div>
                </div>
                <div className="list-row">
                  <div>
                    <strong>Policy Management</strong>
                    <p>Security policy lifecycle — creation, review, approval, and distribution.</p>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </>
  );
}
