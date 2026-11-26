import { useEffect, useMemo, useState } from "react";
import { FieldHint, HelpTooltip, LoadingCard, Modal, StatusBadge, Toast } from "../components/AdminUI";
import {
  createVDPProgram,
  getOrgSettings,
  getOrgVdp,
  getProcedureTemplate,
  publishVDPProgram,
  updateOrgSettings,
  updateProcedure,
  updateProgram,
  uploadProcedureDocument,
} from "../services/api";

const defaultSlaSettings = {
  triage_sla_hours: 72,
  resolution_sla_low_days: 60,
  resolution_sla_medium_days: 30,
  resolution_sla_high_days: 14,
  resolution_sla_critical_days: 7,
  webhook_enabled: false,
  webhook_url: "",
  webhook_secret: "",
};

const slaPresets = {
  standard: {
    label: "Standard",
    values: {
      triage_sla_hours: 72,
      resolution_sla_low_days: 60,
      resolution_sla_medium_days: 30,
      resolution_sla_high_days: 14,
      resolution_sla_critical_days: 7,
    },
  },
  strict: {
    label: "Strict",
    values: {
      triage_sla_hours: 24,
      resolution_sla_low_days: 21,
      resolution_sla_medium_days: 10,
      resolution_sla_high_days: 5,
      resolution_sla_critical_days: 2,
    },
  },
  relaxed: {
    label: "Relaxed",
    values: {
      triage_sla_hours: 96,
      resolution_sla_low_days: 90,
      resolution_sla_medium_days: 45,
      resolution_sla_high_days: 21,
      resolution_sla_critical_days: 10,
    },
  },
};

function detectPreset(settings) {
  const match = Object.entries(slaPresets).find(([, preset]) =>
    Object.entries(preset.values).every(([key, value]) => Number(settings[key]) === value)
  );
  return match ? match[0] : "custom";
}

function toList(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fromList(items) {
  return items.filter(Boolean).join("\n");
}

function renderMarkdownLite(value) {
  return String(value || "")
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return <li key={`${line}-${index}`}>{line.slice(2)}</li>;
      }
      if (line.startsWith("## ")) {
        return <h4 key={`${line}-${index}`}>{line.slice(3)}</h4>;
      }
      if (line.startsWith("# ")) {
        return <h3 key={`${line}-${index}`}>{line.slice(2)}</h3>;
      }
      return <p key={`${line}-${index}`}>{line}</p>;
    });
}

