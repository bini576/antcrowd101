import { useEffect, useState } from "react";
import api from "../services/api";

function splitList(text) {
  return (text || "")
    .split(/,|\\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ProcedureDetailPage({ orgId }) {
  const [procedure, setProcedure] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    api
      .get(`/organizations/${orgId}/procedure`)
      .then((res) => setProcedure(res.data))
      .catch(() => setError("Procedure not available"));
  }, [orgId]);

  if (!orgId) return <div>Missing organization</div>;

  return (
    <div className="section">
      <h2>Disclosure Procedure</h2>
      {error && <div className="error">{error}</div>}
      {procedure && (
        <div className="procedure-grid">
          <section className="procedure-block">
            <h3>Overview</h3>
            <p>{procedure.overview}</p>
          </section>
          <section className="procedure-block">
            <h3>Scope</h3>
            <ul className="list">
              {splitList(procedure.scope).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
          <section className="procedure-block">
            <h3>Out of Scope</h3>
            <ul className="list">
              {splitList(procedure.out_of_scope).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
          <section className="procedure-block">
            <h3>Reporting Requirements</h3>
            <p>{procedure.reporting_requirements}</p>
          </section>
          <section className="procedure-block">
            <h3>Severity Rules</h3>
            <p>{procedure.severity_rules}</p>
          </section>
          <section className="procedure-block">
            <h3>Response Timeline</h3>
            <p>{procedure.response_timeline}</p>
          </section>
          <section className="procedure-block callout">
            <h3>Legal Safe Harbor</h3>
            <p>{procedure.legal_safe_harbor}</p>
          </section>
          <section className="procedure-block">
            <h3>Prohibited Actions</h3>
            <p>{procedure.prohibited_actions}</p>
          </section>
          <section className="procedure-block">
            <a className="btn" href={`/api/vdp/procedures/${procedure.id}/document`}>
              Download SVDSP PDF
            </a>
          </section>
        </div>
      )}
    </div>
  );
}
