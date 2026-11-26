import { Component, useEffect, useMemo, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import {
  closeProgram,
  createProgram,
  CURRENT_SERVICE,
  CURRENT_SERVICE_KEY,
  decideProgram,
  deleteProgram,
  fetchDashboard,
  fetchNotifications,
  fetchPublicSnapshot,
  fetchWhoAmI,
  joinProgram,
  markNotificationRead,
  SERVICES,
  submitFinding,
} from "./api";

const REFRESH_INTERVAL_MS = 3000;

const PROGRAM_FORM_CONFIG = {
  challenge: {
    initialDraft: {
      program_name: "",
      description: "",
      contact_email: "",
      difficulty_level: "Medium",
      challenge_categories: ["Web"],
      other_category: "",
      prize_pool_etb: "",
      start_date: "",
      end_date: "",
      flag_format: "",
      correct_flag: "",
    },
    title: "Create Challenge Request",
    subtitle: "Submit a challenge request for platform approval.",
    multiselectOptions: {
      challenge_categories: ["Web", "Crypto", "Reverse", "OSINT", "Forensics", "Mobile", "PWN", "Steganography", "Misc", "Other"],
    },
  },
  "ai-redteam": {
    initialDraft: {
      ai_system_name: "",
      description: "",
      contact_email: "",
      access_method: "Web sandbox",
      access_url: "",
      model_type_version: "",
      scope_of_testing: ["Prompt Injection"],
      testing_start_date: "",
      testing_end_date: "",
      budget_reward: "",
    },
    title: "Create AI Red Team Request",
    subtitle: "Submit an AI red team request for platform approval.",
    multiselectOptions: {
      scope_of_testing: ["Prompt Injection", "Jailbreak", "Bias", "Data Leakage", "Tool Abuse", "Hallucination", "Other"],
    },
  },
  "bug-bounty": {
    initialDraft: {
      program_name: "",
      description: "",
      contact_email: "",
      program_type: "Public",
      target_assets: ["Web App"],
      in_scope_targets: "",
      out_of_scope: "",
      reward_range: "",
      rules_of_engagement: "",
      testing_start_date: "",
      testing_end_date: "",
      budget: "",
      poc_target_url: "",
    },
    title: "Create Bug Bounty Request",
    subtitle: "Submit a bug bounty request for platform approval.",
    multiselectOptions: {
      target_assets: ["Web App", "API", "Mobile Backend", "Cloud Console", "Partner Portal"],
    },
  },
};

function buildEmptyProgramDraft() {
  return structuredClone(PROGRAM_FORM_CONFIG[CURRENT_SERVICE_KEY].initialDraft);
}

function defaultReportDraftFor(program) {
  if (program?.serviceKey === "bug-bounty") {
    return {
      title: "",
      summary: "",
      evidence: "",
      vulnerable_url: program.pocTargetUrl || "",
      finding_categories: [],
    };
  }
  if (program?.serviceKey === "challenge") {
    return { title: "", summary: "", evidence: "", impact: "Medium", flag: "" };
  }
  return {
    title: "",
    summary: "",
    evidence: "",
    impact: program?.serviceKey === "ai-redteam" ? "High" : "Medium",
  };
}

function previewSeverity(categories) {
  const selected = new Set(categories);
  if (selected.has("RCE") || selected.has("SSRF") || selected.has("Authentication Bypass")) return "Critical";
  if (selected.has("SQL Injection") || selected.has("Sensitive Data Exposure") || selected.has("IDOR")) return "High";
  if (selected.has("XSS") || selected.has("Broken Access Control")) return "Medium";
  return "Low";
}

function formatRequestReviewMessage(message) {
  const trimmed = (message || "Request submitted successfully.").trim();
  if (/you will be updated/i.test(trimmed)) {
    return trimmed;
  }
  if (/under review|waiting for platform review|waiting for platform approval/i.test(trimmed)) {
    return `${trimmed} You will be updated here once the review status changes.`;
  }
  return `${trimmed} It is currently under review, and you will be updated here once the review status changes.`;
}

function uniqueStrings(items) {
  return [...new Set((items ?? []).map((item) => item?.trim()).filter(Boolean))];
}

function normalizeHttpUrl(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function validateProgramDraft(draft) {
  if (CURRENT_SERVICE_KEY === "challenge" && !uniqueStrings(draft.challenge_categories).length) {
    return "Select at least one challenge category.";
  }
  if (CURRENT_SERVICE_KEY === "ai-redteam" && !uniqueStrings(draft.scope_of_testing).length) {
    return "Select at least one scope of testing option.";
  }
  if (CURRENT_SERVICE_KEY === "ai-redteam") {
    if (!draft.testing_start_date || !draft.testing_end_date) {
      return "Both a testing start date and end date are required.";
    }
    if (draft.testing_end_date <= draft.testing_start_date) {
      return "Testing end date must be after the start date.";
    }
  }
  if (CURRENT_SERVICE_KEY === "bug-bounty" && !uniqueStrings(draft.target_assets).length) {
    return "Select at least one target asset.";
  }
  return "";
}

function prepareProgramPayload(draft) {
  const { other_category, ...cleanDraft } = draft;
  if (CURRENT_SERVICE_KEY === "challenge") {
    return {
      ...cleanDraft,
      challenge_categories: uniqueStrings(draft.challenge_categories),
    };
  }

  if (CURRENT_SERVICE_KEY === "bug-bounty") {
    return {
      ...cleanDraft,
      target_assets: uniqueStrings(draft.target_assets),
      poc_target_url: normalizeHttpUrl(draft.poc_target_url),
    };
  }

  return {
    ...cleanDraft,
    access_url: normalizeHttpUrl(draft.access_url),
    scope_of_testing: uniqueStrings(draft.scope_of_testing),
  };
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AI red team frontend render error", error, errorInfo);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8 sm:px-6">
        <section className="w-full rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#ef4444]">Something went wrong</p>
          <h1 className="mt-2 text-2xl font-bold text-white">The page hit an unexpected error.</h1>
          <p className="mt-3 text-sm leading-6 text-[#94a3b8]">
            No request data was intentionally discarded. Reload the page and retry the action. If the issue happens again, the error is now logged in the browser console instead of failing as a blank page.
          </p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-[#f59e0b] px-5 py-3 text-sm font-bold text-[#0f172a]">
            Reload Page
          </button>
        </section>
      </main>
    );
  }
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/+$/, '')}>
      <AppErrorBoundary>
        <AppShell />
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

