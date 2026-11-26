import { Component, useEffect, useState } from "react";
import { fetchWhoAmI, fetchRequests, fetchDashboard, fetchFindings, createRequest, decideRequest, assignRequest, submitFinding, markNotificationRead, completeRequest, fetchReviewers } from "./api";
import "./code-service.css";

const LOGOUT_URL = "/api/auth/logout";
const REFRESH_MS = 5000;

function StatusBadge({status}){return <span className={`badge badge-${status}`}>{status?.replace(/_/g," ")}</span>}
function SeverityBadge({severity}){return <span className={`badge sev-${severity}`}>{severity}</span>}

function BellIcon(){return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>}

function NotifBell({notifications,onRead}){
  const [open,setOpen]=useState(false);
  const unread=notifications.filter(n=>!n.read).length;
  return <div className="notif-wrapper">
    <button type="button" onClick={()=>setOpen(!open)} className="notif-btn">
      <BellIcon/>
      {unread>0&&<span className="notif-count">{unread}</span>}
    </button>
    {open&&<div className="notif-dropdown">
      <div className="notif-header"><strong>Notifications</strong><button type="button" onClick={()=>setOpen(false)} className="notif-close">✕</button></div>
      {notifications.length===0?<p className="notif-empty">No notifications yet.</p>:notifications.map(n=><div key={n.id} className={`notif-item${n.read?"":" unread"}`} onClick={()=>{if(!n.read)onRead(n.id)}}><div className="notif-item-title">{n.title}</div><p className="notif-item-msg">{n.message}</p></div>)}
    </div>}
  </div>;
}

