import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReportSubmissionForm from "../components/ReportSubmissionForm";
import ReportTracker from "../components/ReportTracker";
import { getPublicVDP } from "../services/api";

function splitList(text) {
  return (text || "")
    .split(/,|\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SecurityDisclosurePage() {
  const { organization } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vdp, setVdp] = useState(null);

  useEffect(() => {
    if (!organization) {
      setError("Missing organization identifier.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getPublicVDP(organization)
      .then((data) => setVdp(data))
      .catch(() => setError("Public VDP page not found or not published."))
      .finally(() => setLoading(false));
  }, [organization]);

  if (loading) {
    return (
      <section className="section">
        <h2>Loading security disclosure page...</h2>
      </section>
    );
  }

  if (error || !vdp?.program?.id || !vdp?.procedure?.id) {
    return (
      <section className="section">
        <h2>Security Disclosure Portal</h2>
        <div className="error">{error || "Program unavailable."}</div>
        <div className="actions">
          <Link className="btn secondary" to="/">Back to Public Registry</Link>
        </div>
      </section>
    );
  }

  return (
    <div>
      <section className="section">
        <div className="section-header">
          <div>
            <h1>{vdp.program?.title || `${vdp.organization?.name} Security Disclosure Program`}</h1>
            <p className="muted">
              Public route: <strong>/security/{vdp.organization?.slug}</strong>
            </p>
            {vdp.program?.contact_email ? (
              <p className="muted">
                Security contact: <strong>{vdp.program.contact_email}</strong>
              </p>
            ) : null}
          </div>
          <div className="severity-chip informational">Public VDP</div>
        </div>

        <div className="actions">
          <span className="pill">Program Status: {vdp.program?.status || "active"}</span>
          <span className="pill">Visibility: {vdp.program?.visibility || "public"}</span>
        </div>

        {vdp.program?.description ? (
          <div className="callout field">
            <h3>Program Description</h3>
            <p>{vdp.program.description}</p>
          </div>
        ) : null}

        <div className="procedure-grid">
          <section className="procedure-block">
            <h3>Scope</h3>
            <ul className="list">
              {splitList(vdp.procedure.scope).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="procedure-block">
            <h3>Out of Scope</h3>
            <ul className="list">
              {splitList(vdp.procedure.out_of_scope).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="procedure-block">
            <h3>Disclosure Policy PDF</h3>
            {vdp.policy_pdf?.download_url ? (
              <a className="btn" href={vdp.policy_pdf.download_url}>
                Download Policy PDF
              </a>
            ) : (
              <p className="muted">No policy PDF uploaded yet.</p>
            )}
          </section>
        </div>
      </section>

      <ReportSubmissionForm programId={vdp.program.id} procedure={vdp.procedure} />
      <ReportTracker />
    </div>
  );
}
