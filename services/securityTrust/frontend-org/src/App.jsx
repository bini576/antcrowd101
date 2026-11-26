import { useEffect, useState, useCallback } from "react";
import {
  fetchWhoAmI, fetchOverview, upsertOverview,
  fetchCompliance, createCompliance, deleteCompliance,
  fetchSubprocessors, createSubprocessor,
  fetchFaq, createFaq, fetchUpdates, createUpdate,
  fetchTrustCenterPublic,
  fetchOrgTrustRequest, submitTrustRequest,
  fetchOrgNotifications, markNotificationsRead,
  ANTCROWD_ORG_ID,
} from "./api";

const PAGES = ["dashboard", "content", "preview"];
const PAGE_META = {
  dashboard: { icon: "📊", label: "Dashboard" },
  content:   { icon: "📝", label: "Trust Content" },
  preview:   { icon: "👁",  label: "Preview" },
};

const EMPTY_FORM = {
  overview: { summary: "", security_commitment: "", contact_email: "" },
  compliance: [], subprocessors: [], faq: [], updates: [],
};

function AccessDenied({ loginUrl }) {
  return (
    <div className="auth-center">
      <div className="auth-card">
        <h1>Access Denied</h1>
        <p>This workspace requires organization admin access.</p>
        <a href={loginUrl || "/login"} className="btn btn-primary">Go to Platform Login</a>
      </div>
    </div>
  );
}

