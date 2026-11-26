import { useEffect, useState } from "react";

const DISPUTES_URL = "/api/bug-bounty/api/disputes";
const RESOLVE_URL = "/api/bug-bounty/api/disputes";

export default function DisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolutionText, setResolutionText] = useState({});

  const loadDisputes = () => {
    setLoading(true);
    fetch(DISPUTES_URL, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Disputes fetch returned ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setDisputes(data.disputes || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => { loadDisputes(); }, []);

  const resolveDispute = async (submissionId) => {
    const resolution = resolutionText[submissionId] || "";
    if (!resolution.trim() || resolution.trim().length < 5) {
      setError("Resolution note must be at least 5 characters.");
      return;
    }
    try {
      const res = await fetch(`${RESOLVE_URL}/${submissionId}/resolve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Resolve returned ${res.status}`);
      }
      setResolutionText((prev) => ({ ...prev, [submissionId]: "" }));
      loadDisputes();
    } catch (err) {
      setError(err.message);
    }
  };

  const pending = disputes.filter((d) => !d.disputeResolvedAt);
  const resolved = disputes.filter((d) => d.disputeResolvedAt);

  return (
    <>
      <section className="org-hero">
        <div className="org-copy">
          <p className="hero-tag">Platform Operations</p>
          <h1>Dispute Resolution</h1>
          <p>Researchers can dispute rejected or duplicate submission decisions. Review the dispute reason and provide a resolution.</p>
        </div>
      </section>

      {loading && <div className="notice muted">Loading disputes...</div>}
      {error && <div className="notice error">{error}</div>}

      <section className="kpi-grid">
        <article className="kpi"><span>Total Disputes</span><strong>{disputes.length}</strong></article>
        <article className="kpi"><span>Pending</span><strong>{pending.length}</strong></article>
        <article className="kpi"><span>Resolved</span><strong>{resolved.length}</strong></article>
      </section>

      <section className="card">
        <h2>Pending Disputes</h2>
        <div className="list compact">
          {pending.length === 0 ? (
            <p className="muted">No pending disputes.</p>
          ) : (
            pending.map((d) => (
              <div className="list-row" key={d.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <strong>{d.title}</strong>
                  <span className="metric-pill">{d.severity} — {d.status}</span>
                </div>
                <p><strong>Researcher:</strong> {d.usernameLabel}</p>
                <p><strong>Program:</strong> {d.programTitle}</p>
                <p><strong>Dispute reason:</strong> {d.disputeReason}</p>
                <p className="muted">Disputed at: {new Date(d.disputedAt).toLocaleString()}</p>
                <div style={{ display: "flex", gap: 8, width: "100%", marginTop: 4 }}>
                  <input
                    type="text"
                    placeholder="Resolution note..."
                    value={resolutionText[d.id] || ""}
                    onChange={(e) => setResolutionText((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <button className="demo-btn" onClick={() => resolveDispute(d.id)}>Resolve</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {resolved.length > 0 && (
        <section className="card">
          <h2>Resolved Disputes</h2>
          <div className="list compact">
            {resolved.map((d) => (
              <div className="list-row" key={d.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <strong>{d.title}</strong>
                  <span className="metric-pill">{d.severity}</span>
                </div>
                <p><strong>Dispute:</strong> {d.disputeReason}</p>
                <p><strong>Resolution:</strong> {d.disputeResolution}</p>
                <p className="muted">Resolved: {new Date(d.disputeResolvedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
