import { useMemo, useState } from "react";
import api from "../services/api";

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (["critical", "rejected"].includes(s)) return "critical";
  if (["high", "needs_info", "pending"].includes(s)) return "high";
  if (["medium", "triaged"].includes(s)) return "medium";
  if (["low", "accepted", "resolved", "closed"].includes(s)) return "low";
  return "informational";
}

export default function ReportTracker() {
  const [reportId, setReportId] = useState("");
  const [email, setEmail] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasContext = useMemo(() => Boolean(reportId && email), [reportId, email]);

  const load = async () => {
    setError("");
    if (!reportId || !email) {
      setError("Enter your report ID and email");
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/reports/${reportId}/status`, { params: { email } });
      setStatus(res.data);
      const c = await api.get(`/reports/${reportId}/comments`, { params: { email } });
      setComments(c.data || []);
      const a = await api.get(`/reports/${reportId}/attachments`, { params: { email } });
      setAttachments(a.data || []);
    } catch {
      setError("Unable to load report status");
    } finally {
      setLoading(false);
    }
  };

  const sendComment = async () => {
    setError("");
    if (!reportId || !email || !comment.trim()) {
      setError("Provide report ID, email, and a comment");
      return;
    }
    try {
      await api.post(`/reports/${reportId}/comments`, { email, body: comment });
      setComment("");
      await load();
    } catch {
      setError("Failed to post comment");
    }
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!reportId || !email) {
      setError("Enter your report ID and email before uploading");
      return;
    }
    setSelectedFile(file);
    const form = new FormData();
    form.append("reporter_email", email);
    form.append("file", file);
    try {
      await api.post(`/reports/${reportId}/attachments`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSelectedFile(null);
      await load();
    } catch {
      setError("Upload failed");
    }
  };

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>Track Your Report</h2>
          <p className="muted">Use your report ID and reporter email to view status, add comments, and upload supporting files.</p>
        </div>
        {status ? <span className={`severity-chip ${statusTone(status.status)}`}>{status.status}</span> : <span className="pill">Reporter view</span>}
      </div>

      <div className="field-grid">
        <input
          className="input"
          placeholder="Report ID (example: rpt_1234abcd)"
          value={reportId}
          onChange={(e) => setReportId(e.target.value)}
        />
        <input
          className="input"
          placeholder="Reporter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="actions">
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Load Status"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <div className="card-grid">
          <div className="card"><div className="card-title">Loading report status...</div></div>
          <div className="card"><div className="card-title">Loading conversation...</div></div>
        </div>
      ) : null}

      {status ? (
        <div className="card field">
          <div className="section-head-row">
            <h3>Current Status</h3>
            <span className={`severity-chip ${statusTone(status.status)}`}>{status.status}</span>
          </div>
          <p>Reason: {status.status_reason || "-"}</p>
          <p>Public notes: {status.public_notes || "-"}</p>
        </div>
      ) : null}

      <div className="field-grid">
        <div className="field">
          <label>Add Comment</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Share clarifications, updates, or additional repro context."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="actions">
            <button className="btn secondary" onClick={sendComment} disabled={!hasContext}>
              Send Comment
            </button>
          </div>
        </div>

        <div className="field">
          <label>Upload Attachment (max 25MB)</label>
          <input className="input" type="file" onChange={uploadFile} />
          {selectedFile ? (
            <div className="muted">
              Selected: {selectedFile.name} · {Math.round(selectedFile.size / 1024)} KB
            </div>
          ) : (
            <div className="muted">Screenshots, PoC videos, and logs help accelerate triage.</div>
          )}
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <h3>Comments & Discussion</h3>
          {comments.length === 0 ? (
            <div className="callout">No comments yet. Share clarification, additional PoC context, or remediation details here.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
              {comments.map((c) => {
                const isHacker = c.author_type === "hacker";
                return (
                  <div 
                    key={c.id} 
                    className={`card field ${isHacker ? "hacker-bubble" : "admin-bubble"}`}
                    style={{
                      margin: 0,
                      alignSelf: isHacker ? "flex-end" : "flex-start",
                      width: "100%",
                      maxWidth: "90%",
                      borderLeft: isHacker ? "4px solid #3b82f6" : "4px solid #f59e0b",
                      background: isHacker ? "rgba(59, 130, 246, 0.05)" : "rgba(245, 158, 11, 0.05)",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "0.8rem", color: isHacker ? "#60a5fa" : "#f59e0b" }}>
                        {isHacker ? "You (Reporter)" : "Triager / Team"}
                      </strong>
                      <span className="muted" style={{ fontSize: "0.7rem" }}>
                        {c.created_at ? new Date(c.created_at).toLocaleString() : "recently"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.85rem", lineHeight: "1.45", color: "var(--text)" }}>{c.body}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="field">
          <h3>Attachments</h3>
          {attachments.length === 0 ? (
            <div className="callout">No attachments uploaded yet. Upload screenshots or logs to speed up triage.</div>
          ) : (
            attachments.map((a) => (
              <div key={a.id} className="card field">
                <a href={`/api/vdp/reports/${reportId}/attachments/${a.id}?email=${encodeURIComponent(email)}`}>{a.filename}</a>
                <div className="muted">{Math.round(a.size_bytes / 1024)} KB</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
