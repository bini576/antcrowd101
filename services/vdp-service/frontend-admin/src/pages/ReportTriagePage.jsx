import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  FieldHint,
  LoadingCard,
  Modal,
  SeverityBadge,
  SLABadge,
  StatusBadge,
  Toast,
  formatDateTime,
} from "../components/AdminUI";
import {
  addOrgReportComment,
  assignReport,
  getOrgReport,
  getOrgReportAttachments,
  getOrgReportComments,
  getOrgReportEvents,
  getOrgReportTriage,
  listOrgReports,
  patchReportStatus,
  requestOrgReportInfo,
  runOrgReportTriage,
} from "../services/api";

const STATUS_OPTIONS = [
  "new",
  "triaged",
  "needs_info",
  "accepted",
  "retesting",
  "resolved",
  "rejected",
];

function detectSlaState(report) {
  if (report.overdue) return { label: "Overdue", overdue: true };
  if (report.needs_info_due_at) return { label: "Needs Info SLA", overdue: false };
  return { label: "On Time", overdue: false };
}

export default function ReportTriagePage() {
  const [reports, setReports] = useState([]);
  const [filters, setFilters] = useState({ status: "", severity: "", q: "", overdue: "" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("triaged");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [events, setEvents] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [triageAssessment, setTriageAssessment] = useState(null);
  const [commentBody, setCommentBody] = useState("");
  const [requestMoreInfo, setRequestMoreInfo] = useState("");
  const [detailForm, setDetailForm] = useState({
    status: "new",
    status_reason: "",
    public_notes: "",
    internal_notes: "",
    duplicate_of: "",
    needs_info_days: "14",
    assignee_name: "",
    assignee_email: "",
    bounty_amount: "",
  });

  const allSelected = reports.length > 0 && selectedIds.length === reports.length;

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function load(currentFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = { ...currentFilters };
      if (params.overdue !== "") {
        params.overdue = params.overdue === "1";
      } else {
        delete params.overdue;
      }
      const data = await listOrgReports(params);
      setReports(data || []);
      setSelectedIds((prev) => prev.filter((id) => (data || []).some((report) => report.id === id)));
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  async function openReport(reportId) {
    setDetailLoading(true);
    setError("");
    try {
      const [report, commentData, eventData, attachmentData, triageData] = await Promise.all([
        getOrgReport(reportId),
        getOrgReportComments(reportId),
        getOrgReportEvents(reportId),
        getOrgReportAttachments(reportId),
        getOrgReportTriage(reportId).catch(() => null),
      ]);
      setSelectedReport(report);
      setComments(commentData || []);
      setEvents(eventData || []);
      setAttachments(attachmentData || []);
      setTriageAssessment(triageData);
      setDetailForm({
        status: report.status || "new",
        status_reason: report.status_reason || "",
        public_notes: report.public_notes || "",
        internal_notes: report.internal_notes || "",
        duplicate_of: report.duplicate_of || "",
        needs_info_days: "14",
        assignee_name: report.assignee_name || "",
        assignee_email: report.assignee_email || "",
        bounty_amount: "",
      });
      setCommentBody("");
      setRequestMoreInfo("");
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to load report details");
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveStatus() {
    if (!selectedReport) return;
    setError("");
    try {
      await patchReportStatus(selectedReport.id, {
        status: detailForm.status,
        status_reason: detailForm.status_reason,
        public_notes: detailForm.public_notes,
        internal_notes: detailForm.internal_notes,
        duplicate_of: detailForm.duplicate_of,
        needs_info_days: Number(detailForm.needs_info_days || 14),
      });
      setToast(`Report ${selectedReport.id.slice(0, 8)} updated.`);
      await load();
      await openReport(selectedReport.id);
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to update report status");
    }
  }

  async function saveAssignee() {
    if (!selectedReport) return;
    setError("");
    try {
      await assignReport(selectedReport.id, {
        assignee_name: detailForm.assignee_name,
        assignee_email: detailForm.assignee_email,
      });
      setToast("Triager assignment updated.");
      await load();
      await openReport(selectedReport.id);
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to save assignee");
    }
  }

  async function saveComment() {
    if (!selectedReport || !commentBody.trim()) return;
    setError("");
    try {
      await addOrgReportComment(selectedReport.id, { body: commentBody.trim() });
      setCommentBody("");
      setToast("Comment added.");
      await openReport(selectedReport.id);
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to add comment");
    }
  }

  async function sendInfoRequest() {
    if (!selectedReport || !requestMoreInfo.trim()) return;
    setError("");
    try {
      await requestOrgReportInfo(selectedReport.id, { message: requestMoreInfo.trim() });
      setRequestMoreInfo("");
      setToast("More information requested from the reporter.");
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to send reporter message");
    }
  }

  async function runAssistant() {
    if (!selectedReport) return;
    setError("");
    try {
      await runOrgReportTriage(selectedReport.id);
      const triageData = await getOrgReportTriage(selectedReport.id);
      setTriageAssessment(triageData);
      setToast("Triage assistant refreshed.");
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to run triage assistant");
    }
  }

  async function applyBulkStatus() {
    if (selectedIds.length === 0) return;
    setError("");
    try {
      await Promise.all(selectedIds.map((reportId) => patchReportStatus(reportId, { status: bulkStatus })));
      setToast(`Updated ${selectedIds.length} report(s) to ${bulkStatus}.`);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to apply bulk action");
    }
  }

  const selectedSummary = useMemo(() => reports.filter((report) => selectedIds.includes(report.id)), [reports, selectedIds]);

  return (
    <section className="section">
      <Toast message={toast} />
      <div className="section-header">
        <div>
          <h2>Report Triage</h2>
          <p className="muted">Search, filter, review, and action incoming VDP reports with a structured workflow from submission through resolution.</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="card field">
        <div className="toolbar-grid">
          <input className="input" placeholder="Search title, asset, description, or reporter" value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} />
          <select className="select" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select className="select" value={filters.severity} onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}>
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="select" value={filters.overdue} onChange={(e) => setFilters((prev) => ({ ...prev, overdue: e.target.value }))}>
            <option value="">All SLA states</option>
            <option value="1">Overdue only</option>
            <option value="0">On-time only</option>
          </select>
          <button className="btn" onClick={() => load(filters)}>Apply Filters</button>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="card field">
          <h3>Bulk Actions</h3>
          <div className="toolbar-grid">
            <select className="select" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <button className="btn secondary" type="button" onClick={applyBulkStatus}>Apply To Selected</button>
          </div>
          <FieldHint>{selectedSummary.length} report(s) selected for bulk update.</FieldHint>
        </div>
      ) : null}

      {loading ? <LoadingCard label="Loading report queue..." /> : null}

      {!loading && reports.length === 0 ? (
        <EmptyState
          icon="search"
          title="No reports match these filters"
          description="Try broadening the search or clearing one of the status, severity, or SLA filters."
        />
      ) : null}

      {!loading && reports.length > 0 ? (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelectedIds(allSelected ? [] : reports.map((report) => report.id))}
                  />
                </th>
                <th>ID</th>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const sla = detectSlaState(report);
                return (
                  <tr key={report.id} onClick={() => openReport(report.id)} className="table-row-clickable">
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(report.id)}
                        onChange={() => setSelectedIds((prev) => prev.includes(report.id) ? prev.filter((id) => id !== report.id) : [...prev, report.id])}
                      />
                    </td>
                    <td>{report.id.slice(0, 8)}</td>
                    <td>
                      <strong>{report.title}</strong>
                      <div className="card-sub">{report.affected_asset || "No asset provided"}</div>
                    </td>
                    <td><SeverityBadge severity={report.severity} /></td>
                    <td><StatusBadge status={report.status} /></td>
                    <td>{formatDateTime(report.created_at || report.createdAt)}</td>
                    <td><SLABadge overdue={sla.overdue} label={sla.label} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal
        open={Boolean(selectedReport) || detailLoading}
        title={selectedReport ? selectedReport.title : "Loading report"}
        subtitle={selectedReport ? `${selectedReport.id.slice(0, 8)} • ${selectedReport.reporter_name || "Anonymous reporter"}` : "Fetching report details"}
        onClose={() => setSelectedReport(null)}
        footer={
          selectedReport ? (
            <>
              <button type="button" className="btn secondary" onClick={() => setSelectedReport(null)}>Close</button>
              <button type="button" className="btn secondary" onClick={saveAssignee}>Assign To Triager</button>
              <button type="button" className="btn secondary" onClick={saveComment}>Add Comment</button>
              <button type="button" className="btn secondary" onClick={sendInfoRequest}>Request More Info</button>
              <button type="button" className="btn" onClick={saveStatus}>Save Actions</button>
            </>
          ) : null
        }
      >
        {detailLoading || !selectedReport ? (
          <LoadingCard label="Loading full report detail..." />
        ) : (
          <div className="modal-grid">
            <div className="modal-main">
              <div className="badge-row">
                <SeverityBadge severity={selectedReport.severity} />
                <StatusBadge status={selectedReport.status} />
                <SLABadge overdue={detectSlaState(selectedReport).overdue} label={detectSlaState(selectedReport).label} />
              </div>
              <div className="detail-block">
                <h4>Report Summary</h4>
                <p><strong>Affected asset:</strong> {selectedReport.affected_asset || "Not provided"}</p>
                <p><strong>Vulnerability type:</strong> {selectedReport.vulnerability_type || "Not provided"}</p>
                <p><strong>CWE:</strong> {selectedReport.cwe || "Not provided"}</p>
                <p><strong>Submitted:</strong> {formatDateTime(selectedReport.created_at)}</p>
              </div>
              <div className="detail-block">
                <h4>Description</h4>
                <p>{selectedReport.description || "No description provided."}</p>
                <h4>Steps To Reproduce</h4>
                <p>{selectedReport.steps_to_reproduce || "No reproduction steps provided."}</p>
                <h4>Impact</h4>
                <p>{selectedReport.impact || "No impact statement provided."}</p>
                <h4>PoC</h4>
                <p>{selectedReport.poc || "No proof of concept provided."}</p>
              </div>
              <div className="detail-block">
                <h4>Attachments</h4>
                {attachments.length === 0 ? (
                  <FieldHint>No attachments uploaded yet.</FieldHint>
                ) : (
                  <div className="attachment-list">
                    {attachments.map((attachment) => (
                      <a key={attachment.id || attachment.object_key} href={attachment.download_url || attachment.url || "#"} target="_blank" rel="noreferrer" className="attachment-chip">
                        {attachment.filename || attachment.object_key}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="detail-block">
                <h4>Activity</h4>
                {events.length === 0 ? <FieldHint>No workflow events yet.</FieldHint> : null}
                <div className="timeline-list">
                  {events.map((item) => (
                    <div key={`${item.id || item.created_at}-${item.event_type}`} className="timeline-item">
                      <strong>{item.event_type || "Update"}</strong>
                      <p>{item.actor_email || item.actor_type || "System"}</p>
                      <p>{formatDateTime(item.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-side">
              <div className="detail-block">
                <h4>Workflow Actions</h4>
                <div className="field">
                  <label>Change Status</label>
                  <select className="select" value={detailForm.status} onChange={(e) => setDetailForm((prev) => ({ ...prev, status: e.target.value }))}>
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Status Reason</label>
                  <textarea className="input" rows={3} placeholder="Required for rejected, duplicate, or needs-info transitions." value={detailForm.status_reason} onChange={(e) => setDetailForm((prev) => ({ ...prev, status_reason: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Public Notes</label>
                  <textarea className="input" rows={3} placeholder="Visible notes for the reporter." value={detailForm.public_notes} onChange={(e) => setDetailForm((prev) => ({ ...prev, public_notes: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Internal Notes</label>
                  <textarea className="input" rows={3} placeholder="Internal reasoning for triage teammates." value={detailForm.internal_notes} onChange={(e) => setDetailForm((prev) => ({ ...prev, internal_notes: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Duplicate Of</label>
                  <input className="input" placeholder="Other report ID when marked duplicate" value={detailForm.duplicate_of} onChange={(e) => setDetailForm((prev) => ({ ...prev, duplicate_of: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Needs Info Window (days)</label>
                  <input className="input" type="number" min="1" value={detailForm.needs_info_days} onChange={(e) => setDetailForm((prev) => ({ ...prev, needs_info_days: e.target.value }))} />
                </div>
              </div>

              <div className="detail-block">
                <h4>Assign To Triager</h4>
                <input className="input" placeholder="Triager name" value={detailForm.assignee_name} onChange={(e) => setDetailForm((prev) => ({ ...prev, assignee_name: e.target.value }))} />
                <input className="input" placeholder="triage@company.com" value={detailForm.assignee_email} onChange={(e) => setDetailForm((prev) => ({ ...prev, assignee_email: e.target.value }))} />
              </div>

              <div className="detail-block">
                <h4>Comments & Collaboration Timeline</h4>
                <textarea className="input" rows={3} placeholder="Add a comment to the triage timeline..." value={commentBody} onChange={(e) => setCommentBody(e.target.value)} />
                <div className="comment-thread" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                  {comments.map((comment) => {
                    const isOrgAdmin = comment.author_type === "organization_admin";
                    return (
                      <div 
                        key={`${comment.id || comment.created_at}-${comment.body}`} 
                        className={`comment-card ${isOrgAdmin ? "admin-bubble" : "hacker-bubble"}`}
                        style={{
                          alignSelf: isOrgAdmin ? "flex-end" : "flex-start",
                          width: "100%",
                          maxWidth: "90%",
                          borderLeft: isOrgAdmin ? "4px solid #f59e0b" : "4px solid #3b82f6",
                          background: isOrgAdmin ? "rgba(245, 158, 11, 0.05)" : "rgba(59, 130, 246, 0.05)",
                          padding: "10px 14px",
                          borderRadius: "12px",
                          border: "1px solid var(--border)",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "0.8rem", color: isOrgAdmin ? "#f59e0b" : "#60a5fa" }}>
                            {comment.author_email || comment.author_type}
                          </strong>
                          <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                            {formatDateTime(comment.created_at)}
                          </span>
                        </div>
                        <p style={{ margin: "4px 0", fontSize: "0.85rem", lineHeight: "1.45" }}>{comment.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="detail-block">
                <h4>Request More Info</h4>
                <textarea className="input" rows={3} placeholder="Ask the reporter for reproduction details, screenshots, or scope clarification." value={requestMoreInfo} onChange={(e) => setRequestMoreInfo(e.target.value)} />
              </div>

              <div className="detail-block">
                <h4>Triage Assistant</h4>
                {triageAssessment ? (
                  <div className="assistant-card">
                    <p><strong>Suggested severity:</strong> {triageAssessment.suggested_severity || "Unknown"}</p>
                    <p><strong>Suggested CWE:</strong> {triageAssessment.suggested_cwe || "Unknown"}</p>
                    <p><strong>Duplicate confidence:</strong> {Number(triageAssessment.duplicate_confidence || 0).toFixed(2)}</p>
                  </div>
                ) : (
                  <FieldHint>No triage assistant output yet.</FieldHint>
                )}
                <button type="button" className="btn secondary" onClick={runAssistant}>Run Assistant</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
