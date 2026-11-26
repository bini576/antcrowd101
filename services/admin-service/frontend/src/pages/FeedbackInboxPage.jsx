import { useEffect, useState } from "react";
import { authAdminApi } from "../services/authAdminApi";

export default function FeedbackInboxPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    authAdminApi
      .getFeedback()
      .then((data) => {
        setItems(data.feedback || data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const categoryLabel = (cat) => {
    const map = { bug_report: "Bug Report", feature_request: "Feature Request", general: "General" };
    return map[cat] || cat;
  };

  return (
    <>
      <section className="org-hero">
        <div className="org-copy">
          <p className="hero-tag">Platform Operations</p>
          <h1>Feedback Inbox</h1>
          <p>All feedback submitted by platform users across every role — researchers, organizations, and team members.</p>
        </div>
      </section>

      {loading && <div className="notice muted">Loading feedback...</div>}
      {error && <div className="notice error">{error}</div>}

      <section className="kpi-grid">
        <article className="kpi"><span>Total Feedback</span><strong>{items.length}</strong></article>
        <article className="kpi"><span>Bug Reports</span><strong>{items.filter((i) => i.category === "bug_report").length}</strong></article>
        <article className="kpi"><span>Feature Requests</span><strong>{items.filter((i) => i.category === "feature_request").length}</strong></article>
        <article className="kpi"><span>General</span><strong>{items.filter((i) => i.category === "general").length}</strong></article>
      </section>

      <section className="card">
        <h2>Submissions</h2>
        <div className="list compact">
          {items.length === 0 && !loading ? (
            <p className="muted">No feedback has been submitted yet.</p>
          ) : (
            items.map((item) => (
              <div className="list-row" key={item.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <strong>{item.subject}</strong>
                  <span className="metric-pill">{categoryLabel(item.category)}</span>
                </div>
                <p>{item.message}</p>
                <p className="muted">{item.userEmail || item.user_email} — {new Date(item.createdAt || item.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