function DynamicListField({ label, items, onChange, placeholder, helper }) {
  function updateAt(index, value) {
    const next = [...items];
    next[index] = value;
    onChange(next);
  }

  function addItem() {
    onChange([...items, ""]);
  }

  function removeItem(index) {
    onChange(items.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="field">
      <label>{label}</label>
      {helper ? <FieldHint>{helper}</FieldHint> : null}
      <div className="dynamic-list">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="dynamic-list-row">
            <input className="input" placeholder={placeholder} value={item} onChange={(event) => updateAt(index, event.target.value)} />
            <button type="button" className="btn secondary" onClick={() => removeItem(index)}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn secondary" onClick={addItem}>Add Item</button>
      </div>
    </div>
  );
}

export default function ProgramSetupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [vdp, setVdp] = useState(null);
  const [confirmAction, setConfirmAction] = useState("");
  const [procedureForm, setProcedureForm] = useState({
    overview: "",
    scope: "",
    out_of_scope: "",
    reporting_requirements: "",
    severity_rules: "",
    response_timeline: "",
    legal_safe_harbor: "",
    prohibited_actions: "",
    status: "draft",
  });
  const [programForm, setProgramForm] = useState({
    title: "",
    description: "",
    contact_email: "",
    visibility: "private",
    status: "draft",
  });
  const [docFile, setDocFile] = useState(null);
  const [settingsForm, setSettingsForm] = useState(defaultSlaSettings);
  const [slaPreset, setSlaPreset] = useState("standard");

  const hasProcedure = Boolean(vdp?.has_procedure);
  const hasProgram = Boolean(vdp?.has_program);
  const scopeItems = useMemo(() => toList(procedureForm.scope), [procedureForm.scope]);
  const outOfScopeItems = useMemo(() => toList(procedureForm.out_of_scope), [procedureForm.out_of_scope]);
  const currentPolicyPdf = vdp?.policy_pdf || null;

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [vdpData, template, settingsData] = await Promise.all([
        getOrgVdp(),
        getProcedureTemplate(),
        getOrgSettings().catch(() => null),
      ]);
      setVdp(vdpData);
      const sourceProcedure = vdpData?.has_procedure ? vdpData.procedure : template;
      setProcedureForm({
        overview: sourceProcedure?.overview || "",
        scope: sourceProcedure?.scope || "",
        out_of_scope: sourceProcedure?.out_of_scope || "",
        reporting_requirements: sourceProcedure?.reporting_requirements || "",
        severity_rules: sourceProcedure?.severity_rules || "",
        response_timeline: sourceProcedure?.response_timeline || "",
        legal_safe_harbor: sourceProcedure?.legal_safe_harbor || "",
        prohibited_actions: sourceProcedure?.prohibited_actions || "",
        status: sourceProcedure?.status || "draft",
      });
      setProgramForm({
        title: vdpData?.program?.title || "",
        description: vdpData?.program?.description || "",
        contact_email: vdpData?.program?.contact_email || "",
        visibility: vdpData?.program?.visibility || "private",
        status: vdpData?.program?.status || "draft",
      });
      const mergedSettings = { ...defaultSlaSettings, ...(settingsData || {}) };
      setSettingsForm(mergedSettings);
      setSlaPreset(detectPreset(mergedSettings));
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to load VDP setup data");
    } finally {
      setLoading(false);
    }
  }

  function applySlaPreset(nextPreset) {
    setSlaPreset(nextPreset);
    if (nextPreset === "custom") return;
    setSettingsForm((prev) => ({ ...prev, ...(slaPresets[nextPreset]?.values || {}) }));
  }

  async function saveSlaSettings(event) {
    event.preventDefault();
    setError("");
    try {
      await updateOrgSettings({
        ...settingsForm,
        triage_sla_hours: Number(settingsForm.triage_sla_hours),
        resolution_sla_low_days: Number(settingsForm.resolution_sla_low_days),
        resolution_sla_medium_days: Number(settingsForm.resolution_sla_medium_days),
        resolution_sla_high_days: Number(settingsForm.resolution_sla_high_days),
        resolution_sla_critical_days: Number(settingsForm.resolution_sla_critical_days),
      });
      setToast("SLA configuration saved.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to save SLA settings");
    }
  }

  async function saveProcedure(event) {
    event.preventDefault();
    if (!hasProcedure) {
      setError("Create the VDP program first. The disclosure procedure is generated during program creation.");
      return;
    }
    setError("");
    try {
      await updateProcedure(vdp.procedure.id, procedureForm);
      setToast("Disclosure procedure saved.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to save procedure");
    }
  }

  async function uploadPdf(event) {
    event.preventDefault();
    if (!docFile || !hasProcedure) {
      setError("Save the procedure first and choose a PDF file.");
      return;
    }
    setError("");
    try {
      await uploadProcedureDocument(vdp.procedure.id, docFile);
      setDocFile(null);
      setToast("Procedure PDF uploaded.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to upload PDF");
    }
  }

  async function saveProgram(event) {
    event.preventDefault();
    setError("");
    try {
      if (hasProgram) {
        await updateProgram(vdp.program.id, programForm);
      } else {
        if (!docFile) {
          setError("Upload the policy PDF before creating the VDP program.");
          return;
        }
        await createVDPProgram({
          title: programForm.title,
          description: programForm.description,
          contact_email: programForm.contact_email,
          scope: procedureForm.scope,
          out_of_scope: procedureForm.out_of_scope,
          overview: procedureForm.overview,
          reporting_requirements: procedureForm.reporting_requirements,
          severity_rules: procedureForm.severity_rules,
          response_timeline: procedureForm.response_timeline,
          legal_safe_harbor: procedureForm.legal_safe_harbor,
          prohibited_actions: procedureForm.prohibited_actions,
          visibility: programForm.visibility,
          status: programForm.status,
          policy_pdf: docFile,
        });
        setDocFile(null);
      }
      setToast("Program configuration saved.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to save program");
    }
  }

  async function runConfirmAction() {
    if (!hasProgram) {
      setError("Create the VDP program first.");
      setConfirmAction("");
      return;
    }
    setError("");
    try {
      if (confirmAction === "publish") {
        await publishVDPProgram(vdp.program.id);
        setToast("VDP program published.");
      } else if (confirmAction === "unpublish") {
        await updateProgram(vdp.program.id, { visibility: "private", status: "paused" });
        setToast("VDP program unpublished.");
      }
      setConfirmAction("");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || `Failed to ${confirmAction} program`);
    }
  }

  const checklist = [
    { label: "Disclosure procedure", done: hasProcedure },
    { label: "Policy PDF", done: Boolean(currentPolicyPdf || docFile) },
    { label: "Published program", done: hasProgram && programForm.status === "active" && programForm.visibility === "public" },
  ];

  return (
    <section className="section">
      <Toast message={toast} />
      <div className="section-header">
        <div>
          <h2>Program Setup</h2>
          <p className="muted">Tune your SLAs, define the disclosure procedure, manage the policy PDF, and control whether your program is publicly live.</p>
        </div>
        {hasProgram ? <StatusBadge status={programForm.status} /> : <StatusBadge status="draft" />}
      </div>

      {loading ? <LoadingCard label="Loading VDP setup..." /> : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="card-grid">
        <div className="card field">
          <h3>Setup Checklist</h3>
          {checklist.map((item) => (
            <div key={item.label} className="list-row">
              <span>{item.label}</span>
              <StatusBadge status={item.done ? "active" : "draft"} />
            </div>
          ))}
        </div>

        <div className="card field">
          <h3>Program Status</h3>
          <p className="muted">Current visibility: <strong>{programForm.visibility}</strong></p>
          <p className="muted">Current lifecycle: <strong>{programForm.status}</strong></p>
          {vdp?.public_path ? <p className="muted">Public page: <strong>{vdp.public_path}</strong></p> : null}
          <div className="actions">
            <button className="btn" type="button" onClick={() => setConfirmAction("publish")}>Publish VDP</button>
            <button className="btn secondary" type="button" onClick={() => setConfirmAction("unpublish")}>Unpublish VDP</button>
          </div>
        </div>
      </div>

      <form className="card field" onSubmit={saveSlaSettings}>
        <h3>SLA Configuration</h3>
        <div className="card-grid">
          <div className="field">
            <label>SLA Preset</label>
            <select className="select" value={slaPreset} onChange={(e) => applySlaPreset(e.target.value)}>
              {Object.entries(slaPresets).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
            <FieldHint>Standard balances responsiveness, Strict is faster, and Relaxed gives teams more investigation time.</FieldHint>
          </div>
          <div className="field">
            <label>
              Triage SLA (hours) <HelpTooltip text="How long your team has to acknowledge and triage newly submitted reports." />
            </label>
            <input className="input" type="number" min="1" max="720" value={settingsForm.triage_sla_hours} onChange={(e) => { setSlaPreset("custom"); setSettingsForm((prev) => ({ ...prev, triage_sla_hours: e.target.value })); }} required />
          </div>
          <div className="field">
            <label>Resolution SLA - Critical (days)</label>
            <input className="input" type="number" min="1" max="365" value={settingsForm.resolution_sla_critical_days} onChange={(e) => { setSlaPreset("custom"); setSettingsForm((prev) => ({ ...prev, resolution_sla_critical_days: e.target.value })); }} required />
          </div>
          <div className="field">
            <label>Resolution SLA - High (days)</label>
            <input className="input" type="number" min="1" max="365" value={settingsForm.resolution_sla_high_days} onChange={(e) => { setSlaPreset("custom"); setSettingsForm((prev) => ({ ...prev, resolution_sla_high_days: e.target.value })); }} required />
          </div>
          <div className="field">
            <label>Resolution SLA - Medium (days)</label>
            <input className="input" type="number" min="1" max="365" value={settingsForm.resolution_sla_medium_days} onChange={(e) => { setSlaPreset("custom"); setSettingsForm((prev) => ({ ...prev, resolution_sla_medium_days: e.target.value })); }} required />
          </div>
          <div className="field">
            <label>Resolution SLA - Low (days)</label>
            <input className="input" type="number" min="1" max="365" value={settingsForm.resolution_sla_low_days} onChange={(e) => { setSlaPreset("custom"); setSettingsForm((prev) => ({ ...prev, resolution_sla_low_days: e.target.value })); }} required />
          </div>
        </div>
        <div className="actions">
          <button className="btn secondary" type="submit">Save SLA Settings</button>
        </div>
      </form>

      <div className="split">
        <form className="card field" onSubmit={saveProcedure}>
          <h3>Disclosure Procedure</h3>
          <div className="field">
            <label>Overview</label>
            <textarea className="input markdown-area" rows={5} placeholder="Explain what kind of security reports you welcome and how your team responds." value={procedureForm.overview} onChange={(e) => setProcedureForm((prev) => ({ ...prev, overview: e.target.value }))} required />
            <FieldHint>Supports lightweight markdown like headings and bullet points.</FieldHint>
          </div>
          <DynamicListField
            label="Scope"
            items={scopeItems.length ? scopeItems : [""]}
            onChange={(items) => setProcedureForm((prev) => ({ ...prev, scope: fromList(items) }))}
            placeholder="Example: api.acme.com"
            helper="List assets or features that are in scope."
          />
          <DynamicListField
            label="Out Of Scope"
            items={outOfScopeItems.length ? outOfScopeItems : [""]}
            onChange={(items) => setProcedureForm((prev) => ({ ...prev, out_of_scope: fromList(items) }))}
            placeholder="Example: Production employee laptops"
            helper="Call out systems or behaviors that researchers should avoid."
          />
          <div className="field">
            <label>Reporting Requirements</label>
            <textarea className="input markdown-area" rows={5} placeholder="Ask for PoC quality, reproducibility, impact details, and safe reproduction steps." value={procedureForm.reporting_requirements} onChange={(e) => setProcedureForm((prev) => ({ ...prev, reporting_requirements: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Severity Rules</label>
            <textarea className="input markdown-area" rows={5} placeholder="Describe how severity is judged inside your VDP." value={procedureForm.severity_rules} onChange={(e) => setProcedureForm((prev) => ({ ...prev, severity_rules: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Response Timeline</label>
            <textarea className="input markdown-area" rows={4} placeholder="Explain how acknowledgements, triage, and resolution updates are communicated." value={procedureForm.response_timeline} onChange={(e) => setProcedureForm((prev) => ({ ...prev, response_timeline: e.target.value }))} required />
          </div>
          <div className="field">
            <label>
              Legal Safe Harbor <HelpTooltip text="State what approved testing researchers can perform without fear of escalation when they follow the program rules." />
            </label>
            <textarea className="input markdown-area" rows={5} placeholder="Document safe harbor and responsible disclosure commitments." value={procedureForm.legal_safe_harbor} onChange={(e) => setProcedureForm((prev) => ({ ...prev, legal_safe_harbor: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Prohibited Actions</label>
            <textarea className="input markdown-area" rows={4} placeholder="Document social engineering bans, denial-of-service restrictions, and privacy-sensitive exclusions." value={procedureForm.prohibited_actions} onChange={(e) => setProcedureForm((prev) => ({ ...prev, prohibited_actions: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Procedure Status</label>
            <select className="select" value={procedureForm.status} onChange={(e) => setProcedureForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <div className="actions">
            <button className="btn" type="submit">Save Procedure</button>
          </div>
        </form>

        <div className="card field">
          <h3>Markdown Preview</h3>
          <div className="markdown-preview">
            {renderMarkdownLite(procedureForm.overview)}
            <h4>Scope</h4>
            <ul>{scopeItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
            <h4>Out Of Scope</h4>
            <ul>{outOfScopeItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
            <h4>Reporting Requirements</h4>
            {renderMarkdownLite(procedureForm.reporting_requirements)}
            <h4>Safe Harbor</h4>
            {renderMarkdownLite(procedureForm.legal_safe_harbor)}
          </div>
        </div>
      </div>

      <div className="card-grid">
        <form className="card field" onSubmit={uploadPdf}>
          <h3>Procedure PDF</h3>
          <input className="input" type="file" accept="application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
          {docFile ? <FieldHint>Selected file: {docFile.name}</FieldHint> : null}
          {currentPolicyPdf ? (
            <div className="file-chip-row">
              <span className="pill">{currentPolicyPdf.filename}</span>
              <a className="btn secondary" href={currentPolicyPdf.download_url} target="_blank" rel="noreferrer">Preview PDF</a>
            </div>
          ) : null}
          <div className="actions">
            <button className="btn secondary" type="submit">Upload PDF</button>
            {docFile ? <button className="btn secondary" type="button" onClick={() => setDocFile(null)}>Remove PDF</button> : null}
          </div>
        </form>

        <form className="card field" onSubmit={saveProgram}>
          <h3>Program Publish Controls</h3>
          <div className="field">
            <label>Program Title</label>
            <input className="input" placeholder="Acme Vulnerability Disclosure Program" value={programForm.title} onChange={(e) => setProgramForm((prev) => ({ ...prev, title: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Program Description</label>
            <textarea className="input" rows={4} placeholder="Describe the purpose of your disclosure program and what researchers can expect." value={programForm.description} onChange={(e) => setProgramForm((prev) => ({ ...prev, description: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Security Contact Email</label>
            <input className="input" type="email" placeholder="security@acme.com" value={programForm.contact_email} onChange={(e) => setProgramForm((prev) => ({ ...prev, contact_email: e.target.value }))} required />
          </div>
          <div className="card-grid">
            <div className="field">
              <label>Visibility</label>
              <select className="select" value={programForm.visibility} onChange={(e) => setProgramForm((prev) => ({ ...prev, visibility: e.target.value }))}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select className="select" value={programForm.status} onChange={(e) => setProgramForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Inactive</option>
              </select>
            </div>
          </div>
          <div className="actions">
            <button className="btn" type="submit">Save Program</button>
          </div>
        </form>
      </div>

      <Modal
        open={Boolean(confirmAction)}
        title={confirmAction === "publish" ? "Publish VDP?" : "Unpublish VDP?"}
        subtitle={confirmAction === "publish" ? "This will make your program visible to researchers." : "This will hide the public VDP page and pause intake."}
        onClose={() => setConfirmAction("")}
        footer={
          <>
            <button type="button" className="btn secondary" onClick={() => setConfirmAction("")}>Cancel</button>
            <button type="button" className="btn" onClick={runConfirmAction}>
              {confirmAction === "publish" ? "Confirm Publish" : "Confirm Unpublish"}
            </button>
          </>
        }
      >
        <p className="muted">
          Make sure your profile, disclosure procedure, and policy PDF are current before changing the program status.
        </p>
      </Modal>
    </section>
  );
}
