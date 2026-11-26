import { useMemo, useState } from "react";
import { EmptyState, SeverityBadge, StatusBadge } from "./PortalUI";

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString();
}

export default function FindingReviewBoard({
  title = "Finding Review",
  findings = [],
  onUpdateFinding,
  successMessage = () => "Finding updated.",
}) {
  const [filters, setFilters] = useState({ q: "", severity: "", status: "" });
  const [selected, setSelected] = useState(null);
  const [actionForm, setActionForm] = useState({ reviewComment: "", bounty: "", paymentReference: "" });

  const visibleFindings = useMemo(() => findings.filter((finding) => {
    const q = filters.q.trim().toLowerCase();
    if (q) {
      const haystack = [finding.jobTitle, finding.title, finding.submittedBy, finding.assetPath].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.severity && finding.severity !== filters.severity) return false;
    if (filters.status && finding.status !== filters.status) return false;
    return true;
  }), [findings, filters]);

  const reviewSummary = useMemo(() => {
    const unresolved = visibleFindings.filter((item) => !["resolved", "rejected", "paid"].includes(String(item.status || "").toLowerCase()));
    const highCritical = unresolved.filter((item) => ["high", "critical"].includes(String(item.severity || "").toLowerCase())).length;
    return {
      visible: visibleFindings.length,
      unresolved: unresolved.length,
      highCritical,
      accepted: visibleFindings.filter((item) => String(item.status || "").toLowerCase() === "accepted").length,
      retest: visibleFindings.filter((item) => String(item.status || "").toLowerCase() === "retesting").length,
    };
  }, [visibleFindings]);

  async function runAction(status) {
    if (!selected || !onUpdateFinding) return;
    await onUpdateFinding(selected.id, {
      status,
      bounty: Number(actionForm.bounty || 0),
      reviewComment: actionForm.reviewComment,
      paymentReference: actionForm.paymentReference,
      duplicateOf: Number(selected.duplicateOf || 0),
    }, successMessage(status, selected, actionForm));
    setSelected(null);
    setActionForm({ reviewComment: "", bounty: "", paymentReference: "" });
  }

  function openReviewModal(finding) {
    setSelected(finding);
    setActionForm({
      reviewComment: finding.reviewComment || "",
      bounty: finding.bounty || "",
      paymentReference: finding.paymentReference || "",
    });
  }

  async function runQuickAction(event, finding, status) {
    event.stopPropagation();
    if (!onUpdateFinding) return;
    await onUpdateFinding(
      finding.id,
      {
        status,
        bounty: Number(finding.bounty || 0),
        reviewComment: finding.reviewComment || "",
        paymentReference: finding.paymentReference || "",
        duplicateOf: Number(finding.duplicateOf || 0),
      },
      successMessage(status, finding, {
        reviewComment: finding.reviewComment || "",
        bounty: finding.bounty || "",
        paymentReference: finding.paymentReference || "",
      }),
    );
  }

  return (
    <article className="card">
      <h2>{title}</h2>
      <p className="section-intro">Review submitted findings with consistent severity/status handling and one-click workflow actions.</p>
      <div className="filter-row">
        <input placeholder="Search program, title, researcher, or asset" value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} />
        <select value={filters.severity} onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="informational">Informational</option>
        </select>
        <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">All statuses</option>
          <option value="new">Submitted</option>
          <option value="triaged">Under Review</option>
          <option value="accepted">Accepted</option>
          <option value="retesting">Request Retest</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="review-summary-row">
        <span className="metric-pill">Visible: {reviewSummary.visible}</span>
        <span className="metric-pill">Unresolved: {reviewSummary.unresolved}</span>
        <span className="metric-pill">High/Critical Open: {reviewSummary.highCritical}</span>
        <span className="metric-pill">Accepted: {reviewSummary.accepted}</span>
        <span className="metric-pill">Retest Queue: {reviewSummary.retest}</span>
      </div>

      <div className="review-table-wrap">
        <table className="review-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Title</th>
              <th>Researcher</th>
              <th>Severity</th>
              <th>CVSS</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleFindings.map((finding) => (
              <tr key={finding.id} className="review-row" onClick={() => openReviewModal(finding)}>
                <td>{finding.jobTitle}</td>
                <td>
                  <div className="review-title-cell">
                    <strong>{finding.title}</strong>
                    <p>{finding.assetPath || "Asset not provided"}</p>
                  </div>
                </td>
                <td>{finding.submittedBy || "Researcher"}</td>
                <td><SeverityBadge severity={finding.severity} /></td>
                <td>{Number(finding.cvss || 0).toFixed(1)}</td>
                <td>{formatDate(finding.createdAt)}</td>
                <td><StatusBadge status={finding.status} /></td>
                <td>
                  <div className="review-action-row">
                    <button
                      type="button"
                      className="ghost review-open-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        openReviewModal(finding);
                      }}
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      className="ghost review-accept-btn"
                      onClick={(event) => runQuickAction(event, finding, "accepted")}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="ghost review-retest-btn"
                      onClick={(event) => runQuickAction(event, finding, "retesting")}
                    >
                      Retest
                    </button>
                    <button
                      type="button"
                      className="ghost review-reject-btn"
                      onClick={(event) => runQuickAction(event, finding, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                  {finding.evidenceUrl ? <span className="pill tone-accent small">Evidence linked</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleFindings.length === 0 ? (
          <EmptyState
            compact
            icon="search"
            title="No findings match the current filters"
            description="Try a different severity or status filter, or clear search keywords."
          />
        ) : null}
      </div>

      {selected ? (
        <div className="review-modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div className="review-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="review-modal-head">
              <div>
                <h3>{selected.title}</h3>
                <p className="muted">{selected.jobTitle}</p>
              </div>
              <button className="ghost" type="button" onClick={() => setSelected(null)}>Close</button>
            </div>

            <div className="review-modal-grid">
              <div className="stacked-copy">
                <div className="badge-stack">
                  <SeverityBadge severity={selected.severity} />
                  <StatusBadge status={selected.status} />
                  <span className="metric-pill">CVSS {Number(selected.cvss || 0).toFixed(1)}</span>
                </div>
                <p><strong>Researcher:</strong> {selected.submittedBy || "Researcher"}</p>
                <p><strong>Asset:</strong> {selected.assetPath || "No asset reference provided"}</p>
                <p><strong>Evidence:</strong> {selected.evidenceUrl || "No evidence reference provided"}</p>
                <p><strong>CWE:</strong> {selected.cwe || "Not provided"}</p>
                <h4>Proof Of Concept</h4>
                <p>{selected.poc}</p>
                <h4>Remediation</h4>
                <p>{selected.remediation}</p>
              </div>

              <div className="stacked-copy">
                <label className="field-label">Review Comment</label>
                <textarea rows={4} placeholder="Add triage notes, rejection reason, or retest guidance" value={actionForm.reviewComment} onChange={(e) => setActionForm((prev) => ({ ...prev, reviewComment: e.target.value }))} />
                <label className="field-label">Bounty Amount (ETB)</label>
                <input type="number" min="0" placeholder="e.g. 12000" value={actionForm.bounty} onChange={(e) => setActionForm((prev) => ({ ...prev, bounty: e.target.value }))} />
                <label className="field-label">Payment Reference</label>
                <input placeholder="Optional payout reference" value={actionForm.paymentReference} onChange={(e) => setActionForm((prev) => ({ ...prev, paymentReference: e.target.value }))} />
                <p className="helper-text">Workflow: Submitted -&gt; Under Review -&gt; Accepted -&gt; Paid / Rejected.</p>
                <div className="badge-stack">
                  <button type="button" onClick={() => runAction("accepted")}>Accept</button>
                  <button type="button" className="ghost" onClick={() => runAction("rejected")}>Reject</button>
                  <button type="button" className="ghost" onClick={() => runAction("retesting")}>Request Retest</button>
                  <button type="button" className="ghost" onClick={() => runAction(selected.status || "triaged")}>Add Comment</button>
                  <button type="button" onClick={() => runAction("paid")}>Mark Paid</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