function Sidebar({ user, page, setPage }) {
  return (
    <aside className="trust-sidebar">
      <div className="sb-brand" style={{ padding: "20px", borderBottom: "1px solid var(--ant-border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#f59e0b", fontWeight: "800", fontSize: "1.25rem", letterSpacing: "-0.025em" }}>AntCrowd</span>
        </div>
        <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#64748b", margin: "4px 0 0 0" }}>TRUST</p>
      </div>
      <div className="sb-user">
        <div className="sb-user-name">{user.displayName || user.email}</div>
        <div className="sb-user-role">{user.role?.replace("_", " ")}</div>
      </div>
      <nav className="sb-nav">
        {PAGES.map(p => (
          <button key={p} type="button" className={`sb-nav-item${page === p ? " active" : ""}`} onClick={() => setPage(p)}>
            {PAGE_META[p].icon} {PAGE_META[p].label}
          </button>
        ))}
      </nav>
      <div className="sb-footer">
        <button type="button" className="sb-logout"
          style={{ background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
          onClick={async () => {
            try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch(e) { console.error(e); }
            const url = (import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173").replace(/\/$/, "") + "/login";
            window.location.assign(url);
          }}
        >↪ Sign Out</button>
      </div>
    </aside>
  );
}

function DCard({ title, children, onAdd, addLabel }) {
  return (
    <div className="d-card">
      <div className="d-card-head">
        <h3 className="d-card-title">{title}</h3>
        {onAdd && <button onClick={onAdd} className="btn btn-primary btn-sm">{addLabel || "Add"}</button>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, sub, onDel }) {
  return (
    <div className="item-row">
      <div><div className="item-label">{label}</div>{sub && <div className="item-sub">{sub}</div>}</div>
      {onDel && <button onClick={onDel} className="btn-del">Remove</button>}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    approved: { background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" },
    pending:  { background: "rgba(245,158,11,0.15)",  color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" },
    declined: { background: "rgba(239,68,68,0.15)",   color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" },
    none:     { background: "rgba(100,116,139,0.15)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.3)" },
  };
  const labels = {
    approved: "✓ Live — Visible in Public Directory",
    pending:  "⏳ Under Review — Awaiting GRC approval",
    declined: "✕ Declined — You may submit a new request",
    none:     "— No trust center published yet",
  };
  const s = styles[status] || styles.none;
  return (
    <span style={{ ...s, borderRadius: "999px", padding: "0.3rem 1rem", fontSize: "0.8rem", fontWeight: 700 }}>
      {labels[status] || labels.none}
    </span>
  );
}

export default function App() {
  // Read org context from URL params (set by platform launch link)
  const urlParams = new URLSearchParams(window.location.search);
  const oid = urlParams.get("organization_id") || ANTCROWD_ORG_ID;
  const orgNameFromUrl = urlParams.get("org_name") || "";

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");

  // Trust content state
  const [overview, setOverview] = useState(null);
  const [compliance, setCompliance] = useState([]);
  const [subprocessors, setSubprocessors] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [preview, setPreview] = useState(null);

  // Trust request state
  const [trustRequest, setTrustRequest] = useState(undefined); // undefined=loading, null=none, obj=found
  const [notifications, setNotifications] = useState([]);

  // Request form state
  const [showForm, setShowForm] = useState(false);
  const [reqForm, setReqForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  // Modal for adding items to approved content
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    fetchWhoAmI()
      .then(d => { setUser(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadTrustRequest = useCallback(() => {
    fetchOrgTrustRequest(oid).then(r => setTrustRequest(r ?? null));
  }, [oid]);

  const loadContent = useCallback(() => {
    fetchOverview(oid).then(setOverview).catch(() => {});
    fetchCompliance(oid).then(setCompliance).catch(() => {});
    fetchSubprocessors(oid).then(setSubprocessors).catch(() => {});
    fetchFaq(oid).then(setFaqs).catch(() => {});
    fetchUpdates(oid).then(setUpdates).catch(() => {});
  }, [oid]);

  const loadPreview = useCallback(() => {
    // Try by org slug (derived from name on approval) then fall back to oid
    const trySlug = trustRequest?.slug || oid;
    fetchTrustCenterPublic(trySlug).then(setPreview).catch(() => setPreview(null));
  }, [oid, trustRequest]);

  useEffect(() => {
    if (!user?.authenticated) return;
    loadTrustRequest();
    fetchOrgNotifications(oid).then(n => { setNotifications(n); if (n.length) markNotificationsRead(oid); });
  }, [user, oid, loadTrustRequest]);

  useEffect(() => {
    if (!user?.authenticated || trustRequest === undefined) return;
    const approved = trustRequest?.status === "approved";
    if ((page === "dashboard" || page === "content") && approved) loadContent();
    if (page === "preview") loadPreview();
  }, [page, user, trustRequest, loadContent, loadPreview]);

  if (loading) return <div className="auth-center"><div className="auth-card"><h1>Trust Portal</h1><p>Loading...</p></div></div>;
  if (!user?.authenticated || (user.role !== "org_admin" && user.role !== "platform_admin")) return <AccessDenied loginUrl={user?.loginUrl} />;

  const status = trustRequest === undefined ? "loading" : (trustRequest?.status || "none");
  const isApproved = status === "approved";
  const isPending  = status === "pending";
  const isDeclined = status === "declined";

  const saveOverview = async () => {
    try { await upsertOverview(oid, { ...overview, published: true }); } catch(e) { alert(e.message); }
  };

  const handleAdd = async (type) => {
    try {
      if (type === "compliance")  { await createCompliance(oid, { ...form, published: true }); }
      if (type === "subprocessor"){ await createSubprocessor(oid, { ...form, published: true }); }
      if (type === "faq")         { await createFaq(oid, { ...form, published: true }); }
      if (type === "update")      { await createUpdate(oid, { ...form, published: true, published_at: new Date().toISOString() }); }
      setModal(null); setForm({}); loadContent();
    } catch(e) { alert(e.message); }
  };

  // Request form helpers
  const setOv = (k, v) => setReqForm(f => ({ ...f, overview: { ...f.overview, [k]: v } }));
  const addItem = (key, blank) => setReqForm(f => ({ ...f, [key]: [...f[key], blank] }));
  const setItem = (key, i, k, v) => setReqForm(f => { const a = [...f[key]]; a[i] = { ...a[i], [k]: v }; return { ...f, [key]: a }; });
  const delItem = (key, i) => setReqForm(f => ({ ...f, [key]: f[key].filter((_, j) => j !== i) }));

  const handleSubmit = async () => {
    setSubmitting(true); setSubmitMsg("");
    try {
      await submitTrustRequest({
        org_id: oid,
        org_name: orgNameFromUrl || user?.displayName || user?.email || "My Organization",
        org_email: user?.email,
        content: reqForm,
      });
      setSubmitMsg("Request submitted! The GRC team will review it shortly.");
      setShowForm(false);
      loadTrustRequest();
    } catch(e) { setSubmitMsg(e?.response?.data?.detail || "Failed to submit. Please try again."); }
    setSubmitting(false);
  };

  return (
    <div className="trust-layout">
      <Sidebar user={user} page={page} setPage={setPage} />
      <div className="trust-main">
        <header className="trust-header">
          <h1>{PAGE_META[page]?.label}</h1>
          {notifications.filter(n => !n.is_read).length > 0 && (
            <span style={{ marginLeft: "1rem", background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "999px", padding: "0.2rem 0.8rem", fontSize: "0.75rem", fontWeight: 700 }}>
              {notifications.filter(n => !n.is_read).length} new notification{notifications.filter(n => !n.is_read).length > 1 ? "s" : ""}
            </span>
          )}
        </header>
        <div className="trust-body">

          {/* ── DASHBOARD ── */}
          {page === "dashboard" && <>
            {/* Status banner */}
            <DCard title="Trust Center Status">
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", padding: "0.25rem 0" }}>
                <StatusBadge status={status === "loading" ? "none" : status} />
                {isApproved && (
                  <a href={`/trust/${trustRequest?.slug || oid}`} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>
                    View public page ↗
                  </a>
                )}
                {(status === "none" || isDeclined) && (
                  <button className="btn btn-primary btn-sm" onClick={() => setPage("content")}>
                    {isDeclined ? "Resubmit Request" : "Create Trust Center"}
                  </button>
                )}
              </div>
            </DCard>

            {/* Notifications */}
            {notifications.length > 0 && (
              <DCard title="Notifications" style={{ marginTop: "1.5rem" }}>
                {notifications.slice(0, 5).map(n => (
                  <div key={n.id} className="item-row" style={{ borderLeft: `3px solid ${n.kind === "success" ? "#34d399" : n.kind === "warning" ? "#fbbf24" : "#60a5fa"}`, paddingLeft: "1rem" }}>
                    <div>
                      <div className="item-label">{n.title}</div>
                      <div className="item-sub">{n.message}</div>
                    </div>
                  </div>
                ))}
              </DCard>
            )}

            {/* Stats — only if approved */}
            {isApproved ? (
              <div className="stat-grid" style={{ marginTop: "1.5rem" }}>
                <div className="stat-card"><div className="stat-val">{compliance.length}</div><div className="stat-lbl">Compliance Certs</div></div>
                <div className="stat-card"><div className="stat-val">{subprocessors.length}</div><div className="stat-lbl">Subprocessors</div></div>
                <div className="stat-card"><div className="stat-val">{faqs.length}</div><div className="stat-lbl">FAQ Entries</div></div>
                <div className="stat-card"><div className="stat-val">{updates.length}</div><div className="stat-lbl">Security Updates</div></div>
              </div>
            ) : (
              <div className="d-card" style={{ marginTop: "1.5rem" }}>
                <p className="empty">You have no published trust yet. Submit a trust request to list your security posture publicly.</p>
              </div>
            )}
          </>}

          {/* ── TRUST CONTENT ── */}
          {page === "content" && <>
            {isApproved ? (
              <>
                <DCard title="Overview">
                  {overview ? (
                    <div className="form-grid">
                      <textarea className="t-input" rows={3} value={overview.summary || ""} onChange={e => setOverview({...overview, summary: e.target.value})} placeholder="Summary" />
                      <textarea className="t-input" rows={2} value={overview.security_commitment || ""} onChange={e => setOverview({...overview, security_commitment: e.target.value})} placeholder="Security commitment" />
                      <input className="t-input" value={overview.contact_email || ""} onChange={e => setOverview({...overview, contact_email: e.target.value})} placeholder="Contact email" />
                      <button onClick={saveOverview} className="btn btn-primary">Save</button>
                    </div>
                  ) : <p className="empty">No overview yet.</p>}
                </DCard>
                <DCard title="Compliance" onAdd={() => { setModal("compliance"); setForm({ framework: "", status: "compliant" }); }} addLabel="Add">
                  {compliance.map(c => <Row key={c.id} label={c.framework} sub={c.status} onDel={() => deleteCompliance(c.id).then(loadContent)} />)}
                  {!compliance.length && <p className="empty">No compliance certs yet.</p>}
                </DCard>
                <DCard title="Subprocessors" onAdd={() => { setModal("subprocessor"); setForm({ name: "", purpose: "", location: "" }); }} addLabel="Add">
                  {subprocessors.map(s => <Row key={s.id} label={s.name} sub={s.location} />)}
                  {!subprocessors.length && <p className="empty">No subprocessors yet.</p>}
                </DCard>
                <DCard title="FAQ" onAdd={() => { setModal("faq"); setForm({ question: "", answer: "", order_index: 0 }); }} addLabel="Add">
                  {faqs.map(f => <Row key={f.id} label={f.question} sub={f.answer} />)}
                  {!faqs.length && <p className="empty">No FAQ entries yet.</p>}
                </DCard>
                <DCard title="Security Updates" onAdd={() => { setModal("update"); setForm({ title: "", content: "" }); }} addLabel="Add">
                  {updates.map(u => <Row key={u.id} label={u.title} sub={u.content} />)}
                  {!updates.length && <p className="empty">No security updates yet.</p>}
                </DCard>
              </>
            ) : isPending ? (
              <DCard title="Trust Request Pending">
                <p style={{ color: "#fbbf24", fontWeight: 600 }}>⏳ Your trust center request is currently under review by the GRC team.</p>
                <p className="empty" style={{ marginTop: "0.5rem" }}>You will be able to edit your trust content once it is approved.</p>
              </DCard>
            ) : (
              /* No trust OR declined — show create request form */
              <DCard title={isDeclined ? "Resubmit Trust Request" : "Create Trust Request"}>
                {isDeclined && (
                  <p style={{ color: "#f87171", marginBottom: "1rem" }}>
                    ✕ Your previous request was declined. Fill in the form below to resubmit.
                  </p>
                )}
                {!showForm ? (
                  <div style={{ padding: "0.5rem 0" }}>
                    <p className="empty" style={{ marginBottom: "1rem" }}>
                      You don't have a published trust center yet. Submit a request to the GRC team with your security posture information for review.
                    </p>
                    <button className="btn btn-primary" onClick={() => { setReqForm(EMPTY_FORM); setShowForm(true); setSubmitMsg(""); }}>
                      + Create Trust Request
                    </button>
                  </div>
                ) : (
                  <div className="form-grid" style={{ marginTop: "0.5rem" }}>
                    {/* Overview */}
                    <h4 style={{ color: "#e2e8f0", marginBottom: "0.25rem" }}>Overview</h4>
                    <textarea className="t-input" rows={3} placeholder="Summary — describe your organization's security posture" value={reqForm.overview.summary} onChange={e => setOv("summary", e.target.value)} />
                    <textarea className="t-input" rows={2} placeholder="Security commitment statement" value={reqForm.overview.security_commitment} onChange={e => setOv("security_commitment", e.target.value)} />
                    <input className="t-input" placeholder="Security contact email" value={reqForm.overview.contact_email} onChange={e => setOv("contact_email", e.target.value)} />

                    {/* Compliance */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                      <h4 style={{ color: "#e2e8f0" }}>Compliance Certifications</h4>
                      <button className="btn btn-ghost btn-sm" onClick={() => addItem("compliance", { framework: "", status: "compliant" })}>+ Add</button>
                    </div>
                    {reqForm.compliance.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.5rem" }}>
                        <input className="t-input" placeholder="Framework (e.g. ISO 27001)" value={c.framework} onChange={e => setItem("compliance", i, "framework", e.target.value)} style={{ flex: 1 }} />
                        <input className="t-input" placeholder="Status" value={c.status} onChange={e => setItem("compliance", i, "status", e.target.value)} style={{ flex: 1 }} />
                        <button className="btn-del" onClick={() => delItem("compliance", i)}>✕</button>
                      </div>
                    ))}

                    {/* Subprocessors */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                      <h4 style={{ color: "#e2e8f0" }}>Subprocessors</h4>
                      <button className="btn btn-ghost btn-sm" onClick={() => addItem("subprocessors", { name: "", purpose: "", location: "" })}>+ Add</button>
                    </div>
                    {reqForm.subprocessors.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.5rem" }}>
                        <input className="t-input" placeholder="Name" value={s.name} onChange={e => setItem("subprocessors", i, "name", e.target.value)} style={{ flex: 1 }} />
                        <input className="t-input" placeholder="Purpose" value={s.purpose} onChange={e => setItem("subprocessors", i, "purpose", e.target.value)} style={{ flex: 1 }} />
                        <input className="t-input" placeholder="Location" value={s.location} onChange={e => setItem("subprocessors", i, "location", e.target.value)} style={{ flex: 1 }} />
                        <button className="btn-del" onClick={() => delItem("subprocessors", i)}>✕</button>
                      </div>
                    ))}

                    {/* FAQ */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                      <h4 style={{ color: "#e2e8f0" }}>FAQ</h4>
                      <button className="btn btn-ghost btn-sm" onClick={() => addItem("faq", { question: "", answer: "" })}>+ Add</button>
                    </div>
                    {reqForm.faq.map((f, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input className="t-input" placeholder="Question" value={f.question} onChange={e => setItem("faq", i, "question", e.target.value)} style={{ flex: 1 }} />
                          <button className="btn-del" onClick={() => delItem("faq", i)}>✕</button>
                        </div>
                        <textarea className="t-input" rows={2} placeholder="Answer" value={f.answer} onChange={e => setItem("faq", i, "answer", e.target.value)} />
                      </div>
                    ))}

                    {/* Security Updates */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                      <h4 style={{ color: "#e2e8f0" }}>Security Updates</h4>
                      <button className="btn btn-ghost btn-sm" onClick={() => addItem("updates", { title: "", content: "" })}>+ Add</button>
                    </div>
                    {reqForm.updates.map((u, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input className="t-input" placeholder="Title" value={u.title} onChange={e => setItem("updates", i, "title", e.target.value)} style={{ flex: 1 }} />
                          <button className="btn-del" onClick={() => delItem("updates", i)}>✕</button>
                        </div>
                        <textarea className="t-input" rows={2} placeholder="Content" value={u.content} onChange={e => setItem("updates", i, "content", e.target.value)} />
                      </div>
                    ))}

                    {/* Submit */}
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                      <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                        {submitting ? "Submitting…" : "Submit Request"}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                    {submitMsg && <p style={{ color: submitMsg.includes("Failed") ? "#f87171" : "#34d399", marginTop: "0.5rem" }}>{submitMsg}</p>}
                  </div>
                )}
              </DCard>
            )}
          </>}

          {/* ── PREVIEW ── */}
          {page === "preview" && <>
            {isApproved && preview ? (
              <>
                <DCard title={`${preview.organization?.name || "Trust Center"}`}>
                  <p className="item-sub">{preview.overview?.summary || "No overview published."}</p>
                  {preview.overview?.contact_email && <p className="item-sub">Contact: {preview.overview.contact_email}</p>}
                </DCard>
                {(preview.compliance || []).length > 0 && (
                  <DCard title="Compliance">
                    {(preview.compliance || []).map((c, i) => <Row key={i} label={c.framework} sub={c.status} />)}
                  </DCard>
                )}
                {(preview.subprocessors || []).length > 0 && (
                  <DCard title="Subprocessors">
                    {(preview.subprocessors || []).map((s, i) => <Row key={i} label={s.name} sub={s.location} />)}
                  </DCard>
                )}
                {(preview.faq || []).length > 0 && (
                  <DCard title="FAQ">
                    {(preview.faq || []).map((f, i) => <Row key={i} label={f.question} sub={f.answer} />)}
                  </DCard>
                )}
              </>
            ) : (
              <DCard title="Preview">
                <p className="empty">No trust center published yet. Submit and get a trust request approved first.</p>
              </DCard>
            )}
          </>}
        </div>
      </div>

      {/* Add-item modal (for approved content) */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Add {modal}</h3>
            <div className="form-grid">
              {modal === "compliance" && <>
                <input className="t-input" placeholder="Framework" value={form.framework || ""} onChange={e => setForm({...form, framework: e.target.value})} />
                <input className="t-input" placeholder="Status" value={form.status || ""} onChange={e => setForm({...form, status: e.target.value})} />
              </>}
              {modal === "subprocessor" && <>
                <input className="t-input" placeholder="Name" value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} />
                <input className="t-input" placeholder="Purpose" value={form.purpose || ""} onChange={e => setForm({...form, purpose: e.target.value})} />
                <input className="t-input" placeholder="Location" value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})} />
              </>}
              {modal === "faq" && <>
                <input className="t-input" placeholder="Question" value={form.question || ""} onChange={e => setForm({...form, question: e.target.value})} />
                <textarea className="t-input" rows={3} placeholder="Answer" value={form.answer || ""} onChange={e => setForm({...form, answer: e.target.value})} />
              </>}
              {modal === "update" && <>
                <input className="t-input" placeholder="Title" value={form.title || ""} onChange={e => setForm({...form, title: e.target.value})} />
                <textarea className="t-input" rows={3} placeholder="Content" value={form.content || ""} onChange={e => setForm({...form, content: e.target.value})} />
              </>}
            </div>
            <div className="modal-actions">
              <button onClick={() => setModal(null)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => handleAdd(modal)} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
