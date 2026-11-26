import { useEffect, useMemo, useState } from "react";
import api, { submitVulnerabilityReport } from "../services/api";

function parseRequirements(text) {
  const t = (text || "").toLowerCase();
  return {
    requirePOC: t.includes("poc") || t.includes("proof of concept"),
  };
}

function severityTone(value) {
  if (value === "critical") return "critical";
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "low") return "low";
  return "informational";
}

export default function ReportSubmissionForm({ orgId, programId, procedure: initialProcedure = null }) {
  const [procedure, setProcedure] = useState(initialProcedure);
  const [readPolicy, setReadPolicy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({
    reporter_email: "",
    reporter_name: "",
    title: "",
    affected_asset: "",
    vulnerability_type: "",
    description: "",
    steps_to_reproduce: "",
    impact: "",
    severity: "medium",
    poc: "",
    attack_vector: "",
    cwe: "",
    reference_links: "",
  });
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  useEffect(() => {
    if (initialProcedure?.id) {
      setProcedure(initialProcedure);
      return;
    }
    if (!orgId) return;
    api
      .get(`/organizations/${orgId}/procedure`)
      .then((res) => setProcedure(res.data))
      .catch(() => setError("Unable to load procedure"));
  }, [orgId, initialProcedure]);

  const req = useMemo(
    () => parseRequirements(procedure?.reporting_requirements),
    [procedure]
  );

  const acceptPolicy = () => {
    if (!procedure?.id) return;
    if (!readPolicy) {
      setError("Read the procedure before accepting");
      return;
    }
    setAccepted(true);
    setError("");
  };

  const submit = async () => {
    setError("");
    if (!readPolicy || !accepted) {
      setError("Read and accept the policy before submitting");
      return;
    }
    try {
      const evidenceSummary = evidenceFiles.map((file) => file.name).join(", ");
      const data = await submitVulnerabilityReport({
        program_id: programId,
        reporter_email: form.reporter_email,
        reporter_name: form.reporter_name,
        title: form.title,
        affected_asset: form.affected_asset,
        vulnerability_type: form.vulnerability_type,
        description: form.description,
        steps_to_reproduce: form.steps_to_reproduce,
        impact: form.impact,
        severity: form.severity,
        poc: form.poc,
        attack_vector: form.attack_vector,
        cwe: form.cwe,
        reference_links: evidenceSummary
          ? [form.reference_links, `Evidence files selected at submission: ${evidenceSummary}`].filter(Boolean).join("\n")
          : form.reference_links,
        accepted_policy: true,
      });
      setSuccessId(data.id);
      setEvidenceFiles([]);
      setForm({
        reporter_email: "",
        reporter_name: "",
        title: "",
        affected_asset: "",
        vulnerability_type: "",
        description: "",
        steps_to_reproduce: "",
        impact: "",
        severity: "medium",
        poc: "",
        attack_vector: "",
        cwe: "",
        reference_links: "",
      });
    } catch (e) {
      const msg = e?.response?.data?.error || "Report submission failed";
      setError(msg);
    }
  };

  if (!programId) return <div>Missing program information</div>;

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>Submit Vulnerability Report</h2>
          <p className="muted">Share clear evidence so the security team can reproduce and validate quickly.</p>
        </div>
        <span className={`severity-chip ${severityTone(form.severity)}`}>
          {form.severity.toUpperCase()}
        </span>
      </div>

      {procedure ? (
        <div className="callout field">
          <h3>Legal Safe Harbor</h3>
          <p>{procedure.legal_safe_harbor}</p>
        </div>
      ) : null}

      <div className="field-grid">
        <div className="field">
          <label>Contact Email</label>
          <input
            className="input"
            placeholder="researcher@domain.com"
            value={form.reporter_email}
            onChange={(e) => setForm({ ...form, reporter_email: e.target.value })}
            required
          />
          <div className="muted">Used only for secure report updates.</div>
        </div>

        <div className="field">
          <label>Reporter Name (optional)</label>
          <input
            className="input"
            placeholder="Your preferred name"
            value={form.reporter_name}
            onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
          />
        </div>
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={readPolicy}
          onChange={(e) => setReadPolicy(e.target.checked)}
        />
        <span>I have read the policy and scope constraints</span>
      </label>

      <div className="actions">
        <button onClick={acceptPolicy} disabled={!readPolicy || accepted} className="btn secondary">
          {accepted ? "Policy Accepted" : "Accept Policy"}
        </button>
      </div>

      <div className="field-grid">
        <div className="field">
          <label>Vulnerability Title</label>
          <input
            className="input"
            placeholder="Example: IDOR in invoice download endpoint"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Affected Asset / URL</label>
          <input
            className="input"
            placeholder="https://target.example.com/path"
            value={form.affected_asset}
            onChange={(e) => setForm({ ...form, affected_asset: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label>Vulnerability Type</label>
          <input
            className="input"
            placeholder="IDOR, SSRF, SQLi, Broken Access Control..."
            value={form.vulnerability_type}
            onChange={(e) => setForm({ ...form, vulnerability_type: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Severity (self-assessment)</label>
          <select
            className="select"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            required
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="informational">Informational</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Detailed Description</label>
        <textarea
          className="input"
          placeholder="Describe the issue, impacted logic, and why this is exploitable."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={5}
          required
        />
      </div>

      <div className="field-grid">
        <div className="field">
          <label>Steps to Reproduce</label>
          <textarea
            className="input"
            placeholder="Step-by-step proof with inputs and expected/actual behavior."
            value={form.steps_to_reproduce}
            onChange={(e) => setForm({ ...form, steps_to_reproduce: e.target.value })}
            rows={4}
            required
          />
        </div>
        <div className="field">
          <label>Impact</label>
          <textarea
            className="input"
            placeholder="Business or security impact: data exposure, privilege abuse, account takeover, etc."
            value={form.impact}
            onChange={(e) => setForm({ ...form, impact: e.target.value })}
            rows={4}
            required
          />
        </div>
      </div>

      <div className="field">
        <label>Proof of Concept (PoC)</label>
        <textarea
          className="input"
          placeholder="Payloads, request/response samples, and concise proof details."
          value={form.poc}
          onChange={(e) => setForm({ ...form, poc: e.target.value })}
          required={req.requirePOC}
          rows={4}
        />
      </div>

      <div className="field-grid">
        <div className="field">
          <label>Attack Vector (optional)</label>
          <input
            className="input"
            placeholder="Network, authenticated user, adjacent network..."
            value={form.attack_vector}
            onChange={(e) => setForm({ ...form, attack_vector: e.target.value })}
          />
        </div>
        <div className="field">
          <label>CWE (optional)</label>
          <input
            className="input"
            placeholder="CWE-639"
            value={form.cwe}
            onChange={(e) => setForm({ ...form, cwe: e.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label>Reference Links (optional)</label>
        <textarea
          className="input"
          placeholder="Links to docs, proof files, videos, or supplemental notes."
          value={form.reference_links}
          onChange={(e) => setForm({ ...form, reference_links: e.target.value })}
          rows={2}
        />
      </div>

      <div className="field">
        <label>Evidence Files (optional)</label>
        <div className="callout">
          <p>
            Attach screenshots, logs, or PoC artifacts here as a submission note. You can upload full files to the report tracker after the report ID is issued.
          </p>
        </div>
        <input
          className="input"
          type="file"
          multiple
          onChange={(event) => setEvidenceFiles(Array.from(event.target.files || []))}
        />
        {evidenceFiles.length > 0 ? (
          <div className="actions">
            {evidenceFiles.map((file, index) => (
              <span key={`${file.name}-${index}`} className="pill">{file.name}</span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="callout field">
        <h3>Evidence Attachments</h3>
        <p>
          After submission you can attach files from the tracker section below using your Report ID and email.
        </p>
      </div>

      <div className="actions">
        <button onClick={submit} className="btn">
          Submit Report
        </button>
      </div>

      {successId && (
        <div className="success">
          Report submitted successfully. Your Report ID: <strong>{successId}</strong>. Use the tracker below to add comments or attachments.
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