function Sidebar({user,activeSection,onNav,sections}){
  const activeLinkStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "none",
    border: "none",
    background: "rgba(245, 158, 11, 0.1)",
    color: "#f59e0b",
    borderLeft: "3px solid #f59e0b",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
    cursor: "pointer",
    margin: "2px 0"
  };

  const inactiveLinkStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "none",
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
    cursor: "pointer",
    margin: "2px 0",
    transition: "all 0.2s"
  };

  return <aside className="sidebar" style={{ position: "sticky", top: 0, height: "100vh", background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", overflowY: "auto", width: "240px", boxSizing: "border-box", padding: 0 }}>
    <div style={{ padding: "20px", borderBottom: "1px solid #334155" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
        <span style={{ color: "#f59e0b", fontWeight: "800", fontSize: "1.25rem", letterSpacing: "-0.025em" }}>AntCrowd</span>
      </div>
      <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#64748b", margin: "4px 0 0 0" }}>CODE</p>
    </div>
    <nav style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
      {sections.map(s=>(
        <button
          key={s.id}
          type="button"
          style={activeSection===s.id ? activeLinkStyle : inactiveLinkStyle}
          onClick={()=>onNav(s.id)}
        >
          <span style={{ fontSize: "16px" }}>{s.icon}</span> {s.label}
        </button>
      ))}
    </nav>
    <div style={{ padding: "16px 20px", borderTop: "1px solid #334155", fontSize: "12px", color: "#64748b" }}>
      <button
        type="button"
        onClick={async () => {
          try { await fetch(LOGOUT_URL, { method: "POST", credentials: "include" }); } catch(e) { console.error(e); }
          const base = (import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173").replace(/\/$/, "");
          window.location.assign(base + "/login");
        }}
        style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", padding: 0 }}
      >
        ↪ Sign Out
      </button>
    </div>
  </aside>;
}

function PageHeader({title,notifications,onRead,actions}){
  return <header className="main-header" style={{ height: "60px", borderBottom: "1px solid #334155", backgroundColor: "#1e293b", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", margin: 0 }}>Code Security Review &mdash; {title}</h2>
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      {actions}
      <NotifBell notifications={notifications} onRead={onRead}/>
    </div>
  </header>;
}

function FindingsList({findings}){
  if(findings.length===0) return <p className="card-meta">No findings submitted yet.</p>;
  return findings.map(f=><div key={f.id} className="finding-item">
    <div className="finding-header"><span className="finding-title">{f.title}</span><SeverityBadge severity={f.severity}/></div>
    <p className="finding-desc">{f.description}</p>
    {f.file_path&&<p className="finding-path">{f.file_path}{f.line_number?`:${f.line_number}`:""}</p>}
  </div>);
}

function UnauthView({loginUrl}){
  return <div className="page-shell auth-center">
    <div className="auth-card">
      <h1>Code Security Service</h1>
      <p>Please sign in to the AntCrowd platform to access the code review workspace.</p>
      <a href={loginUrl||"/login"} className="btn btn-primary">Sign In</a>
    </div>
  </div>;
}

function OrgAdminView({user}){
  const [requests,setRequests]=useState([]);
  const [notifications,setNotifications]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [draft,setDraft]=useState({repository_name:"",repository_url:"",review_type:"Security Audit",primary_language:"",description:"",start_date:"",end_date:""});
  const [selectedReq,setSelectedReq]=useState(null);
  const [findings,setFindings]=useState([]);
  const [toast,setToast]=useState("");
  const [activeSection,setActiveSection]=useState("requests");

  async function load(){try{setRequests(await fetchRequests())}catch{}try{const d=await fetchDashboard();setNotifications(d.notifications||[])}catch{}}
  useEffect(()=>{load();const t=setInterval(load,REFRESH_MS);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(""),3000);return()=>clearTimeout(t)}},[toast]);

  async function submit(e){
    e.preventDefault();
    if(!draft.repository_url.trim()){setToast("Repository URL is required");return;}
    if(draft.start_date&&draft.end_date&&draft.end_date<draft.start_date){setToast("End date must be after start date");return;}
    try{
      await createRequest(draft);
      setToast("Request submitted!");
      setShowForm(false);
      setDraft({repository_name:"",repository_url:"",review_type:"Security Audit",primary_language:"",description:"",start_date:"",end_date:""});
      load();
    }catch(err){setToast(err.message)}
  }

  async function viewFindings(r){setSelectedReq(r);setActiveSection("findings");try{setFindings(await fetchFindings(r.id))}catch{setFindings([])}}

  const sections=[{id:"requests",icon:"📋",label:"My Requests"}];

  return <div className="app-layout">
    <Sidebar user={user} activeSection={activeSection} onNav={s=>{setActiveSection(s);setSelectedReq(null)}} sections={sections}/>
    <div className="main-content page-shell">
      <PageHeader
        title="Organization Dashboard"
        notifications={notifications}
        onRead={async id=>{await markNotificationRead(id);load()}}
        actions={<button type="button" onClick={()=>{setShowForm(!showForm);if(showForm)setActiveSection("requests")}} className="btn btn-primary btn-sm">{showForm?"Cancel":"New Request"}</button>}
      />
      <div className="main-body">
        {toast&&<div className="toast">{toast}</div>}
        {showForm&&<form onSubmit={submit} className="form-card">
          <h3>Submit Code Review Request</h3>
          <div className="form-grid">
            <input className="input-base" placeholder="Repository name *" value={draft.repository_name} onChange={e=>setDraft({...draft,repository_name:e.target.value})} required/>
            <input className="input-base" placeholder="Repository URL" value={draft.repository_url} onChange={e=>setDraft({...draft,repository_url:e.target.value})} required/>
            <select className="input-base" value={draft.review_type} onChange={e=>setDraft({...draft,review_type:e.target.value})}>
              <option>Security Audit</option><option>Architecture Review</option><option>Dependency Audit</option><option>Compliance Check</option>
            </select>
            <input className="input-base" placeholder="Primary language *" value={draft.primary_language} onChange={e=>setDraft({...draft,primary_language:e.target.value})} required/>
            <div className="form-row-2">
              <input className="input-base" type="date" value={draft.start_date} onChange={e=>setDraft({...draft,start_date:e.target.value})} required/>
              <input className="input-base" type="date" value={draft.end_date} onChange={e=>setDraft({...draft,end_date:e.target.value})} required/>
            </div>
            <textarea className="input-base" placeholder="Description *" rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} required/>
            <button type="submit" className="btn btn-primary form-submit">Submit Request</button>
          </div>
        </form>}
        {selectedReq?<div className="dark-card">
          <div className="card-header"><h3 className="card-title">Findings for: {selectedReq.repository_name}</h3><button type="button" onClick={()=>{setSelectedReq(null);setActiveSection("requests")}} className="btn btn-ghost btn-sm">Back</button></div>
          <FindingsList findings={findings}/>
        </div>:<>
          <h3 className="section-title">Your Requests ({requests.length})</h3>
          {requests.length===0?<div className="empty-state"><p>No code review requests yet.</p><p>Click "New Request" to submit your first code review request.</p></div>:
          requests.map(r=><div key={r.id} className="dark-card">
            <div className="card-header"><div><span className="card-title">{r.repository_name}</span> <StatusBadge status={r.status}/></div></div>
            <p className="card-meta">{r.review_type} • {r.primary_language}</p>
            {r.start_date&&<p className="card-meta">Period: {r.start_date} – {r.end_date||"TBD"}</p>}
            {r.status==="completed"&&<div className="card-actions"><button type="button" onClick={()=>viewFindings(r)} className="btn btn-ghost btn-sm">View Findings</button></div>}
          </div>)}
        </>}
      </div>
    </div>
  </div>;
}

function AdminView({user}){
  const [requests,setRequests]=useState([]);const [notifications,setNotifications]=useState([]);
  const [assignEmail,setAssignEmail]=useState({});const [toast,setToast]=useState("");
  const [selectedReq,setSelectedReq]=useState(null);const [findings,setFindings]=useState([]);
  const [reviewers,setReviewers]=useState([]);
  const [activeSection,setActiveSection]=useState("dashboard");

  async function load(){try{setRequests(await fetchRequests())}catch{}try{const d=await fetchDashboard();setNotifications(d.notifications||[])}catch{}try{setReviewers(await fetchReviewers())}catch{}}
  useEffect(()=>{load();const t=setInterval(load,REFRESH_MS);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(""),3000);return()=>clearTimeout(t)}},[toast]);
  const counts={pending:0,approved:0,in_review:0,completed:0,rejected:0};requests.forEach(r=>{if(counts[r.status]!==undefined)counts[r.status]++});
  async function decide(id,action){try{await decideRequest(id,action);setToast(`Request ${action}d`);load()}catch(err){setToast(err.message)}}
  async function assign(id){const email=assignEmail[id];if(!email){setToast("Select a researcher");return}try{await assignRequest(id,email);setToast("Researcher assigned");setAssignEmail({...assignEmail,[id]:""});load()}catch(err){setToast(err.message)}}
  async function complete(id){try{await completeRequest(id);setToast("Request marked as completed");load()}catch(err){setToast(err.message)}}
  async function viewFindings(r){setSelectedReq(r);setActiveSection("findings");try{setFindings(await fetchFindings(r.id))}catch{setFindings([])}}
  const sections=[{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"requests",icon:"📋",label:"All Requests"},{id:"findings",icon:"🔍",label:"Findings"}];

  return <div className="app-layout">
    <Sidebar user={user} activeSection={activeSection} onNav={s=>{setActiveSection(s);if(s!=="findings")setSelectedReq(null)}} sections={sections}/>
    <div className="main-content page-shell">
      <PageHeader title="Platform Admin" notifications={notifications} onRead={async id=>{await markNotificationRead(id);load()}} actions={<button type="button" onClick={()=>load()} className="btn btn-ghost btn-sm">↻ Refresh</button>}/>
      <div className="main-body">
        {toast&&<div className="toast">{toast}</div>}
        {selectedReq?<div className="dark-card">
          <div className="card-header"><h3 className="card-title">Findings for: {selectedReq.repository_name}</h3><button type="button" onClick={()=>{setSelectedReq(null);setActiveSection("requests")}} className="btn btn-ghost btn-sm">Back</button></div>
          <FindingsList findings={findings}/>
        </div>:<>
          {activeSection==="dashboard"&&<>
            <div className="stat-grid">{Object.entries(counts).map(([k,v])=><div key={k} className="stat-card"><div className="stat-value">{v}</div><div className="stat-label">{k.replace("_"," ")}</div></div>)}</div>
            <h3 className="section-title">Recent Requests</h3>
          </>}
          {(activeSection==="dashboard"||activeSection==="requests")&&<>
            {activeSection==="requests"&&<h3 className="section-title">All Requests ({requests.length})</h3>}
            {requests.length===0?<div className="empty-state"><p>No code review requests have been submitted yet.</p><p>Requests will appear here once organizations submit them.</p></div>:
            requests.map(r=><div key={r.id} className="dark-card">
              <div className="card-header">
                <div><span className="card-title">{r.repository_name}</span> <StatusBadge status={r.status}/> <span className="card-id">#{r.id}</span></div>
                <span className="card-org">{r.organization_email}</span>
              </div>
              {r.repository_url&&<p className="card-url"><span className="card-meta">URL: </span><a href={r.repository_url} target="_blank" rel="noopener noreferrer">{r.repository_url}</a></p>}
              <p className="card-meta">{r.review_type} • {r.primary_language}</p>
              {r.start_date&&<p className="card-meta">Period: {r.start_date} – {r.end_date||"TBD"}</p>}
              <p className="card-desc">{r.description}</p>
              {r.assigned_to&&<p className="card-assigned">Assigned to: {r.assigned_to}</p>}
              <div className="card-actions">
                {r.status==="pending"&&<><button type="button" onClick={()=>decide(r.id,"approve")} className="btn btn-success btn-sm">Approve</button><button type="button" onClick={()=>decide(r.id,"reject")} className="btn btn-danger btn-sm">Reject</button></>}
                {(r.status==="approved"||r.status==="in_review")&&<>
                  <input
                    className="input-base reviewer-select"
                    list={reviewers.length>0?`rl-${r.id}`:undefined}
                    placeholder={reviewers.length>0?"Pick or type a researcher email…":"Researcher email"}
                    value={assignEmail[r.id]||""}
                    onChange={e=>setAssignEmail({...assignEmail,[r.id]:e.target.value})}
                  />
                  {reviewers.length>0&&<datalist id={`rl-${r.id}`}>{reviewers.map(rv=><option key={rv.email} value={rv.email}>{rv.displayName||rv.email}</option>)}</datalist>}
                  <button type="button" onClick={()=>assign(r.id)} className="btn btn-blue btn-sm">Assign</button>
                </>}
                {r.status==="in_review"&&<button type="button" onClick={()=>complete(r.id)} className="btn btn-purple btn-sm">Mark Completed</button>}
                {["in_review","completed"].includes(r.status)&&<button type="button" onClick={()=>viewFindings(r)} className="btn btn-ghost btn-sm">View Findings</button>}
              </div>
            </div>)}
          </>}
        </>}
      </div>
    </div>
  </div>;
}

function ReviewerView({user}){
  const [requests,setRequests]=useState([]);const [notifications,setNotifications]=useState([]);
  const [selectedReq,setSelectedReq]=useState(null);const [findings,setFindings]=useState([]);const [showFF,setShowFF]=useState(false);
  const [draft,setDraft]=useState({title:"",description:"",file_path:"",line_number:0,severity:"medium",category:"Other"});const [toast,setToast]=useState("");
  const [activeSection,setActiveSection]=useState("assignments");

  async function load(){try{setRequests(await fetchRequests())}catch{}try{const d=await fetchDashboard();setNotifications(d.notifications||[])}catch{}}
  useEffect(()=>{load();const t=setInterval(load,REFRESH_MS);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(""),3000);return()=>clearTimeout(t)}},[toast]);
  async function selectReq(r){setSelectedReq(r);setShowFF(false);setActiveSection("review");try{setFindings(await fetchFindings(r.id))}catch{setFindings([])}}
  async function submitF(e){e.preventDefault();try{await submitFinding(selectedReq.id,draft);setToast("Finding submitted!");setShowFF(false);setDraft({title:"",description:"",file_path:"",line_number:0,severity:"medium",category:"Other"});setFindings(await fetchFindings(selectedReq.id))}catch(err){setToast(err.message)}}
  const sections=[{id:"assignments",icon:"📋",label:"Assigned Requests"},{id:"review",icon:"🔍",label:"Active Review"}];

  return <div className="app-layout">
    <Sidebar user={user} activeSection={activeSection} onNav={s=>{setActiveSection(s);if(s==="assignments")setSelectedReq(null)}} sections={sections}/>
    <div className="main-content page-shell">
      <PageHeader title="Researcher Dashboard" notifications={notifications} onRead={async id=>{await markNotificationRead(id);load()}} actions={<button type="button" onClick={()=>load()} className="btn btn-ghost btn-sm">↻ Refresh</button>}/>
      <div className="main-body">
        {toast&&<div className="toast">{toast}</div>}
        {selectedReq?<div className="dark-card">
          <div className="card-header">
            <h3 className="card-title">{selectedReq.repository_name} <StatusBadge status={selectedReq.status}/></h3>
            <div className="card-actions"><button type="button" onClick={()=>setShowFF(!showFF)} className="btn btn-primary btn-sm">{showFF?"Cancel":"Add Finding"}</button><button type="button" onClick={()=>{setSelectedReq(null);setActiveSection("assignments")}} className="btn btn-ghost btn-sm">Back</button></div>
          </div>
          {selectedReq.repository_url&&<p className="card-url"><span className="card-meta">URL: </span><a href={selectedReq.repository_url} target="_blank" rel="noopener noreferrer">{selectedReq.repository_url}</a></p>}
          <p className="card-meta">{selectedReq.review_type} • {selectedReq.primary_language}</p>
          {selectedReq.start_date&&<p className="card-meta">Period: {selectedReq.start_date} – {selectedReq.end_date||"TBD"}</p>}
          {selectedReq.organization_email&&<p className="card-meta">Submitted by: {selectedReq.organization_email}</p>}
          <p className="card-desc">{selectedReq.description}</p>
          {showFF&&<form onSubmit={submitF} className="form-card"><div className="form-grid">
            <input className="input-base" placeholder="Finding title *" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} required/>
            <textarea className="input-base" placeholder="Description *" rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} required/>
            <div className="form-row-2">
              <input className="input-base" placeholder="File path" value={draft.file_path} onChange={e=>setDraft({...draft,file_path:e.target.value})}/>
              <input className="input-base" type="number" placeholder="Line number" value={draft.line_number||""} onChange={e=>setDraft({...draft,line_number:parseInt(e.target.value)||0})}/>
            </div>
            <div className="form-row-2">
              <select className="input-base" value={draft.severity} onChange={e=>setDraft({...draft,severity:e.target.value})}><option value="info">Info</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
              <select className="input-base" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}><option>Injection</option><option>XSS</option><option>Authentication</option><option>Authorization</option><option>Cryptography</option><option>Configuration</option><option>Information Disclosure</option><option>Other</option></select>
            </div>
            <button type="submit" className="btn btn-primary form-submit">Submit Finding</button>
          </div></form>}
          <h4 className="section-title">Findings ({findings.length})</h4>
          <FindingsList findings={findings}/>
        </div>:<>
          <h3 className="section-title">Assigned Requests ({requests.length})</h3>
          {requests.length===0?<div className="empty-state"><p>No requests assigned to you yet.</p><p>You will receive a notification when a code review is assigned to you.</p></div>:
          requests.map(r=><div key={r.id} className="dark-card clickable-card" onClick={()=>selectReq(r)}>
            <div><span className="card-title">{r.repository_name}</span> <StatusBadge status={r.status}/></div>
            {r.repository_url&&<p className="card-url"><span className="card-meta">URL: </span><a href={r.repository_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>{r.repository_url}</a></p>}
            <p className="card-meta">{r.review_type} • {r.primary_language}</p>
            {r.start_date&&<p className="card-meta">Period: {r.start_date} – {r.end_date||"TBD"}</p>}
            {r.organization_email&&<p className="card-meta">Submitted by: {r.organization_email}</p>}
          </div>)}
        </>}
      </div>
    </div>
  </div>;
}

class AppErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, errorInfo) { console.error("Code service render error", error, errorInfo); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="page-shell auth-center">
      <section className="error-card">
        <h1>Something went wrong</h1>
        <p>Reload the page and retry.</p>
        <pre>{String(this.state.error)}{"\n"}{this.state.error?.stack}</pre>
        <button type="button" onClick={()=>window.location.reload()} className="btn btn-primary">Reload Page</button>
      </section>
    </main>;
  }
}

function AppShell() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const SESSION_KEY = "antcrowd_code_session";
    const TOKEN_KEY = "antcrowd_code_token";
    const params = new URLSearchParams(window.location.search);
    const bootstrapToken = params.get("token");
    const bootstrapRole = params.get("role");
    const bootstrapEmail = params.get("email");

    if (bootstrapToken && bootstrapRole && bootstrapEmail) {
      const bootstrapSession = { authenticated: true, username: bootstrapEmail, role: bootstrapRole, email: bootstrapEmail, displayName: bootstrapEmail, loginUrl: "/login", logoutUrl: LOGOUT_URL };
      try { sessionStorage.setItem(TOKEN_KEY, bootstrapToken); } catch {}
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(bootstrapSession)); } catch {}
      document.cookie = `antcrowd_session=${bootstrapToken}; path=/; SameSite=Lax`;
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("token");
      cleanUrl.searchParams.delete("role");
      cleanUrl.searchParams.delete("email");
      cleanUrl.searchParams.delete("organization_id");
      window.history.replaceState({}, "", cleanUrl.toString());
      setSession(bootstrapSession);
      setLoading(false);
      return;
    }

    try {
      const storedToken = sessionStorage.getItem(TOKEN_KEY);
      const storedSession = sessionStorage.getItem(SESSION_KEY);
      if (storedToken && storedSession) {
        const parsed = JSON.parse(storedSession);
        if (parsed && parsed.authenticated && parsed.role) {
          setSession(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {}

    fetchWhoAmI()
      .then((data) => {
        if (data.authenticated) {
          setSession(data);
          try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
        } else {
          setSession({ authenticated: false, loginUrl: data.loginUrl || "/login" });
        }
      })
      .catch(() => {
        setSession({ authenticated: false, loginUrl: "/login" });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#020617" }}>
        <div style={{ height: "4px", background: "linear-gradient(to right, #f59e0b, #ea580c, #facc15)", width: "100%", zIndex: 1000 }} />
        <div className="page-shell auth-center" style={{ flex: 1 }}>
          <div className="auth-card">
            <h1>Code Security Service</h1>
            <p>Loading your session…</p>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!session || !session.authenticated) {
      return <UnauthView loginUrl={session?.loginUrl} />;
    }
    const user = session;
    switch (user.role) {
      case "org_admin": return <OrgAdminView user={user} />;
      case "platform_admin": return <AdminView user={user} />;
      case "reviewer": return <ReviewerView user={user} />;
      default: return <UnauthView loginUrl="/login" />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#020617" }}>
      <div style={{ height: "4px", background: "linear-gradient(to right, #f59e0b, #ea580c, #facc15)", width: "100%", zIndex: 1000 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {renderContent()}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}