function AppShell() {
  const [session, setSession] = useState(null);
  const [publicData, setPublicData] = useState({});
  const [dashboards, setDashboards] = useState({});
  const [notificationsByService, setNotificationsByService] = useState({});
  const [programDraft, setProgramDraft] = useState(buildEmptyProgramDraft);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reportDrafts, setReportDrafts] = useState({});
  const [activeReportTarget, setActiveReportTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [serviceWarning, setServiceWarning] = useState("");
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);

  const seenNotifications = useRef(new Set());
  const username = session?.username ?? null;
  const role = session?.role ?? null;
  const displayName = session?.displayName ?? null;
  const loginUrl = session?.loginUrl ?? "/login";
  const logoutUrl = session?.logoutUrl ?? "/api/auth/logout";
  const aggregate = useMemo(() => buildAggregate(publicData, dashboards, notificationsByService), [publicData, dashboards, notificationsByService]);
  const currentServiceDashboard = aggregate.dashboardByService[CURRENT_SERVICE_KEY] ?? {};

  useEffect(() => {
    document.title = `${CURRENT_SERVICE.name} | AntCrowd`;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bootstrapToken = params.get("token");
    const bootstrapRole = params.get("role");
    const bootstrapEmail = params.get("email");

    if (bootstrapToken && bootstrapRole && bootstrapEmail) {
      document.cookie = `antcrowd_session=${bootstrapToken}; path=/; SameSite=Lax`;
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("token");
      cleanUrl.searchParams.delete("role");
      cleanUrl.searchParams.delete("email");
      cleanUrl.searchParams.delete("organization_id");
      window.history.replaceState({}, "", cleanUrl.toString());
      setSession({
        username: bootstrapEmail,
        role: bootstrapRole,
        displayName: bootstrapEmail,
        loginUrl: "/login",
        logoutUrl: "/api/auth/logout",
      });
      return;
    }

    fetchWhoAmI()
      .then((data) => {
        if (data.authenticated) {
          setSession({ username: data.username, role: data.role, displayName: data.displayName, loginUrl: data.loginUrl, logoutUrl: data.logoutUrl });
        } else {
          setSession({ username: null, role: "user", displayName: null, loginUrl: data.loginUrl, logoutUrl: data.logoutUrl });
        }
      })
      .catch(() => {
        setSession({ username: null, role: "user", displayName: null, loginUrl: "/login", logoutUrl: "/api/auth/logout" });
      });
  }, []);

  useEffect(() => {
    loadPublicSnapshots();
  }, []);

  useEffect(() => {
    if (!username || role === "user") {
      setDashboards({});
      setNotificationsByService({});
      setLoading(false);
      return;
    }
    refreshWorkspace();
    const interval = window.setInterval(() => refreshWorkspace(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [username, role]);

  useEffect(() => {
    if (!aggregate.notifications.length) return;
    const nextToasts = [];
    aggregate.notifications.forEach((note) => {
      const key = `${note.serviceKey}:${note.id}`;
      if (!seenNotifications.current.has(key) && !note.isRead) {
        seenNotifications.current.add(key);
        nextToasts.push({
          id: `${key}:${note.createdAt}`,
          title: note.title,
          message: note.message,
        });
      }
    });
    if (nextToasts.length) {
      setToasts((current) => [...current.slice(-2), ...nextToasts].slice(-4));
    }
  }, [aggregate.notifications]);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timeout = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [toasts]);

  async function loadPublicSnapshots() {
    setLoading(true);
    const serviceKeys = Object.keys(SERVICES);
    const settled = await Promise.allSettled(serviceKeys.map((serviceKey) => fetchPublicSnapshot(serviceKey)));
    const nextPublicData = {};
    const failedServices = [];
    settled.forEach((result, index) => {
      const serviceKey = serviceKeys[index];
      if (result.status === "fulfilled") nextPublicData[serviceKey] = result.value;
      else failedServices.push(serviceKey);
    });
    setPublicData(nextPublicData);
    setServiceWarning(failedServices.length ? `Some optional services are offline: ${failedServices.join(", ")}.` : "");
    setLoading(false);
  }

  async function refreshWorkspace() {
    setLoading(true);
    const serviceKeys = Object.keys(SERVICES);
    const [dashboardSettled, notificationSettled] = await Promise.all([
      Promise.allSettled(serviceKeys.map((serviceKey) => fetchDashboard(serviceKey))),
      Promise.allSettled(serviceKeys.map((serviceKey) => fetchNotifications(serviceKey))),
    ]);

    const nextDashboards = {};
    const nextNotifications = {};
    dashboardSettled.forEach((result, index) => {
      if (result.status === "fulfilled") nextDashboards[serviceKeys[index]] = result.value;
    });
    notificationSettled.forEach((result, index) => {
      if (result.status === "fulfilled") nextNotifications[serviceKeys[index]] = result.value;
    });
    setDashboards(nextDashboards);
    setNotificationsByService(nextNotifications);
    setLoading(false);
  }

  function handleLogin() {
    window.location.href = loginUrl;
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error(e);
    }
    const mainAppLoginUrl = (import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173").replace(/\/$/, "") + "/login";
    window.location.assign(mainAppLoginUrl);
  }

  async function handleProgramCreate(event) {
    event.preventDefault();
    if (!username) return;
    const validationError = validateProgramDraft(programDraft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setActionBusy(true);
    setError("");
    try {
      const response = await createProgram(CURRENT_SERVICE_KEY, prepareProgramPayload(programDraft));
      const reviewMessage = formatRequestReviewMessage(response.message);
      setProgramDraft(buildEmptyProgramDraft());
      setShowRequestForm(false);
      setSuccessMessage(reviewMessage);
      setToasts((current) => [...current, { id: `request-${Date.now()}`, title: "Request submitted successfully", message: reviewMessage }].slice(-4));
      await Promise.all([loadPublicSnapshots(), refreshWorkspace()]);
    } catch (requestError) {
      setError(extractError(requestError, "Unable to submit the new request."));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDecision(serviceKey, programId, action) {
    if (!username) return;
    setActionBusy(true);
    setError("");
    try {
      const response = await decideProgram(serviceKey, programId, { action, comment: `${action}d` });
      setSuccessMessage(response.message);
      await Promise.all([loadPublicSnapshots(), refreshWorkspace()]);
    } catch (requestError) {
      setError(extractError(requestError, "Unable to update the request."));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDeleteProgram(serviceKey, programId) {
    if (!username) return;
    setActionBusy(true);
    setError("");
    try {
      const response = await deleteProgram(serviceKey, programId, { action: "delete", comment: "Deleted" });
      setSuccessMessage(response.message);
      await Promise.all([loadPublicSnapshots(), refreshWorkspace()]);
    } catch (requestError) {
      setError(extractError(requestError, "Unable to delete the program."));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCloseProgram(serviceKey, programId) {
    if (!username) return;
    setActionBusy(true);
    setError("");
    try {
      const response = await closeProgram(serviceKey, programId, { action: "close", comment: "Closed" });
      setSuccessMessage(response.message);
      await Promise.all([loadPublicSnapshots(), refreshWorkspace()]);
    } catch (requestError) {
      setError(extractError(requestError, "Unable to close the program."));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleJoin(serviceKey, programId) {
    if (!username) return;
    setActionBusy(true);
    setError("");
    try {
      const response = await joinProgram(serviceKey, programId);
      setSuccessMessage(response.message);
      setToasts((current) => [...current, { id: `join-${Date.now()}`, title: "Joined successfully", message: response.message }].slice(-4));
      await Promise.all([loadPublicSnapshots(), refreshWorkspace()]);
      if (serviceKey === "challenge" && response.program?.isCtf) {
        window.location.href = `${SERVICES.challenge.frontendUrl}/antcrowd-ctf`;
      }
      if (serviceKey === "ai-redteam") {
        setActiveReportTarget(`ai-redteam:${programId}`);
        setTimeout(() => {
          document.getElementById("joined-programs-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 200);
      }
    } catch (requestError) {
      setError(extractError(requestError, "Unable to join the selected program."));
    } finally {
      setActionBusy(false);
    }
  }

  function updateReportDraft(program, patch) {
    const key = `${program.serviceKey}:${program.id}`;
    setReportDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? defaultReportDraftFor(program)), ...patch },
    }));
  }

  async function handleReportSubmit(program, event) {
    event.preventDefault();
    if (!username) return;
    const key = `${program.serviceKey}:${program.id}`;
    const draft = reportDrafts[key] ?? defaultReportDraftFor(program);
    setActionBusy(true);
    setError("");
    try {
      const payload =
        program.serviceKey === "bug-bounty"
          ? {
              title: draft.title,
              summary: draft.summary,
              vulnerable_url: draft.vulnerable_url,
              evidence: draft.evidence,
              finding_categories: draft.finding_categories,
            }
          : program.serviceKey === "challenge"
            ? {
                title: draft.title,
                summary: draft.summary,
                evidence: draft.evidence,
                impact: draft.impact,
                flag: draft.flag || "",
              }
            : {
                title: draft.title,
                summary: draft.summary,
                evidence: draft.evidence,
                impact: draft.impact,
              };
      const response = await submitFinding(program.serviceKey, program.id, payload);
      setSuccessMessage(response.message);
      setToasts((current) => [...current, { id: `report-${Date.now()}`, title: "Report submitted", message: response.message }].slice(-4));
      setReportDrafts((current) => ({ ...current, [key]: defaultReportDraftFor(program) }));
      setActiveReportTarget("");
      await Promise.all([loadPublicSnapshots(), refreshWorkspace()]);
    } catch (requestError) {
      setError(extractError(requestError, "Unable to submit the report."));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleNotificationOpen(note) {
    if (!username || note.isRead) return;
    try {
      await markNotificationRead(note.serviceKey, note.id);
      await refreshWorkspace();
    } catch {
      // keep the bell responsive even if one mark-read call fails
    }
  }

  const [sidebarPage, setSidebarPage] = useState("workspace");
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f1f5f9] font-[Inter,-apple-system,sans-serif]">
      <div className="grid min-h-screen" style={{ gridTemplateColumns: '240px 1fr' }}>
        <aside className="sticky top-0 h-screen bg-[#1e293b] border-r border-[#334155] flex flex-col overflow-y-auto">
          <div className="px-5 py-5 border-b border-[#334155]">
            <Link to="/" className="flex items-center gap-2"><span className="text-[#f59e0b] font-extrabold text-xl tracking-tight">AntCrowd</span></Link>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#64748b] mt-1">{CURRENT_SERVICE.shortName}</p>
          </div>
          <nav className="flex-1 py-3 px-3 space-y-1">
            {[{k:'workspace',l:'Workspace',icon:'\ud83d\udcca'},{k:'catalog',l:'Catalog',icon:'\ud83d\udcc2'}].map(item=>(
              <Link key={item.k} to={item.k==='workspace'?'/':'/'+item.k}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${sidebarPage===item.k?'bg-[#f59e0b]/10 text-[#f59e0b] border-l-[3px] border-[#f59e0b]':'text-[#94a3b8] hover:bg-[#334155] hover:text-white'}`}
                onClick={()=>setSidebarPage(item.k)}><span>{item.icon}</span>{item.l}</Link>
            ))}
          </nav>
          <div className="px-5 py-4 border-t border-[#334155] text-xs text-[#64748b]">&copy; 2026 AntCrowd</div>
        </aside>

        <div className="flex flex-col min-h-screen overflow-x-hidden">
          <TopNav currentUser={username} role={role} aggregate={aggregate} onLogout={handleLogout} onOpenLogin={handleLogin}
            loginUrl={loginUrl} logoutUrl={logoutUrl} onNotificationOpen={handleNotificationOpen} displayName={displayName}
            notifOpen={notifOpen} setNotifOpen={setNotifOpen} />
          <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-6 px-6 py-6">
            {successMessage ? <Banner tone="success" message={successMessage} /> : null}
            {serviceWarning ? <Banner tone="warning" message={serviceWarning} /> : null}
            {error ? <Banner tone="error" message={error} /> : null}
            <Routes>
              <Route path="/" element={
                role && role !== "user" ? (
                  <DashboardPage aggregate={aggregate} currentServiceDashboard={currentServiceDashboard} role={role} actionBusy={actionBusy}
                    showRequestForm={showRequestForm} setShowRequestForm={setShowRequestForm} programDraft={programDraft} setProgramDraft={setProgramDraft}
                    onCreateProgram={handleProgramCreate} onDecision={handleDecision} onDeleteProgram={handleDeleteProgram} onCloseProgram={handleCloseProgram}
                    onJoin={handleJoin} activeReportTarget={activeReportTarget} setActiveReportTarget={setActiveReportTarget}
                    reportDrafts={reportDrafts} updateReportDraft={updateReportDraft} onReportSubmit={handleReportSubmit} />
                ) : (
                  <LandingPage currentUser={username} onOpenLogin={handleLogin} loginUrl={loginUrl} aggregate={aggregate} loading={loading} />
                )
              } />
              <Route path="/catalog" element={<CatalogPage aggregate={aggregate} role={role} currentUser={username} onJoin={handleJoin} />} />
              <Route path="/antcrowd-ctf" element={<ExternalCtfRedirect />} />
            </Routes>
          </main>
        </div>
      </div>

      {notifOpen && (
        <div className="fixed inset-0 z-40" onClick={()=>setNotifOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-96 bg-[#1e293b] border-l border-[#334155] shadow-2xl p-5 overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Notifications</h3>
              <button type="button" onClick={()=>setNotifOpen(false)} className="text-[#64748b] hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {aggregate.notifications.length ? aggregate.notifications.map((note)=>(
                <button key={`${note.serviceKey}-${note.id}`} type="button" onClick={()=>handleNotificationOpen(note)}
                  className={`w-full text-left rounded-xl p-4 border-l-4 transition ${note.isRead?'border-[#334155] bg-[#0f172a]/50':'border-[#f59e0b] bg-[#f59e0b]/5'}`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#f59e0b]">{note.serviceName}</p>
                  <p className="mt-1 font-semibold text-white text-sm">{note.title}</p>
                  <p className="mt-1 text-xs text-[#94a3b8]">{note.message}</p>
                  <p className="mt-2 text-[10px] text-[#64748b]">Just now</p>
                </button>
              )) : <div className="text-sm text-[#64748b] text-center py-8">No notifications yet.</div>}
            </div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}

function TopNav({ currentUser, role, aggregate, onLogout, onOpenLogin, displayName: navDisplayName, notifOpen, setNotifOpen }) {
  return (
    <header className="sticky top-0 z-20 h-[60px] border-b border-[#334155] bg-[#1e293b] flex items-center justify-between px-6">
      <h2 className="text-sm font-semibold text-[#94a3b8]">{roleLabel(role)} \u2014 {CURRENT_SERVICE.name}</h2>
      <div className="flex items-center gap-4">
        {currentUser && role !== "user" ? (
          <button type="button" onClick={()=>setNotifOpen(!notifOpen)} className="relative p-2 rounded-lg text-[#94a3b8] hover:bg-[#334155] hover:text-white transition">
            <Bell size={18} />
            {aggregate.unreadCount ? <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#ef4444]"></span> : null}
          </button>
        ) : null}
        {currentUser ? (
          <>
            <span className="text-sm font-medium text-[#f1f5f9] hidden sm:block">{navDisplayName || currentUser}</span>
            <button type="button" onClick={onLogout} className="px-4 py-2 rounded-lg bg-[#334155] hover:bg-[#475569] text-sm font-semibold text-[#f1f5f9] transition">Logout</button>
          </>
        ) : (
          <button type="button" onClick={onOpenLogin} className="px-4 py-2 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-sm font-bold text-[#0f172a] transition">Sign In</button>
        )}
      </div>
    </header>
  );
}


function LandingPage({ currentUser, onOpenLogin, loginUrl, aggregate, loading }) {
  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-[#334155] bg-gradient-to-br from-[#f59e0b]/5 via-[#1e293b] to-[#0f172a] p-8">
        <div className="space-y-5">
          <span className="inline-flex rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#f59e0b]">{CURRENT_SERVICE.name}</span>
          <h1 className="text-4xl font-extrabold text-white leading-tight sm:text-5xl">AntCrowd keeps challenge, AI red team, and bug bounty work in one persistent platform.</h1>
          <p className="max-w-3xl text-base text-[#94a3b8] sm:text-lg">Requests, approvals, joins, notifications, and researcher progress now persist across restarts.</p>
          <div className="flex flex-wrap gap-3">
            {!currentUser ? <button type="button" onClick={onOpenLogin} className="rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-5 py-3 text-sm font-bold text-[#0f172a] transition">Sign In</button> : null}
            <Link to="/catalog" className="rounded-xl border border-[#334155] hover:border-[#f59e0b]/30 bg-[#1e293b] px-5 py-3 text-sm font-semibold text-[#f1f5f9] transition">Browse Public Catalog</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Open Programs" value={aggregate.publicPrograms.length} accent />
            <MetricCard label="Researchers Active" value={aggregate.globalParticipants} />
            <MetricCard label="Reports Logged" value={aggregate.globalSubmissions} />
          </div>
        </div>
      </section>
      {loading ? <LoadingCard label="Refreshing platform overview..." /> : null}
    </div>
  );
}

function CatalogPage({ aggregate, role, currentUser, onJoin }) {
  const joinedIds = new Set();
  Object.values(aggregate.dashboardByService).forEach((dashboard) => {
    (dashboard?.joinedPrograms ?? []).forEach((p) => joinedIds.add(p.id));
  });
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-[#334155] bg-[#1e293b]/60 p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b]">Public Catalog</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Open programs across all AntCrowd services</h1>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        {aggregate.publicPrograms.filter((p) => p.status !== "deleted").map((program) => {
          const alreadyJoined = joinedIds.has(program.id);
          const isClosed = program.status === "closed";
          const isExpired = program.status === "expired";
          const canJoin = role === "researcher" && currentUser && !alreadyJoined && !isClosed && !isExpired;
          return (
            <ProgramCard key={`${program.serviceKey}-${program.id}`} program={program}
              actionLabel={canJoin ? joinActionLabel(program) : null}
              onAction={canJoin ? () => onJoin(program.serviceKey, program.id) : null}
              footer={alreadyJoined ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/10 px-3 py-1.5 text-xs font-bold text-[#10b981]">✓ Already Joined</span> : isClosed ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#64748b]/10 px-3 py-1.5 text-xs font-bold text-[#64748b]">🔒 Closed</span> : isExpired ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f59e0b]/10 px-3 py-1.5 text-xs font-bold text-[#f59e0b]">⏰ Expired</span> : null}
            />
          );
        })}
      </div>
    </div>
  );
}

function DashboardPage({
  aggregate,
  currentServiceDashboard,
  role,
  actionBusy,
  showRequestForm,
  setShowRequestForm,
  programDraft,
  setProgramDraft,
  onCreateProgram,
  onDecision,
  onDeleteProgram,
  onCloseProgram,
  onJoin,
  activeReportTarget,
  setActiveReportTarget,
  reportDrafts,
  updateReportDraft,
  onReportSubmit,
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-[#334155] bg-[#1e293b]/60 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b]">Workspace</p>
            <h1 className="mt-2 text-2xl font-bold text-white">{roleLabel(role)} workspace</h1>
            <p className="mt-2 text-sm text-[#94a3b8]">Approvals, automation, joins, persistent notifications, and reports now flow through one dashboard.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Programs" value={aggregate.visibleProgramCount} accent />
            <MetricCard label="Submissions" value={aggregate.globalSubmissions} />
            <MetricCard label="Researchers" value={aggregate.globalParticipants} />
            <MetricCard label="Unread" value={aggregate.unreadCount} />
          </div>
        </div>
      </section>

      {role === "platform_admin" ? <PlatformAdminDashboard aggregate={aggregate} actionBusy={actionBusy} onDecision={onDecision} onDeleteProgram={onDeleteProgram} onCloseProgram={onCloseProgram} /> : null}
      {role === "org_admin" ? (
        <OrganizationAdminDashboard
          aggregate={aggregate}
          currentServiceDashboard={currentServiceDashboard}
          actionBusy={actionBusy}
          showRequestForm={showRequestForm}
          setShowRequestForm={setShowRequestForm}
          programDraft={programDraft}
          setProgramDraft={setProgramDraft}
          onCreateProgram={onCreateProgram}
        />
      ) : null}
      {role === "researcher" ? (
        <ResearcherDashboard
          aggregate={aggregate}
          currentServiceDashboard={currentServiceDashboard}
          actionBusy={actionBusy}
          onJoin={onJoin}
          activeReportTarget={activeReportTarget}
          setActiveReportTarget={setActiveReportTarget}
          reportDrafts={reportDrafts}
          updateReportDraft={updateReportDraft}
          onReportSubmit={onReportSubmit}
        />
      ) : null}
    </div>
  );
}

function PlatformAdminDashboard({ aggregate, actionBusy, onDecision, onDeleteProgram, onCloseProgram }) {
  return (
    <>
      <SectionCard title="Global Approval Queue" subtitle="Approve or decline pending requests across Challenge, AI Red Team, and Bug Bounty.">
        <div className="grid gap-4">
          {aggregate.pendingPrograms.length ? aggregate.pendingPrograms.map((program) => (
            <ProgramCard
              key={`${program.serviceKey}-${program.id}`}
              program={program}
              isAdmin={true}
              footer={
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500"><span className="font-semibold uppercase tracking-wider text-[#A67C5D]">Contact Email:</span> {program.contactEmail || "Not provided"}</p>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" disabled={actionBusy} onClick={() => onDecision(program.serviceKey, program.id, "approve")} className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-4 py-2 text-sm font-bold text-white disabled:opacity-60 transition">Approve</button>
                    <button type="button" disabled={actionBusy} onClick={() => onDecision(program.serviceKey, program.id, "decline")} className="rounded-xl border border-[#ef4444]/30 px-4 py-2 text-sm font-semibold text-[#ef4444] disabled:opacity-60 transition">Decline</button>
                  </div>
                </div>
              }
            />
          )) : <EmptyState label="No pending approvals right now." />}
        </div>
      </SectionCard>

      <SectionCard title="Approved Program Oversight" subtitle="See who joined each approved program, including the AntCrowd CTF, across all services.">
        <div className="grid gap-4">
          {aggregate.approvedPrograms.length ? aggregate.approvedPrograms.map((program) => (
            <ProgramCard
              key={`${program.serviceKey}-${program.id}`}
              program={program}
              isAdmin={true}
              footer={
                <div className="flex flex-wrap gap-3">
                  {program.status === "approved" && (
                    <button type="button" disabled={actionBusy} onClick={() => onCloseProgram(program.serviceKey, program.id)} className="rounded-xl border border-[#f59e0b]/30 px-4 py-2 text-sm font-semibold text-[#f59e0b] disabled:opacity-60 transition">Close Program</button>
                  )}
                  <button type="button" disabled={actionBusy} onClick={() => onDeleteProgram(program.serviceKey, program.id)} className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/5 px-4 py-2 text-sm font-semibold text-[#ef4444] disabled:opacity-60 transition">Delete Program</button>
                </div>
              }
            />
          )) : <EmptyState label="No approved programs yet." />}
        </div>
      </SectionCard>

      <SectionCard title="All Reports And Flags" subtitle="Persistent submissions from all three services.">
        <SubmissionList submissions={aggregate.visibleSubmissions} emptyLabel="No submissions yet." />
      </SectionCard>
    </>
  );
}

function OrganizationAdminDashboard({ aggregate, currentServiceDashboard, actionBusy, showRequestForm, setShowRequestForm, programDraft, setProgramDraft, onCreateProgram }) {
  const formConfig = PROGRAM_FORM_CONFIG[CURRENT_SERVICE_KEY];
  const ownedPrograms = (currentServiceDashboard.programs ?? []).map((program) => enrichProgram(program, CURRENT_SERVICE));
  const serviceNotifications = (currentServiceDashboard.notifications ?? []).map((item) => ({ ...item, serviceKey: CURRENT_SERVICE.key, serviceName: CURRENT_SERVICE.shortName }));
  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Create Program Request" subtitle="Build on the existing service flow and submit a persistent request for approval.">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setShowRequestForm((current) => !current)} className="rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-5 py-3 text-sm font-bold text-[#0f172a] transition">
              {showRequestForm ? "Hide Request Form" : "Create Service Request"}
            </button>
            <span className="rounded-full border border-[#334155] bg-[#0f172a] px-4 py-3 text-sm text-[#94a3b8]">{CURRENT_SERVICE.name}</span>
          </div>
          {showRequestForm ? (
            <form onSubmit={onCreateProgram} noValidate className="mt-5 grid gap-4 rounded-xl border border-[#334155] bg-[#0f172a] p-5">
              <h3 className="text-lg font-bold text-white">{formConfig.title}</h3>
              <p className="text-sm text-[#94a3b8]">{formConfig.subtitle}</p>
              <ServiceRequestFields draft={programDraft} setDraft={setProgramDraft} />
              <button type="submit" disabled={actionBusy} className="rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-5 py-3 text-sm font-bold text-[#0f172a] disabled:opacity-60 transition">
                {actionBusy ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          ) : (
            <EmptyState label="Open the button above to create a new request for this service." />
          )}
        </SectionCard>

        <SectionCard title="Owned Programs" subtitle="Track approvals, joins, automation results, and submissions for programs you own.">
          <div className="grid gap-4">
            {ownedPrograms.length ? ownedPrograms.map((program) => <ProgramCard key={`${program.serviceKey}-${program.id}`} program={program} />) : <EmptyState label="No organization-owned programs found in this service yet." />}
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Notifications" subtitle="Approvals, automation readiness, joins, and submissions related to your programs.">
        <NotificationList items={serviceNotifications.filter((item) => item.kind !== "announcement")} />
      </SectionCard>
    </>
  );
}

function ResearcherDashboard({ aggregate, currentServiceDashboard, actionBusy, onJoin, activeReportTarget, setActiveReportTarget, reportDrafts, updateReportDraft, onReportSubmit }) {
  const availablePrograms = (currentServiceDashboard.availablePrograms ?? []).map((program) => enrichProgram(program, CURRENT_SERVICE));
  const joinedPrograms = (currentServiceDashboard.joinedPrograms ?? []).map((program) => enrichProgram(program, CURRENT_SERVICE));
  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        {Object.values(SERVICES).map((service) => {
          const dashboard = aggregate.dashboardByService[service.key];
          return (
            <SectionCard key={service.key} title={service.shortName} subtitle={service.key === "challenge" ? "Challenges and CTF progress." : service.key === "ai-redteam" ? "AI targets and automation." : "Bug bounty targets and auto severity."}>
              <div className="grid gap-3">
                <MetricCard label="Available" value={dashboard?.availablePrograms?.length ?? 0} accent />
                <MetricCard label="Joined" value={dashboard?.joinedPrograms?.length ?? 0} />
                <MetricCard label="Personal Value" value={dashboard?.summary?.userValue ?? 0} />
              </div>
            </SectionCard>
          );
        })}
      </section>

      <SectionCard title="Join Open Programs" subtitle="Approved challenges, AI systems, and bounty programs you can join now.">
        <div className="grid gap-4">
          {availablePrograms.length ? availablePrograms.filter((p) => p.status !== "closed" && p.status !== "expired").map((program) => (
            <ProgramCard key={`${program.serviceKey}-${program.id}`} program={program} actionLabel={joinActionLabel(program)} onAction={() => onJoin(program.serviceKey, program.id)} />
          )) : <EmptyState label={`You already joined every approved ${CURRENT_SERVICE.shortName.toLowerCase()} program.`} />}
        </div>
      </SectionCard>

      <SectionCard title="Your Joined Programs" subtitle="Open a program card to submit a report directly from the challenge you joined." id="joined-programs-section">
        <div className="grid gap-4">
          {joinedPrograms.length ? joinedPrograms.map((program) => {
            const key = `${program.serviceKey}:${program.id}`;
            const draft = reportDrafts[key] ?? defaultReportDraftFor(program);
            const open = activeReportTarget === key;
            return (
              <ProgramCard
                key={key}
                program={program}
                footer={
                  <div className="grid gap-4">
                    {program.serviceKey === "challenge" && program.isCtf ? (
                      <Link to="/antcrowd-ctf" className="inline-flex w-fit rounded-full bg-[#C8102E] px-5 py-3 text-sm font-semibold text-white">
                        Open AntCrowd Web Security Lab
                      </Link>
                    ) : (
                      <button type="button" onClick={() => setActiveReportTarget(open ? "" : key)} className="w-fit rounded-xl border border-[#f59e0b]/30 px-4 py-2 text-sm font-semibold text-[#f59e0b] transition hover:bg-[#f59e0b]/5">
                        {open ? "Hide Report Form" : "Submit Report"}
                      </button>
                    )}
                    {open ? <ProgramReportForm program={program} draft={draft} actionBusy={actionBusy} updateDraft={updateReportDraft} onSubmit={onReportSubmit} /> : null}
                  </div>
                }
              />
            );
          }) : <EmptyState label={`You have not joined any ${CURRENT_SERVICE.shortName.toLowerCase()} programs yet.`} />}
        </div>
      </SectionCard>
    </>
  );
}

function ProgramReportForm({ program, draft, actionBusy, updateDraft, onSubmit }) {
  const severityPreview = program.serviceKey === "bug-bounty" ? previewSeverity(draft.finding_categories || []) : null;
  return (
    <form onSubmit={(event) => onSubmit(program, event)} className="grid gap-4 rounded-xl border border-[#334155] bg-[#0f172a] p-4">
      <LabelledInput label="Report Title" value={draft.title} onChange={(value) => updateDraft(program, { title: value })} />
      <LabelledTextarea label="Summary" value={draft.summary} onChange={(value) => updateDraft(program, { summary: value })} />
      {program.serviceKey === "bug-bounty" ? (
        <>
          <LabelledInput label="Vulnerable URL / Location" value={draft.vulnerable_url} onChange={(value) => updateDraft(program, { vulnerable_url: value })} />
          <MultiSelectField
            label="Finding Categories"
            options={["XSS", "SQL Injection", "RCE", "Authentication Bypass", "IDOR", "Sensitive Data Exposure", "Broken Access Control", "SSRF", "Other"]}
            selected={draft.finding_categories}
            onChange={(value) => updateDraft(program, { finding_categories: value })}
          />
          <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 px-4 py-3 text-sm font-bold text-[#ef4444]">
            Auto-assigned severity: {severityPreview}
          </div>
        </>
      ) : (
        <>
          <SelectField label="Impact" value={draft.impact} options={["Critical", "High", "Medium", "Low"]} onChange={(value) => updateDraft(program, { impact: value })} />
          {program.serviceKey === "challenge" ? <LabelledInput label="Flag" value={draft.flag} onChange={(value) => updateDraft(program, { flag: value })} placeholder="flag{...}" required={false} /> : null}
        </>
      )}
      <LabelledInput label="Evidence" value={draft.evidence} onChange={(value) => updateDraft(program, { evidence: value })} />
      <button type="submit" disabled={actionBusy} className="w-fit rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-5 py-3 text-sm font-bold text-[#0f172a] disabled:opacity-60 transition">
        {actionBusy ? "Submitting..." : "Submit Report"}
      </button>
    </form>
  );
}

function ServiceRequestFields({ draft, setDraft }) {
  if (CURRENT_SERVICE_KEY === "bug-bounty") {
    return (
      <>
        <LabelledInput label="Program Name" value={draft.program_name} onChange={(value) => setDraft({ ...draft, program_name: value })} />
        <LabelledTextarea label="Description" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
        <LabelledInput label="Contact Email" type="email" value={draft.contact_email} onChange={(value) => setDraft({ ...draft, contact_email: value })} />
        <FieldHint text="Contact email for platform admins to reach the organization admin." />
        <SelectField label="Program Type" value={draft.program_type} options={["Public", "Private"]} onChange={(value) => setDraft({ ...draft, program_type: value })} />
        <MultiSelectField label="Target Assets" options={PROGRAM_FORM_CONFIG["bug-bounty"].multiselectOptions.target_assets} selected={draft.target_assets} onChange={(value) => setDraft({ ...draft, target_assets: value })} />
        <LabelledTextarea label="In-Scope Targets" value={draft.in_scope_targets} onChange={(value) => setDraft({ ...draft, in_scope_targets: value })} />
        <FieldHint text="URLs and assets researchers are allowed to test." />
        <LabelledInput label="Out-of-Scope" value={draft.out_of_scope} onChange={(value) => setDraft({ ...draft, out_of_scope: value })} />
        <FieldHint text="Assets explicitly excluded from testing." />
        <LabelledInput label="Reward Range" value={draft.reward_range} onChange={(value) => setDraft({ ...draft, reward_range: value })} />
        <FieldHint text="e.g. 5,000 – 50,000 ETB depending on severity." />
        <LabelledInput label="Target URL" value={draft.poc_target_url} onChange={(value) => setDraft({ ...draft, poc_target_url: value })} />
        <FieldHint text="Primary URL researchers will test against." />
        <LabelledTextarea label="Rules of Engagement" value={draft.rules_of_engagement} onChange={(value) => setDraft({ ...draft, rules_of_engagement: value })} />
        <FieldHint text="Boundaries and acceptable testing methods." />
        <div className="grid gap-4 md:grid-cols-2">
          <LabelledInput label="Start Date" type="date" value={draft.testing_start_date} onChange={(value) => setDraft({ ...draft, testing_start_date: value })} />
          <LabelledInput label="End Date" type="date" value={draft.testing_end_date} onChange={(value) => setDraft({ ...draft, testing_end_date: value })} />
        </div>
        <LabelledInput label="Budget (ETB)" value={draft.budget} onChange={(value) => setDraft({ ...draft, budget: value })} />
      </>
    );
  }

  if (CURRENT_SERVICE_KEY === "challenge") {
    return (
      <>
        <LabelledInput label="Program Name" value={draft.program_name} onChange={(value) => setDraft({ ...draft, program_name: value })} />
        <LabelledTextarea label="Description" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
        <LabelledInput label="Contact Email" type="email" value={draft.contact_email} onChange={(value) => setDraft({ ...draft, contact_email: value })} />
        <FieldHint text="Contact email for platform admins to reach the organization admin." />
        <MultiSelectField label="Challenge Categories" options={PROGRAM_FORM_CONFIG.challenge.multiselectOptions.challenge_categories} selected={draft.challenge_categories} onChange={(value) => { const level = autoDifficulty(value); setDraft({ ...draft, challenge_categories: value, difficulty_level: level }); }} />
        <FieldHint text={`Difficulty auto-assigned: ${autoDifficulty(draft.challenge_categories)}`} />
        {draft.challenge_categories.includes("Other") ? <><LabelledInput label="Specify Other Category" value={draft.other_category} onChange={(value) => setDraft({ ...draft, other_category: value })} placeholder="e.g. Hardware Hacking" /><FieldHint text="Describe the custom category. Difficulty will be set to Uncategorized." /></> : null}
        <LabelledInput label="Prize Pool (ETB)" value={draft.prize_pool_etb} onChange={(value) => setDraft({ ...draft, prize_pool_etb: value })} />
        <FieldHint text="Total reward pool for the challenge." />
        <div className="grid gap-4 md:grid-cols-2">
          <LabelledInput label="Start Date" type="date" value={draft.start_date} onChange={(value) => setDraft({ ...draft, start_date: value })} />
          <LabelledInput label="End Date" type="date" value={draft.end_date} onChange={(value) => setDraft({ ...draft, end_date: value })} />
        </div>
        <LabelledInput label="Flag Format" value={draft.flag_format} onChange={(value) => setDraft({ ...draft, flag_format: value })} />
        <FieldHint text="Pattern for flags, e.g. flag{example_*}" />
        <LabelledInput label="Correct Flag" value={draft.correct_flag} onChange={(value) => setDraft({ ...draft, correct_flag: value })} required={false} />
        <FieldHint text="Optional. If set, researcher submissions will be validated against this flag." />
      </>
    );
  }

  return (
    <>
      <LabelledInput label="AI System Name" value={draft.ai_system_name} onChange={(value) => setDraft({ ...draft, ai_system_name: value })} />
      <LabelledTextarea label="Description / Purpose" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
      <LabelledInput label="Contact Email" type="email" value={draft.contact_email} onChange={(value) => setDraft({ ...draft, contact_email: value })} />
      <FieldHint text="Contact email for platform admins to reach the organization admin." />
      <div className="grid gap-4 md:grid-cols-2">
        <LabelledInput label="Access Method" value={draft.access_method} onChange={(value) => setDraft({ ...draft, access_method: value })} />
        <LabelledInput label="AI System URL" value={draft.access_url} onChange={(value) => setDraft({ ...draft, access_url: value })} />
      </div>
      <FieldHint text="How researchers access the AI system (e.g. Web sandbox, API)." />
      <LabelledInput label="Model Type / Version" value={draft.model_type_version} onChange={(value) => setDraft({ ...draft, model_type_version: value })} />
      <MultiSelectField label="Scope of Testing" options={PROGRAM_FORM_CONFIG["ai-redteam"].multiselectOptions.scope_of_testing} selected={draft.scope_of_testing} onChange={(value) => setDraft({ ...draft, scope_of_testing: value })} />
      <div className="grid gap-4 md:grid-cols-2">
        <LabelledInput label="Testing Start Date" type="date" value={draft.testing_start_date} onChange={(value) => setDraft({ ...draft, testing_start_date: value })} />
        <LabelledInput label="Testing End Date" type="date" value={draft.testing_end_date} onChange={(value) => setDraft({ ...draft, testing_end_date: value })} />
      </div>
      <LabelledInput label="Budget / Reward (ETB)" value={draft.budget_reward} onChange={(value) => setDraft({ ...draft, budget_reward: value })} />
    </>
  );
}

function AdminSubmissionItem({ item, programId }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-1 w-full text-left">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="rounded-lg bg-[#1e293b] hover:bg-[#334155] px-3 py-2 text-sm text-[#94a3b8] cursor-pointer transition flex justify-between items-center"
      >
        <span>
          <strong className="text-white">{item.title}</strong> by {item.usernameLabel || item.username}
        </span>
        <span className="text-[10px] uppercase font-bold text-[#f59e0b] select-none">
          {isExpanded ? "Collapse" : "Expand"}
        </span>
      </div>

      {isExpanded && (
        <div className="rounded-lg border border-[#334155] bg-[#0b0f19] p-3 text-xs text-[#94a3b8] space-y-2 mt-1">
          <div><strong className="text-white">Title:</strong> {item.title}</div>
          <div><strong className="text-white">Submitter:</strong> {item.usernameLabel || item.username}</div>
          {item.summary && (
            <div>
              <strong className="text-white">Summary:</strong>
              <p className="mt-1 whitespace-pre-wrap">{item.summary}</p>
            </div>
          )}
          {item.description && (
            <div>
              <strong className="text-white">Description:</strong>
              <p className="mt-1 whitespace-pre-wrap">{item.description}</p>
            </div>
          )}
          {item.evidence && (
            <div>
              <strong className="text-white">Evidence:</strong>{" "}
              <span className="text-[#f59e0b] break-all">{item.evidence}</span>
            </div>
          )}
          {item.vulnerableUrl && (
            <div>
              <strong className="text-white">Vulnerable URL:</strong>{" "}
              <span className="text-[#f59e0b] break-all">{item.vulnerableUrl}</span>
            </div>
          )}
          {item.vulnerable_url && (
            <div>
              <strong className="text-white">Vulnerable URL:</strong>{" "}
              <span className="text-[#f59e0b] break-all">{item.vulnerable_url}</span>
            </div>
          )}
          {item.access_url && (
            <div>
              <strong className="text-white">Access URL:</strong>{" "}
              <span className="text-[#f59e0b] break-all">{item.access_url}</span>
            </div>
          )}
          {item.findingCategories && item.findingCategories.length > 0 && (
            <div>
              <strong className="text-white">Categories:</strong>{" "}
              {item.findingCategories.join(", ")}
            </div>
          )}
          {item.impact && (
            <div>
              <strong className="text-white">Impact Level:</strong> {item.impact}
            </div>
          )}
          {item.severity && (
            <div>
              <strong className="text-white">Severity:</strong> {item.severity}
            </div>
          )}
          {item.createdAt && (
            <div>
              <strong className="text-white">Submission Date:</strong>{" "}
              {new Date(item.createdAt).toLocaleString()}
            </div>
          )}
          {item.status && (
            <div>
              <strong className="text-white">Status:</strong> {item.status}
            </div>
          )}
          <div className="flex justify-end mt-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
              className="text-[10px] uppercase font-bold text-[#ef4444] hover:underline"
            >
              Collapse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgramCard({ program, actionLabel, onAction, footer, isAdmin = false }) {
  return (
    <article className="rounded-2xl border border-[#334155] bg-[#1e293b] p-5 hover:border-[#f59e0b]/30 transition">
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Pill>{program.serviceName}</Pill>
            <StatusPill status={program.status} />
          </div>
          <h3 className="text-lg font-bold text-white">{program.title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#94a3b8] line-clamp-2">{program.summary}</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Detail label="Scope" value={program.scope} />
          <Detail label="Reward" value={program.reward} />
          <Detail label="Participants" value={`${program.participantCount}`} />
          <Detail label="Submissions" value={`${program.submissionCount}`} />
        </div>
        {program.participants?.length ? (<div className="flex flex-wrap gap-2">{program.participants.map((p) => <Pill key={`${program.id}-${p}`}>{p}</Pill>)}</div>) : null}
        {program.automationResults?.length ? (
          <div className="grid gap-2 rounded-xl border border-[#334155] bg-[#0f172a] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b]">Automation Results</p>
            {program.automationResults.slice(0, 4).map((item) => (<div key={`${program.id}-${item.id}`} className="rounded-lg bg-[#1e293b] px-3 py-2 text-sm text-[#94a3b8]"><strong className="text-white">{item.testName}:</strong> {item.status} | {item.details}</div>))}
          </div>
        ) : null}
        {program.recentSubmissions?.length ? (
          <div className="grid gap-2 rounded-xl border border-[#334155] bg-[#0f172a] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#f59e0b]">Recent Submissions</p>
            {program.recentSubmissions.map((item) => (
              isAdmin ? (
                <AdminSubmissionItem key={`${program.id}-${item.id}`} item={item} programId={program.id} />
              ) : (
                <div key={`${program.id}-${item.id}`} className="rounded-lg bg-[#1e293b] px-3 py-2 text-sm text-[#94a3b8]"><strong className="text-white">{item.title}</strong> by {item.usernameLabel}</div>
              )
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-3">
          {actionLabel && onAction ? <button type="button" onClick={onAction} className="rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-4 py-2 text-sm font-bold text-[#0f172a] transition">{actionLabel}</button> : null}
        </div>
        {footer}
      </div>
    </article>
  );
}

function SubmissionList({ submissions, emptyLabel }) {
  if (!submissions.length) return <EmptyState label={emptyLabel} />;
  return (
    <div className="grid gap-4">
      {submissions.map((item) => (
        <article key={`${item.serviceKey}-${item.id}`} className="rounded-2xl border border-[#334155] bg-[#1e293b] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{item.serviceName}</Pill>
            <StatusPill status={item.status} />
            <Pill>{item.impact}</Pill>
            {(item.developerTag || item.developer_tag) && (
              <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider border ${
                (item.developerTag || item.developer_tag) === 'accepted' ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40' :
                (item.developerTag || item.developer_tag) === 'declined' ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40' :
                'bg-[#a78bfa]/20 text-[#a78bfa] border-[#a78bfa]/40'
              }`}>
                🏷 {(item.developerTag || item.developer_tag) === 'retest_required' ? 'Retest Required' : (item.developerTag || item.developer_tag)}
              </span>
            )}
          </div>
          <h3 className="mt-3 font-bold text-white">{item.title}</h3>
          <p className="mt-2 text-sm text-[#94a3b8]">{item.programTitle} by {item.usernameLabel || item.username}</p>
          <p className="mt-1 text-sm text-[#94a3b8]">{item.summary}</p>
          {item.vulnerableUrl ? <p className="mt-1 text-sm text-[#64748b]">Target: {item.vulnerableUrl}</p> : null}
          {item.findingCategories?.length ? <p className="mt-1 text-sm text-[#64748b]">Categories: {item.findingCategories.join(", ")}</p> : null}
          <p className="mt-3 text-sm font-bold text-[#f59e0b]">Awarded: {item.valueAwarded} {item.valueLabel}</p>
        </article>
      ))}
    </div>
  );
}

function NotificationList({ items }) {
  return items.length ? (
    <ul className="grid gap-3">
      {items.map((note) => <li key={`${note.serviceKey}-${note.id}`} className="rounded-xl border-l-4 border-[#f59e0b] bg-[#0f172a] px-4 py-3 text-sm text-[#94a3b8]">{note.serviceName}: <span className="font-bold text-white">{note.title}</span> - {note.message}</li>)}
    </ul>
  ) : <EmptyState label="No notifications at the moment." />;
}

function SectionCard({ title, subtitle, children, id }) {
  return (
    <section id={id} className="rounded-2xl border border-[#334155] bg-[#1e293b]/60 p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-[#94a3b8]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function MultiSelectField({ label, options, selected, onChange }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">{label}</span>
      <div className="flex flex-wrap gap-2 rounded-xl border border-[#334155] bg-[#0f172a] p-3">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button key={option} type="button" onClick={() => onChange(active ? selected.filter((item) => item !== option) : [...selected, option])} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${active ? "bg-[#f59e0b] text-[#0f172a]" : "bg-[#334155] text-[#94a3b8] hover:bg-[#475569]"}`}>
              {option}
            </button>
          );
        })}
      </div>
    </label>
  );
}

function SelectField({ label, value, options, onChange, required = true }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-[#334155] bg-[#0f172a] px-4 py-3 text-sm text-[#f1f5f9] focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]/30 outline-none" required={required}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function FieldHint({ text }) {
  return <p className="mt-[-0.5rem] text-xs leading-5 text-[#64748b]">{text}</p>;
}

function LabelledInput({ label, value, onChange, type = "text", required = true, placeholder }) {
  return <label className="grid gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">{label}</span><input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-[#334155] bg-[#0f172a] px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#64748b] focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]/30 outline-none" required={required} placeholder={placeholder} /></label>;
}

function LabelledTextarea({ label, value, onChange, required = true }) {
  return <label className="grid gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">{label}</span><textarea rows="4" value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-[#334155] bg-[#0f172a] px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#64748b] resize-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]/30 outline-none" required={required} /></label>;
}

function MetricCard({ label, value, accent = false }) {
  return <div className={`rounded-2xl border p-5 ${accent ? "border-[#f59e0b]/30 bg-[#f59e0b]/5" : "border-[#334155] bg-[#0f172a]"}`}><p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">{label}</p><p className="mt-2 text-3xl font-extrabold text-white">{value}</p></div>;
}

function Detail({ label, value }) {
  return <div className="rounded-xl border border-[#334155] bg-[#0f172a] p-3"><p className="text-[10px] uppercase tracking-widest text-[#64748b]">{label}</p><p className="mt-1 text-sm text-[#f1f5f9]">{value}</p></div>;
}

function Pill({ children }) {
  return <span className="rounded-full bg-[#334155] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">{children}</span>;
}

function StatusPill({ status }) {
  const palette = { approved: "bg-[#10b981]/15 text-[#10b981]", pending: "bg-[#f59e0b]/15 text-[#f59e0b]", declined: "bg-[#ef4444]/15 text-[#ef4444]", validated: "bg-[#10b981]/15 text-[#10b981]", submitted: "bg-[#f59e0b]/15 text-[#f59e0b]", accepted: "bg-[#10b981]/15 text-[#10b981]", ready: "bg-[#10b981]/15 text-[#10b981]", closed: "bg-[#64748b]/15 text-[#64748b]", expired: "bg-[#64748b]/15 text-[#64748b]", deleted: "bg-[#ef4444]/15 text-[#ef4444]" };
  return <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${palette[status] ?? "bg-[#334155] text-[#94a3b8]"}`}>{status}</span>;
}

function EmptyState({ label }) {
  return <div className="rounded-xl border border-dashed border-[#334155] bg-[#0f172a]/50 p-5 text-sm text-[#64748b]">{label}</div>;
}

function LoadingCard({ label }) {
  return <div className="rounded-xl border border-dashed border-[#f59e0b]/30 bg-[#f59e0b]/5 p-5 text-sm text-[#f59e0b]">{label}</div>;
}

function Banner({ tone, message }) {
  const styles = tone === "error" ? "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#fca5a5]" : tone === "warning" ? "border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#fbbf24]" : "border-[#10b981]/30 bg-[#10b981]/10 text-[#6ee7b7]";
  return <div className={`rounded-xl border px-5 py-3 text-sm font-medium ${styles}`}>{message}</div>;
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 grid gap-3">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-80 rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">{toast.title}</p>
              <p className="mt-1 text-xs text-[#94a3b8]">{toast.message}</p>
            </div>
            <button type="button" onClick={() => onDismiss(toast.id)} className="text-[#64748b] hover:text-white"><X size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function buildAggregate(publicData, dashboards, notificationsByService) {
  const publicByService = {};
  const dashboardByService = {};
  const publicPrograms = [];
  const pendingPrograms = [];
  const approvedPrograms = [];
  const ownedPrograms = [];
  const joinedPrograms = [];
  const availablePrograms = [];
  const visibleSubmissions = [];
  const notifications = [];
  let globalParticipants = 0;
  let globalSubmissions = 0;
  let unreadCount = 0;

  Object.values(SERVICES).forEach((service) => {
    const publicSnapshot = publicData[service.key];
    const dashboard = dashboards[service.key];
    const notificationPayload = notificationsByService[service.key];
    publicByService[service.key] = publicSnapshot;
    dashboardByService[service.key] = dashboard;
    globalParticipants += publicSnapshot?.summary?.participants ?? 0;
    globalSubmissions += publicSnapshot?.summary?.submissions ?? 0;
    (publicSnapshot?.programs ?? []).forEach((program) => publicPrograms.push(enrichProgram(program, service)));
    (dashboard?.pendingPrograms ?? []).forEach((program) => pendingPrograms.push(enrichProgram(program, service)));
    (dashboard?.programs ?? []).forEach((program) => {
      const enriched = enrichProgram(program, service);
      if (program.status === "approved") approvedPrograms.push(enriched);
      if (program.owner === "org_admin") ownedPrograms.push(enriched);
    });
    (dashboard?.joinedPrograms ?? []).forEach((program) => joinedPrograms.push(enrichProgram(program, service)));
    (dashboard?.availablePrograms ?? []).forEach((program) => availablePrograms.push(enrichProgram(program, service)));
    (dashboard?.submissions ?? []).forEach((item) => visibleSubmissions.push({ ...item, serviceKey: service.key, serviceName: service.shortName, valueLabel: service.valueLabel }));
    (notificationPayload?.items ?? []).forEach((item) => notifications.push({ ...item, serviceKey: service.key, serviceName: service.shortName }));
    unreadCount += notificationPayload?.unreadCount ?? 0;
  });

  return {
    publicByService,
    dashboardByService,
    publicPrograms: sortByCreatedAt(publicPrograms),
    pendingPrograms: sortByCreatedAt(pendingPrograms),
    approvedPrograms: sortByCreatedAt(approvedPrograms),
    ownedPrograms: sortByCreatedAt(ownedPrograms),
    joinedPrograms: sortByCreatedAt(joinedPrograms),
    availablePrograms: sortByCreatedAt(availablePrograms),
    visibleSubmissions: sortByCreatedAt(visibleSubmissions),
    notifications: sortByCreatedAt(notifications),
    visibleProgramCount: ownedPrograms.length || joinedPrograms.length || publicPrograms.length,
    globalParticipants,
    globalSubmissions,
    unreadCount,
  };
}

function enrichProgram(program, service) {
  return { ...program, serviceKey: service.key, serviceName: service.shortName, valueLabel: service.valueLabel };
}

function extractError(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg).filter(Boolean).join("; ") || fallback;
  }
  return detail ?? error?.message ?? fallback;
}

function roleLabel(role) {
  const labels = { platform_admin: "Platform Admin", org_admin: "Organization Admin", researcher: "Researcher", user: "Public Visitor" };
  return labels[role] ?? "Guest";
}

function sortByCreatedAt(items) {
  return [...items].sort((left, right) => {
    const leftValue = Date.parse(left?.createdAt ?? "") || 0;
    const rightValue = Date.parse(right?.createdAt ?? "") || 0;
    return rightValue - leftValue;
  });
}

const CATEGORY_DIFFICULTY = {
  Crypto: "Hard", Reverse: "Hard", PWN: "Hard",
  Web: "Medium", Forensics: "Medium", Mobile: "Medium", Steganography: "Medium",
  OSINT: "Easy", Misc: "Easy",
  Other: "Uncategorized",
};

function autoDifficulty(categories) {
  if (!categories || categories.length === 0) return "Medium";
  const rank = { Hard: 3, Medium: 2, Easy: 1, Uncategorized: 0 };
  let highest = "Easy";
  for (const cat of categories) {
    const level = CATEGORY_DIFFICULTY[cat] || "Medium";
    if ((rank[level] ?? 0) > (rank[highest] ?? 0)) highest = level;
  }
  if (categories.length === 1 && categories[0] === "Other") return "Uncategorized";
  return highest;
}

function joinActionLabel(program) {
  if (program.serviceKey === "challenge") return "Join Challenge";
  if (program.serviceKey === "ai-redteam") return "Start Testing";
  return "Join Program";
}

function ExternalCtfRedirect() {
  window.location.href = `${SERVICES.challenge.frontendUrl}/antcrowd-ctf`;
  return null;
}
