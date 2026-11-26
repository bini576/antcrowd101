import { useEffect, useState, useCallback } from "react";
import {
  fetchWhoAmI, fetchAdminSummary, fetchOverview, upsertOverview,
  fetchCompliance, createCompliance, deleteCompliance,
  fetchSubprocessors, createSubprocessor, deleteSubprocessor,
  fetchFaq, createFaq, deleteFaq,
  fetchUpdates, createUpdate, deleteUpdateItem,
  fetchGrcFrameworks, fetchGrcControls, fetchGrcStatus,
  fetchSubmissions, ANTCROWD_ORG_ID,
} from "./api";

const PAGES = ["dashboard", "content", "grc", "leads"];
const PAGE_META = {
  dashboard: { icon: "📊", label: "Dashboard" },
  content: { icon: "📝", label: "Content Management" },
  grc: { icon: "◎", label: "GRC Status" },
  leads: { icon: "📬", label: "Leads" },
};

function AccessDenied({ loginUrl }) {
  return (
    <div className="auth-center">
      <div className="auth-card">
        <h1>Access Denied</h1>
        <p>This workspace requires platform admin access.</p>
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
        <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#64748b", margin: "4px 0 0 0" }}>TRUST ADMIN</p>
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
        <button
          type="button"
          className="sb-logout"
          style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={async () => {
            try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch(e) { console.error(e); }
            const url = (import.meta.env.VITE_MAIN_APP_URL || 'http://localhost:5173').replace(/\/$/, '') + '/login';
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

function ItemRow({ label, sublabel, onDelete }) {
  return (
    <div className="item-row">
      <div>
        <div className="item-label">{label}</div>
        {sublabel && <div className="item-sub">{sublabel}</div>}
      </div>
      {onDelete && <button onClick={onDelete} className="btn-del">Remove</button>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [summary, setSummary] = useState(null);
  const [overview, setOverview] = useState(null);
  const [compliance, setCompliance] = useState([]);
  const [subprocessors, setSubprocessors] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [frameworks, setFrameworks] = useState([]);
  const [controls, setControls] = useState([]);
  const [grcStatus, setGrcStatus] = useState([]);
  const [leads, setLeads] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const oid = ANTCROWD_ORG_ID;

  useEffect(() => {
    fetchWhoAmI().then(d => { setUser(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const loadDashboard = useCallback(() => {
    fetchAdminSummary().then(setSummary).catch(() => {});
  }, []);

  const loadContent = useCallback(() => {
    fetchOverview(oid).then(setOverview).catch(() => {});
    fetchCompliance(oid).then(setCompliance).catch(() => {});
    fetchSubprocessors(oid).then(setSubprocessors).catch(() => {});
    fetchFaq(oid).then(setFaqs).catch(() => {});
    fetchUpdates(oid).then(setUpdates).catch(() => {});
  }, [oid]);

  const loadGrc = useCallback(() => {
    fetchGrcFrameworks().then(setFrameworks).catch(() => {});
    fetchGrcStatus(oid).then(setGrcStatus).catch(() => {});
  }, [oid]);

  const loadLeads = useCallback(() => {
    fetchSubmissions().then(d => setLeads(d.submissions || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.authenticated || user.role !== "platform_admin") return;
    if (page === "dashboard") loadDashboard();
    if (page === "content") loadContent();
    if (page === "grc") loadGrc();
    if (page === "leads") loadLeads();
  }, [page, user, loadDashboard, loadContent, loadGrc, loadLeads]);

  if (loading) return <div className="auth-center"><div className="auth-card"><h1>Trust Admin</h1><p>Loading...</p></div></div>;
  if (!user?.authenticated || user.role !== "platform_admin") return <AccessDenied loginUrl={user?.loginUrl} />;

  const handleAdd = async (type) => {
    try {
      if (type === "compliance") { await createCompliance(oid, { ...form, published: true }); loadContent(); }
      if (type === "subprocessor") { await createSubprocessor(oid, { ...form, published: true }); loadContent(); }
      if (type === "faq") { await createFaq(oid, { ...form, published: true }); loadContent(); }
      if (type === "update") { await createUpdate(oid, { ...form, published: true, published_at: new Date().toISOString() }); loadContent(); }
      setModal(null); setForm({});
    } catch(e) { alert(e.message); }
  };

  const handleOverviewSave = async () => {
    try { await upsertOverview(oid, { ...overview, published: true }); loadContent(); } catch(e) { alert(e.message); }
  };

  const loadControlsForFw = async (fwId) => {
    const c = await fetchGrcControls(fwId);
    setControls(c);
  };

  return (
    <div className="trust-layout">
      <Sidebar user={user} page={page} setPage={setPage} />
      <div className="trust-main">
        <header className="trust-header"><h1>{PAGE_META[page]?.label || "Trust Admin"}</h1></header>
        <div className="trust-body">

          {/* DASHBOARD */}
          {page === "dashboard" && summary && <>
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-val">{summary.organizationsWithTrustPages}</div><div className="stat-lbl">Orgs with Trust Pages</div></div>
              <div className="stat-card"><div className="stat-val">{summary.publishedTrustPages}</div><div className="stat-lbl">Published Pages</div></div>
              <div className="stat-card"><div className="stat-val">{summary.pendingAccessRequests}</div><div className="stat-lbl">Pending Requests</div></div>
              <div className="stat-card"><div className="stat-val">{summary.newDemoLeads}</div><div className="stat-lbl">New Demo Leads</div></div>
            </div>
          </>}

          {/* CONTENT */}
          {page === "content" && <>
            <DCard title="Overview">
              {overview ? (
                <div className="form-grid">
                  <textarea className="t-input" rows={3} value={overview.summary || ""} onChange={e => setOverview({...overview, summary: e.target.value})} placeholder="Summary" />
                  <textarea className="t-input" rows={2} value={overview.security_commitment || ""} onChange={e => setOverview({...overview, security_commitment: e.target.value})} placeholder="Security commitment" />
                  <input className="t-input" value={overview.contact_email || ""} onChange={e => setOverview({...overview, contact_email: e.target.value})} placeholder="Contact email" />
                  <button onClick={handleOverviewSave} className="btn btn-primary">Save Overview</button>
                </div>
              ) : <p className="empty">No overview found</p>}
            </DCard>

            <DCard title="Compliance Certifications" onAdd={() => { setModal("compliance"); setForm({ framework: "", status: "compliant" }); }} addLabel="Add Certification">
              {compliance.map(c => <ItemRow key={c.id} label={c.framework} sublabel={c.status} onDelete={() => { deleteCompliance(c.id).then(loadContent); }} />)}
              {compliance.length === 0 && <p className="empty">No certifications yet</p>}
            </DCard>

            <DCard title="Subprocessors" onAdd={() => { setModal("subprocessor"); setForm({ name: "", purpose: "", location: "" }); }} addLabel="Add Subprocessor">
              {subprocessors.map(s => <ItemRow key={s.id} label={s.name} sublabel={`${s.purpose || ""} — ${s.location || ""}`} onDelete={() => { deleteSubprocessor(s.id).then(loadContent); }} />)}
            </DCard>

            <DCard title="FAQ Entries" onAdd={() => { setModal("faq"); setForm({ question: "", answer: "", order_index: 0 }); }} addLabel="Add FAQ">
              {faqs.map(f => <ItemRow key={f.id} label={f.question} sublabel={f.answer} onDelete={() => { deleteFaq(f.id).then(loadContent); }} />)}
            </DCard>

            <DCard title="Security Updates" onAdd={() => { setModal("update"); setForm({ title: "", content: "" }); }} addLabel="Add Update">
              {updates.map(u => <ItemRow key={u.id} label={u.title} sublabel={u.content} onDelete={() => { deleteUpdateItem(u.id).then(loadContent); }} />)}
            </DCard>
          </>}

          {/* GRC */}
          {page === "grc" && <>
            <div className="grid-2">
              <DCard title="Frameworks">
                {frameworks.map(f => (
                  <div key={f.id} className="grc-fw-item" onClick={() => loadControlsForFw(f.id)}>
                    <div className="grc-fw-name">{f.name}</div>
                    <div className="grc-fw-meta">{f.code} • {f.jurisdiction}</div>
                  </div>
                ))}
              </DCard>
              <DCard title="Controls">
                {controls.length === 0 ? <p className="empty">Select a framework to view controls</p> :
                  controls.map(c => (
                    <div key={c.id} className="item-row" style={{flexDirection:"column",alignItems:"flex-start"}}>
                      <div className="item-label">{c.code} — {c.title}</div>
                      <div className="item-sub">{c.description} • {c.severity}</div>
                    </div>
                  ))
                }
              </DCard>
            </div>
            <DCard title="Control Statuses for AntCrowd">
              {grcStatus.length === 0 ? <p className="empty">No evaluations yet</p> :
                <table className="t-table">
                  <thead><tr><th>Control</th><th>Status</th></tr></thead>
                  <tbody>
                    {grcStatus.map(s => (
                      <tr key={s.id}>
                        <td>{s.control_id?.slice(0, 8)}</td>
                        <td><span className={`t-badge ${s.status === "pass" ? "t-badge-pass" : s.status === "fail" ? "t-badge-fail" : "t-badge-neutral"}`}>{s.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </DCard>
          </>}

          {/* LEADS */}
          {page === "leads" && <>
            <DCard title={`${leads.length} submissions`}>
              {leads.length === 0 ? <p className="empty">No demo request submissions found</p> : (
                <table className="t-table">
                  <thead><tr><th>Email</th><th>Headcount</th><th>Country</th><th>Status</th><th>Submitted</th></tr></thead>
                  <tbody>
                    {leads.map(l => (
                      <tr key={l.id}>
                        <td style={{fontWeight:500}}>{l.email}</td>
                        <td>{l.headcount}</td>
                        <td>{l.country}</td>
                        <td><span className={`t-badge ${l.status === "New" ? "t-badge-new" : "t-badge-neutral"}`}>{l.status}</span></td>
                        <td style={{color:"var(--ant-text-secondary)"}}>{new Date(l.submittedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </DCard>
          </>}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Add {modal}</h3>
            <div className="form-grid">
              {modal === "compliance" && <>
                <input className="t-input" placeholder="Framework name" value={form.framework || ""} onChange={e => setForm({...form, framework: e.target.value})} />
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
