import { useEffect, useMemo, useState } from "react";
import { penApi } from "./api";
import { EmptyState, SeverityBadge, StatusBadge, formatPortalLabel } from "../../shared/components/PortalUI";
import FindingReviewBoard from "../../shared/components/FindingReviewBoard";
import { brandAssets } from "@ant-ui";

const engagementTypes = ["Web App", "API", "Mobile", "Network", "Cloud", "AI"];
const engagementModes = ["on_demand", "continuous"];
const testerPools = ["internal", "external"];
const engagementStatuses = ["draft", "active", "in_retest", "closed"];

const ROUTES = {
  HOME: "/org",
  ENGAGEMENTS: "/org/engagements",
  ASSIGNMENTS: "/org/assignments",
  OPEN_PROGRAMS: "/org/open-programs",
  FINDINGS: "/org/findings",
  SLA_BREACHES: "/org/sla-breaches",
  MTTA: "/org/mtta-hours",
  CLOSED_PROGRAMS: "/org/closed-programs",
  FINDINGS_TOTAL: "/org/findings-total",
  MTTR: "/org/mttr-hours",
};

const knownRoutes = new Set(Object.values(ROUTES));
const insightRoutes = new Set([
  ROUTES.OPEN_PROGRAMS,
  ROUTES.FINDINGS,
  ROUTES.SLA_BREACHES,
  ROUTES.MTTA,
  ROUTES.CLOSED_PROGRAMS,
  ROUTES.FINDINGS_TOTAL,
  ROUTES.MTTR,
]);

const newEngagement = {
  title: "",
  target: "",
  type: "Web App",
  mode: "on_demand",
  testerPool: "external",
  deadline: "",
  budget: "",
  triageSlaHours: 48,
  status: "draft",
  scope: "",
  outOfScope: "",
};

function isOpenProgram(status) {
  return status === "draft" || status === "active" || status === "in_retest";
}

function getRoute() {
  const hash = window.location.hash || `#${ROUTES.HOME}`;
  const [path] = hash.replace("#", "").split("?");
  return knownRoutes.has(path) ? path : ROUTES.HOME;
}

function navigate(route) {
  window.location.hash = `#${route}`;
}

function ratingValue(researcher) {
  return Number(researcher?.avgRating || 0);
}

function starText(value) {
  const rounded = Math.round(Number(value || 0));
  const filled = "★".repeat(Math.max(0, Math.min(5, rounded)));
  const empty = "☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, rounded))));
  return `${filled}${empty}`;
}

function matchesSearch(researcher, term) {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return [researcher.fullName, researcher.handle, researcher.email, researcher.skills]
    .filter(Boolean)
    .some((v) => v.toLowerCase().includes(q));
}

function formatProgramStatus(status) {
  return formatPortalLabel(status || "unknown");
}

function severityRank(severity) {
  const s = (severity || "").toLowerCase();
  if (s === "critical") return 4;
  if (s === "high") return 3;
  if (s === "medium") return 2;
  return 1;
}

export default function App() {
  const [route, setRoute] = useState(getRoute());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [tokenReady, setTokenReady] = useState(!!penApi.getToken());
  const [sessionState, setSessionState] = useState(tokenReady ? "active" : "bootstrapping");
  const [user, setUser] = useState(null);

  const [stats, setStats] = useState({
    openEngagements: 0,
    highCriticalFindings: 0,
    readyForRetest: 0,
    internalResearchersActive: 0,
    externalResearchersActive: 0,
  });
  const [metrics, setMetrics] = useState({
    findingsTotal: 0,
    slaBreached: 0,
    openPrograms: 0,
    closedPrograms: 0,
    mttaHours: 0,
    mttrHours: 0,
    severityMix: {},
  });

  const [engagements, setEngagements] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [internalRequests, setInternalRequests] = useState([]);
  const [findings, setFindings] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [engagementForm, setEngagementForm] = useState(newEngagement);
  const [startActive, setStartActive] = useState(true);
  const [selectedResearcherId, setSelectedResearcherId] = useState("");
  const [createErrors, setCreateErrors] = useState({});
  const [createActionError, setCreateActionError] = useState("");

  const [externalEngagementId, setExternalEngagementId] = useState("");
  const [internalEngagementId, setInternalEngagementId] = useState("");
  const [externalResearcherId, setExternalResearcherId] = useState("");

  const [reportProgramId, setReportProgramId] = useState("");
  const [findingsProgramId, setFindingsProgramId] = useState("");
  const [payoutForm, setPayoutForm] = useState({ programId: "", amount: "", reference: "" });
  const [payoutError, setPayoutError] = useState("");
  const [inviteForm, setInviteForm] = useState({
    role: "researcher_external",
    engagementId: "",
    researcherId: "",
  });
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteError, setInviteError] = useState("");

  const [researcherSearch, setResearcherSearch] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  const hero = useMemo(() => {
    if (route.startsWith(ROUTES.ENGAGEMENTS)) {
      return {
        title: "Launch And Manage Testing Programs",
        text: "Configure scope, match with trusted researchers, and run each engagement with clear SLA and payout signals.",
        image: brandAssets.heroSecurityTeam,
      };
    }
    if (route.startsWith(ROUTES.ASSIGNMENTS)) {
      return {
        title: "Coordinate Internal And Crowd Talent",
        text: "Assignments are part of the organization workflow: directly assign external researchers and request internal support through admin governance.",
        image: brandAssets.heroSecurityTeam,
      };
    }
    if (insightRoutes.has(route)) {
      return {
        title: "Operational Program Insights",
        text: "Navigate quickly from dashboard metrics into focused operational views backed by live service data.",
        image: brandAssets.heroSecurityTeam,
      };
    }
    return {
      title: "Organization Security Operations",
      text: "Track exposure, move faster on remediation, and scale penetration testing with a single command center.",
      image: brandAssets.heroSecurityTeam,
    };
  }, [route]);

  const openEngagements = useMemo(() => engagements.filter((e) => isOpenProgram(e.status)), [engagements]);
  const closedEngagements = useMemo(() => engagements.filter((e) => e.status === "closed"), [engagements]);
  const externalEngagements = useMemo(
    () => openEngagements.filter((e) => e.testerPool === "external"),
    [openEngagements]
  );
  const internalEngagements = useMemo(
    () => openEngagements.filter((e) => e.testerPool === "internal"),
    [openEngagements]
  );

  const externalResearchers = useMemo(() => researchers.filter((r) => !r.isInternal), [researchers]);
  const internalResearchers = useMemo(() => researchers.filter((r) => r.isInternal), [researchers]);

  const filteredResearchers = useMemo(() => {
    const poolInternal = engagementForm.testerPool === "internal";
    const list = poolInternal ? internalResearchers : externalResearchers;
    const min = Number(minRating || 0);
    return list
      .filter((r) => matchesSearch(r, researcherSearch))
      .filter((r) => ratingValue(r) >= min);
  }, [engagementForm.testerPool, internalResearchers, externalResearchers, researcherSearch, minRating]);

  const assignmentResearchers = useMemo(() => {
    const min = Number(minRating || 0);
    return externalResearchers
      .filter((r) => matchesSearch(r, researcherSearch))
      .filter((r) => ratingValue(r) >= min);
  }, [externalResearchers, researcherSearch, minRating]);

  const inviteResearchers = useMemo(() => {
    const wantsInternal = inviteForm.role === "researcher_internal";
    return researchers
      .filter((r) => r.isInternal === wantsInternal)
      .filter((r) => matchesSearch(r, inviteSearch));
  }, [researchers, inviteForm.role, inviteSearch]);

  const selectedResearcherProfile = useMemo(
    () => filteredResearchers.find((r) => String(r.id) === String(selectedResearcherId)) || null,
    [filteredResearchers, selectedResearcherId]
  );

  const selectedExternalResearcherProfile = useMemo(
    () => assignmentResearchers.find((r) => String(r.id) === String(externalResearcherId)) || null,
    [assignmentResearchers, externalResearcherId]
  );

  const selectedInviteResearcher = useMemo(
    () => inviteResearchers.find((r) => String(r.id) === String(inviteForm.researcherId)) || null,
    [inviteResearchers, inviteForm.researcherId]
  );

  const visibleFindings = useMemo(() => {
    const source = findingsProgramId ? findings.filter((f) => String(f.jobId) === String(findingsProgramId)) : findings;
    return [...source].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  }, [findings, findingsProgramId]);

  const payoutCandidates = useMemo(
    () => findings.filter((item) => ["accepted", "paid"].includes(String(item.status || "").toLowerCase())),
    [findings]
  );

  const payoutTotals = useMemo(
    () => ({
      pendingCount: payoutCandidates.filter((item) => String(item.status || "").toLowerCase() === "accepted").length,
      paidCount: payoutCandidates.filter((item) => String(item.status || "").toLowerCase() === "paid").length,
      pendingAmount: payoutCandidates
        .filter((item) => String(item.status || "").toLowerCase() === "accepted")
        .reduce((sum, item) => sum + Number(item.bounty || 0), 0),
      authorizedAmount: payoutCandidates
        .filter((item) => String(item.status || "").toLowerCase() === "paid")
        .reduce((sum, item) => sum + Number(item.bounty || 0), 0),
    }),
    [payoutCandidates]
  );

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!tokenReady) {
      bootstrapPlatformSession();
      return;
    }
    setSessionState("active");
    bootstrap();
  }, [tokenReady]);

  useEffect(() => {
    setSelectedResearcherId("");
  }, [engagementForm.testerPool]);

  useEffect(() => {
    if (selectedResearcherProfile) {
      setRatingStars(Number(selectedResearcherProfile.myRating || 0));
      setRatingComment("");
    } else {
      setRatingStars(0);
      setRatingComment("");
    }
  }, [selectedResearcherProfile?.id]);

  async function bootstrap() {
    setLoading(true);
    setError("");
    try {
      const me = await penApi.me();
      if (me.role !== "organization_admin") throw new Error("Use an organization admin account for this portal.");
      setUser(me);
      await loadAll();
    } catch (e) {
      penApi.setToken("");
      setTokenReady(false);
      setUser(null);
      setError(e.message || "Session expired. Please login again.");
    } finally {
      setLoading(false);
    }
  }

  async function bootstrapPlatformSession() {
    setLoading(true);
    setError("");
    setInfo("");
    setSessionState("bootstrapping");
    try {
      const response = await penApi.bootstrap();
      penApi.setToken(response.access_token || response.token || "");
      setTokenReady(true);
      setInfo("Connected from your AntCrowd organization workspace.");
    } catch (e) {
      setSessionState("needs-platform-login");
      setError(e.message || "Open this workspace from the main AntCrowd platform.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAll() {
    const [dashboard, metricData, engagementData, researcherData, reqData, findingData, noteData] = await Promise.all([
      penApi.getDashboard(),
      penApi.getMetrics(),
      penApi.getEngagements(),
      penApi.getResearchers(),
      penApi.getInternalRequests(),
      penApi.getFindings(),
      penApi.getNotifications(),
    ]);

    setStats(dashboard);
    setMetrics(metricData);
    setEngagements(engagementData || []);
    setResearchers(researcherData || []);
    setInternalRequests(reqData || []);
    setFindings(findingData || []);
    setNotifications(noteData || []);

    const eData = engagementData || [];
    if (eData.length > 0) {
      setReportProgramId((prev) => prev || String(eData[0].id));
      setPayoutForm((prev) => ({ ...prev, programId: prev.programId || String(eData[0].id) }));
      setInviteForm((prev) => ({ ...prev, engagementId: prev.engagementId || String(eData[0].id) }));
    }

    const extEng = eData.find((e) => e.testerPool === "external" && isOpenProgram(e.status)) || eData.find((e) => e.testerPool === "external");
    const intEng = eData.find((e) => e.testerPool === "internal" && isOpenProgram(e.status)) || eData.find((e) => e.testerPool === "internal");
    if (extEng) setExternalEngagementId((prev) => prev || String(extEng.id));
    if (intEng) setInternalEngagementId((prev) => prev || String(intEng.id));

    const extRes = (researcherData || []).find((r) => !r.isInternal);
    if (extRes) setExternalResearcherId((prev) => prev || String(extRes.id));
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error(e);
    }
    const mainAppLoginUrl = (import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173").replace(/\/$/, "") + "/login";
    window.location.assign(mainAppLoginUrl);
  }

  async function createEngagement() {
    setError("");
    setInfo("");
    setCreateActionError("");
    setCreateErrors({});

    const validation = {};
    const title = engagementForm.title.trim();
    const target = engagementForm.target.trim();
    const scope = engagementForm.scope.trim();
    const deadline = engagementForm.deadline;
    const budget = Number(engagementForm.budget);
    const triageSlaHours = Number(engagementForm.triageSlaHours || 48);

    if (!title) validation.title = "Program title is required.";
    if (!target) validation.target = "Target asset is required.";
    if (!deadline) validation.deadline = "Deadline is required.";
    if (!Number.isFinite(budget) || budget <= 0) validation.budget = "Bounty must be greater than zero.";
    if (!scope) validation.scope = "In-scope rules are required.";
    if (!Number.isFinite(triageSlaHours) || triageSlaHours <= 0) validation.triageSlaHours = "Triage SLA must be at least 1 hour.";

    if (Object.keys(validation).length > 0) {
      setCreateErrors(validation);
      setCreateActionError("Please correct the highlighted fields before creating the program.");
      return;
    }

    try {
      const payload = {
        ...engagementForm,
        title,
        target,
        scope,
        status: startActive ? "active" : "draft",
        budget,
        triageSlaHours,
      };
      const out = await penApi.createEngagement(payload);
      const createdId = out?.id;

      if (createdId && selectedResearcherId) {
        const selected = researchers.find((r) => String(r.id) === String(selectedResearcherId));
        if (payload.testerPool === "external" && startActive) {
          await penApi.assignExternalResearcher(createdId, Number(selectedResearcherId));
          setInfo(`Program created and external researcher assigned${selected ? ` (${selected.fullName}).` : "."}`);
        } else if (payload.testerPool === "internal" && startActive) {
          await penApi.requestInternalAssignment(createdId);
          setInfo(`Program created. Internal assignment requested${selected ? ` (preferred: ${selected.fullName}).` : "."}`);
        } else {
          setInfo("Program created. Activate the program to assign researchers.");
        }
      } else {
        setInfo("Program created.");
      }

      setEngagementForm(newEngagement);
      setSelectedResearcherId("");
      await loadAll();
    } catch (e) {
      setCreateActionError(e.message || "Failed to create program.");
    }
  }

  async function updateEngagementStatus(id, status) {
    if (!window.confirm(`Move program to ${status}?`)) return;
    try {
      await penApi.updateEngagementStatus(id, status);
      setInfo(`Program moved to ${status}.`);
      await loadAll();
    } catch (e) {
      setError(e.message || "Failed to update program status");
    }
  }

  async function exportReport(id, title) {
    try {
      const csv = await penApi.exportEngagementReport(id);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "-").toLowerCase()}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setInfo("Report exported.");
    } catch (e) {
      setError(e.message || "Failed to export report");
    }
  }

  async function assignExternal() {
    if (!window.confirm("Assign this external researcher?")) return;
    if (!externalEngagementId || !externalResearcherId) return setError("Select external program and researcher.");
    try {
      await penApi.assignExternalResearcher(Number(externalEngagementId), Number(externalResearcherId));
      setInfo("External researcher assigned.");
      await loadAll();
    } catch (e) {
      setError(e.message || "External assignment failed");
    }
  }

  async function requestInternal() {
    if (!window.confirm("Send internal assignment request to platform admin?")) return;
    if (!internalEngagementId) return setError("Select internal program.");
    try {
      await penApi.requestInternalAssignment(Number(internalEngagementId));
      setInfo("Internal assignment request submitted.");
      await loadAll();
    } catch (e) {
      setError(e.message || "Failed to request internal assignment");
    }
  }

  async function markRead(id) {
    try {
      await penApi.markNotificationRead(id);
      setNotifications((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
    } catch {
      // no-op
    }
  }

  async function submitResearcherRating() {
    if (!selectedResearcherProfile) return;
    if (Number(selectedResearcherProfile.completedPrograms || 0) < 1) {
      setError("Rating is enabled only after the researcher has completed at least one program.");
      return;
    }
    if (ratingStars < 1 || ratingStars > 5) {
      setError("Select a star rating between 1 and 5.");
      return;
    }
    try {
      await penApi.rateResearcher(selectedResearcherProfile.id, ratingStars, ratingComment);
      setInfo(`Rated ${selectedResearcherProfile.fullName} with ${ratingStars} star(s).`);
      await loadAll();
    } catch (e) {
      setError(e.message || "Failed to submit rating");
    }
  }

  function authorizePayout() {
    setError("");
    setInfo("");
    setPayoutError("");

    const amount = Number(payoutForm.amount);
    if (!payoutForm.programId) {
      setPayoutError("Select a program first.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayoutError("Enter a valid payout amount.");
      return;
    }

    const selectedProgram = engagements.find((e) => String(e.id) === String(payoutForm.programId));
    setInfo(
      `Payout authorized for ${selectedProgram ? selectedProgram.title : `program #${payoutForm.programId}`} (${amount} ETB).`
    );
    setPayoutForm((prev) => ({ ...prev, amount: "", reference: "" }));
  }

  async function inviteResearcher() {
    setError("");
    setInfo("");
    setInviteError("");
    if (!inviteForm.engagementId || !inviteForm.researcherId) {
      setInviteError("Select both a program and a researcher.");
      return;
    }
    try {
      await penApi.sendInvitation(Number(inviteForm.engagementId), Number(inviteForm.researcherId));
      setInfo(`Invitation sent to ${selectedInviteResearcher?.fullName || "researcher"}.`);
      setInviteForm((prev) => ({ ...prev, researcherId: "" }));
      await loadAll();
    } catch (e) {
      setInviteError(e.message || "Failed to send invitation.");
    }
  }

  async function viewReport() {
    if (!reportProgramId) return setError("Select a program to view report.");
    const program = engagements.find((e) => String(e.id) === String(reportProgramId));
    if (!program) return setError("Program not found.");
    await exportReport(program.id, program.title);
  }

  async function updateFindingReview(id, payload, message) {
    setError("");
    setInfo("");
    try {
      await penApi.updateFindingStatus(id, payload.status, payload.duplicateOf || 0, payload.bounty || 0, payload.reviewComment || "", payload.paymentReference || "");
      setInfo(message || "Finding updated.");
      await loadAll();
    } catch (e) {
      setError(e.message || "Failed to update finding.");
    }
  }

  function openFindingsForProgram(programId) {
    setFindingsProgramId(String(programId));
    navigate(ROUTES.FINDINGS);
  }

  if (!tokenReady) {
    if (sessionState === "bootstrapping") {
      return (
        <div className="page auth-page" style={{ background: "#020617" }}>
          <div className="auth-card" style={{ border: "1px solid rgba(245,158,11,0.15)", background: "#0b0f19" }}>
            <div className="auth-brand" style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.15rem", fontWeight: "900", color: "#facc15" }}>
              <span style={{ display: "grid", placeItems: "center", width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(to bottom right, #f59e0b, #ea580c)", color: "#090d16", fontSize: "12px", fontWeight: "900" }}>A</span>
              <h1>Preparing Organization Workspace</h1>
            </div>
            <p className="muted">We are confirming your AntCrowd session and connecting you to the pentest workspace.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="page auth-page" style={{ background: "#020617" }}>
        <div className="auth-card" style={{ border: "1px solid rgba(245,158,11,0.15)", background: "#0b0f19" }}>
          <div className="auth-brand" style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.15rem", fontWeight: "900", color: "#facc15" }}>
            <span style={{ display: "grid", placeItems: "center", width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(to bottom right, #f59e0b, #ea580c)", color: "#090d16", fontSize: "12px", fontWeight: "900" }}>A</span>
            <h1>Organization Pentest Workspace</h1>
          </div>
          <p className="muted">Sign in through the main AntCrowd platform, then open the pentest workspace from your organization dashboard.</p>
          <button type="button" onClick={() => window.location.assign("/login")}>
            Return to AntCrowd Login
          </button>
          <img className="auth-visual" src={brandAssets.heroSecurityTeam} alt="Security operations" />
          {error && <div className="notice error">{error}</div>}
        </div>
      </div>
    );
  }

  let content = null;
  if (route.startsWith(ROUTES.ENGAGEMENTS)) {
    const ratingLocked = selectedResearcherProfile && Number(selectedResearcherProfile.completedPrograms || 0) < 1;

    content = (
      <section className="grid two">
        <article className="card">
          <h2>Create Program</h2>
          <p className="section-intro">
            Define scope, timing, bounty, and researcher profile requirements before launching.
          </p>

          <div className="form-block">
            <p className="form-block-title">Program Basics</p>
            <label className="field-label">Program Title *</label>
            <input
              placeholder="Example: Q3 Public API Security Assessment"
              value={engagementForm.title}
              onChange={(e) => setEngagementForm({ ...engagementForm, title: e.target.value })}
            />
            {createErrors.title && <p className="field-error">{createErrors.title}</p>}

            <label className="field-label">Primary Target Asset *</label>
            <input
              placeholder="api.company.com or mobile app package id"
              value={engagementForm.target}
              onChange={(e) => setEngagementForm({ ...engagementForm, target: e.target.value })}
            />
            {createErrors.target && <p className="field-error">{createErrors.target}</p>}
          </div>

          <div className="form-block">
            <p className="form-block-title">Testing Configuration</p>
            <div className="triple">
              <div>
                <label className="field-label">Engagement Type</label>
                <select value={engagementForm.type} onChange={(e) => setEngagementForm({ ...engagementForm, type: e.target.value })}>
                  {engagementTypes.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Mode</label>
                <select value={engagementForm.mode} onChange={(e) => setEngagementForm({ ...engagementForm, mode: e.target.value })}>
                  {engagementModes.map((x) => (
                    <option key={x} value={x}>{x.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Researcher Pool</label>
                <select value={engagementForm.testerPool} onChange={(e) => setEngagementForm({ ...engagementForm, testerPool: e.target.value })}>
                  {testerPools.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-block">
            <p className="form-block-title">Researcher Matching</p>
            <div className="filter-row">
              <input
                placeholder="Search researchers by name, handle, or skill"
                value={researcherSearch}
                onChange={(e) => setResearcherSearch(e.target.value)}
              />
              <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                <option value="0">Any rating</option>
                <option value="5">5 stars</option>
                <option value="4">4+ stars</option>
                <option value="3">3+ stars</option>
                <option value="2">2+ stars</option>
                <option value="1">1+ stars</option>
              </select>
            </div>

            <label className="field-label">Preferred Researcher</label>
            <select value={selectedResearcherId} onChange={(e) => setSelectedResearcherId(e.target.value)}>
              <option value="">Choose a {engagementForm.testerPool} researcher</option>
              {filteredResearchers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} ({r.handle}) • {starText(ratingValue(r))} ({ratingValue(r).toFixed(1)})
                </option>
              ))}
            </select>
          </div>
          {filteredResearchers.length === 0 && (
            <EmptyState
              compact
              icon="search"
              title="No researchers match this filter"
              description="Try widening the rating threshold or search using a handle, name, or skill keyword."
            />
          )}

          {selectedResearcherProfile && (
            <div className="profile-box">
              <h3>{selectedResearcherProfile.fullName}</h3>
              <p><strong>Handle:</strong> {selectedResearcherProfile.handle}</p>
              <p><strong>Email:</strong> {selectedResearcherProfile.email}</p>
              <p><strong>Type:</strong> {selectedResearcherProfile.isInternal ? "Internal" : "External"}</p>
              <div className="badge-stack">
                <StatusBadge status={selectedResearcherProfile.status} small />
                <span className={`pill ${selectedResearcherProfile.isInternal ? "internal" : "external"} small`}>
                  {selectedResearcherProfile.isInternal ? "Internal" : "External"}
                </span>
              </div>
              <p><strong>Skills:</strong> {selectedResearcherProfile.skills || "Not specified"}</p>
              <p>
                <strong>Average Rating:</strong> {starText(ratingValue(selectedResearcherProfile))} ({ratingValue(selectedResearcherProfile).toFixed(1)}/5 from {selectedResearcherProfile.ratingCount || 0} rating(s))
              </p>
              <p><strong>Completed Programs:</strong> {selectedResearcherProfile.completedPrograms || 0}</p>
              <div className="rating-row">
                <select value={ratingStars} onChange={(e) => setRatingStars(Number(e.target.value))} disabled={ratingLocked}>
                <option value="0">Rate this researcher</option>
                  <option value="1">1 star</option>
                  <option value="2">2 stars</option>
                  <option value="3">3 stars</option>
                  <option value="4">4 stars</option>
                  <option value="5">5 stars</option>
                </select>
                <button type="button" onClick={submitResearcherRating} disabled={ratingLocked}>Save Rating</button>
              </div>
              <textarea
                rows={2}
                placeholder="Rating note (optional)"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                disabled={ratingLocked}
              />
              {ratingLocked && (
                <p className="field-note">Rating unlocks after this researcher completes at least one closed program.</p>
              )}
            </div>
          )}

          <div className="form-block">
            <p className="form-block-title">Schedule, Budget, and SLA</p>
            <div className="triple">
              <div>
                <label className="field-label">Deadline</label>
                <input
                  type="date"
                  value={engagementForm.deadline}
                  onChange={(e) => setEngagementForm({ ...engagementForm, deadline: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Bounty Budget (ETB) *</label>
                <input
                  type="number"
                  placeholder="e.g. 75000"
                  min="100"
                  value={engagementForm.budget}
                  onChange={(e) => setEngagementForm({ ...engagementForm, budget: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Triage SLA (hours)</label>
                <input
                  type="number"
                  placeholder="e.g. 48"
                  min="1"
                  value={engagementForm.triageSlaHours}
                  onChange={(e) => setEngagementForm({ ...engagementForm, triageSlaHours: e.target.value })}
                />
                <p className="helper-text">How quickly newly submitted findings should be triaged.</p>
              </div>
            </div>
          </div>
          {createErrors.deadline && <p className="field-error">{createErrors.deadline}</p>}
          {createErrors.budget && <p className="field-error">{createErrors.budget}</p>}
          {createErrors.triageSlaHours && <p className="field-error">{createErrors.triageSlaHours}</p>}

          <label className="check-row">
            <input type="checkbox" checked={startActive} onChange={(e) => setStartActive(e.target.checked)} />
            Start program as active
          </label>
          <label className="field-label">In-Scope Assets And Rules *</label>
          <textarea
            rows={3}
            placeholder="List endpoints, mobile app areas, and testing constraints."
            value={engagementForm.scope}
            onChange={(e) => setEngagementForm({ ...engagementForm, scope: e.target.value })}
          />
          {createErrors.scope && <p className="field-error">{createErrors.scope}</p>}

          <label className="field-label">Out-Of-Scope Constraints</label>
          <textarea
            rows={2}
            placeholder="Explicitly list prohibited systems, time windows, or techniques."
            value={engagementForm.outOfScope}
            onChange={(e) => setEngagementForm({ ...engagementForm, outOfScope: e.target.value })}
          />
          {createActionError && <p className="action-error">{createActionError}</p>}
          <button onClick={createEngagement}>Create a Program</button>
        </article>

        <article className="card">
          <h2>Programs</h2>
          <p className="section-intro">
            Track every active and closed engagement with status controls and direct report access.
          </p>
          <div className="mini-kpi-row">
            <div className="mini-kpi">
              <span>Open</span>
              <strong>{openEngagements.length}</strong>
            </div>
            <div className="mini-kpi">
              <span>Closed</span>
              <strong>{closedEngagements.length}</strong>
            </div>
            <div className="mini-kpi">
              <span>Total Findings</span>
              <strong>{metrics.findingsTotal || 0}</strong>
            </div>
          </div>
          <div className="list">
            {engagements.map((e) => (
              <div key={e.id} className="program">
                <div>
                  <strong>{e.title}</strong>
                  <div className="badge-stack">
                    <StatusBadge status={e.status} />
                    <span className={`pill ${e.testerPool === "internal" ? "internal" : "external"}`}>
                      {formatPortalLabel(e.testerPool)}
                    </span>
                  </div>
                  <p>{e.type} • {e.mode.replace("_", " ")} • {formatPortalLabel(e.testerPool)}</p>
                  <p>{e.target} • deadline {e.deadline || "not set"} • bounty {e.budget} ETB</p>
                </div>
                <div className="row-actions">
                  <label className="field-label">Program Status</label>
                  <select value={e.status} onChange={(ev) => updateEngagementStatus(e.id, ev.target.value)}>
                    {engagementStatuses.map((s) => (
                      <option key={s} value={s}>{formatPortalLabel(s)}</option>
                    ))}
                  </select>
                  <button className="ghost" onClick={() => exportReport(e.id, e.title)}>Export Report</button>
                  <button className="ghost" onClick={() => openFindingsForProgram(e.id)}>View Findings</button>
                </div>
              </div>
            ))}
            {engagements.length === 0 && (
              <EmptyState
                icon="shield"
                title="No programs have been created yet"
                description="Start your first penetration testing program to onboard researchers, define scope, and begin triage tracking."
              />
            )}
          </div>
        </article>
      </section>
    );
  } else if (route.startsWith(ROUTES.ASSIGNMENTS)) {
    content = (
      <section className="grid two">
        <article className="card">
          <h2>External Assignment</h2>
          <p className="section-intro">
            Assign vetted crowd researchers to active external programs in one flow.
          </p>
          <div className="mini-kpi-row">
            <div className="mini-kpi">
              <span>External Programs</span>
              <strong>{externalEngagements.length}</strong>
            </div>
            <div className="mini-kpi">
              <span>Available Researchers</span>
              <strong>{assignmentResearchers.length}</strong>
            </div>
          </div>
          <label className="field-label">External Program</label>
          <select value={externalEngagementId} onChange={(e) => setExternalEngagementId(e.target.value)}>
            <option value="">Choose an external program</option>
            {externalEngagements.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <div className="filter-row">
            <input placeholder="Search researchers by name or handle" value={researcherSearch} onChange={(e) => setResearcherSearch(e.target.value)} />
            <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
              <option value="0">Any rating</option>
              <option value="5">5 stars</option>
              <option value="4">4+ stars</option>
              <option value="3">3+ stars</option>
              <option value="2">2+ stars</option>
              <option value="1">1+ stars</option>
            </select>
          </div>
          <label className="field-label">External Researcher</label>
          <select value={externalResearcherId} onChange={(e) => setExternalResearcherId(e.target.value)}>
            <option value="">Choose an external researcher</option>
            {assignmentResearchers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName} ({r.handle}) • {starText(ratingValue(r))} ({ratingValue(r).toFixed(1)})
              </option>
            ))}
          </select>
          <button onClick={assignExternal}>Assign External Researcher</button>

          {selectedExternalResearcherProfile && (
            <div className="profile-box">
              <h3>{selectedExternalResearcherProfile.fullName}</h3>
              <p><strong>Handle:</strong> {selectedExternalResearcherProfile.handle}</p>
              <p><strong>Email:</strong> {selectedExternalResearcherProfile.email}</p>
              <div className="badge-stack">
                <StatusBadge status={selectedExternalResearcherProfile.status} small />
                <span className="pill external small">External</span>
              </div>
              <p><strong>Skills:</strong> {selectedExternalResearcherProfile.skills || "Not specified"}</p>
              <p><strong>Average Rating:</strong> {starText(ratingValue(selectedExternalResearcherProfile))} ({ratingValue(selectedExternalResearcherProfile).toFixed(1)}/5 from {selectedExternalResearcherProfile.ratingCount || 0} rating(s))</p>
            </div>
          )}
        </article>

        <article className="card">
          <h2>Internal Assignment Request</h2>
          <p className="section-intro">
            Request internal security team support and monitor request lifecycle.
          </p>
          <div className="mini-kpi-row">
            <div className="mini-kpi">
              <span>Internal Programs</span>
              <strong>{internalEngagements.length}</strong>
            </div>
            <div className="mini-kpi">
              <span>Open Requests</span>
              <strong>{internalRequests.filter((req) => req.status !== "assigned").length}</strong>
            </div>
          </div>
          <label className="field-label">Internal Program</label>
          <select value={internalEngagementId} onChange={(e) => setInternalEngagementId(e.target.value)}>
            <option value="">Choose an internal program</option>
            {internalEngagements.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <button onClick={requestInternal}>Request Internal Assignment</button>

          <h3 className="subhead">Request Status</h3>
          <div className="list compact">
            {internalRequests.map((req) => (
              <div key={req.id} className="list-row">
                <div>
                  <strong>{req.engagementName}</strong>
                  <div className="badge-stack">
                    <StatusBadge status={req.status} />
                  </div>
                  <p>Assigned: {req.assignedResearcher || "Not assigned yet"}</p>
                </div>
              </div>
            ))}
            {internalRequests.length === 0 && (
              <EmptyState
                compact
                icon="users"
                title="No internal requests are waiting"
                description="When you ask for internal researcher support, requests and assignment progress will appear here."
              />
            )}
          </div>
        </article>
      </section>
    );
  } else if (insightRoutes.has(route)) {
    const insightTitleMap = {
      [ROUTES.OPEN_PROGRAMS]: "Open Programs",
      [ROUTES.CLOSED_PROGRAMS]: "Closed Programs",
      [ROUTES.FINDINGS]: "Findings",
      [ROUTES.FINDINGS_TOTAL]: "Findings Total",
      [ROUTES.SLA_BREACHES]: "SLA Breaches",
      [ROUTES.MTTA]: "MTTA (Hours)",
      [ROUTES.MTTR]: "MTTR (Hours)",
    };

    let rows = [];
    let headlineValue = 0;
    let headlineSuffix = "";

    if (route === ROUTES.OPEN_PROGRAMS) {
      rows = openEngagements.map((e) => ({
        key: e.id,
        title: e.title,
        sub: `${e.type} • ${e.testerPool}`,
        status: e.status,
        meta: `Deadline: ${e.deadline} • Bounty: ${e.budget} ETB`,
      }));
      headlineValue = openEngagements.length;
    } else if (route === ROUTES.CLOSED_PROGRAMS) {
      rows = closedEngagements.map((e) => ({
        key: e.id,
        title: e.title,
        sub: `${e.type} • ${e.testerPool}`,
        meta: `Closed program • Deadline: ${e.deadline} • Bounty: ${e.budget} ETB`,
      }));
      headlineValue = closedEngagements.length;
    } else if (route === ROUTES.FINDINGS || route === ROUTES.FINDINGS_TOTAL) {
      rows = visibleFindings.map((f) => ({
        key: f.id,
        title: f.title,
        sub: f.jobTitle,
        severity: f.severity,
        status: f.status,
        meta: `Asset: ${f.assetPath || "No asset path"}`,
      }));
      headlineValue = visibleFindings.length;
    } else if (route === ROUTES.SLA_BREACHES) {
      const breached = visibleFindings.filter((f) => f.slaBreached);
      rows = breached.map((f) => ({
        key: f.id,
        title: f.title,
        sub: f.jobTitle,
        severity: f.severity,
        status: f.status,
        meta: `SLA due: ${f.slaDueAt || "n/a"}`,
      }));
      headlineValue = breached.length;
    } else if (route === ROUTES.MTTA) {
      rows = visibleFindings.map((f) => ({
        key: f.id,
        title: f.title,
        sub: f.jobTitle,
        severity: f.severity,
        status: f.status,
        meta: "Triaged metric is aggregated from backend /api/metrics",
      }));
      headlineValue = Number(metrics.mttaHours || 0).toFixed(1);
      headlineSuffix = " hrs";
    } else if (route === ROUTES.MTTR) {
      rows = visibleFindings.map((f) => ({
        key: f.id,
        title: f.title,
        sub: f.jobTitle,
        severity: f.severity,
        status: f.status,
        meta: "Resolution metric is aggregated from backend /api/metrics",
      }));
      headlineValue = Number(metrics.mttrHours || 0).toFixed(1);
      headlineSuffix = " hrs";
    }

    content = (
      <section className="grid two">
        <article className="card">
          <h2>{insightTitleMap[route]}</h2>
          <p className="muted">Operational drill-down connected to service APIs.</p>
          <p className="stat">{headlineValue}{headlineSuffix}</p>

          {(route === ROUTES.FINDINGS || route === ROUTES.FINDINGS_TOTAL || route === ROUTES.SLA_BREACHES || route === ROUTES.MTTA || route === ROUTES.MTTR) && (
            <div className="inline-controls">
              <select value={findingsProgramId} onChange={(e) => setFindingsProgramId(e.target.value)}>
                <option value="">All programs</option>
                {engagements.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
              <button className="ghost" type="button" onClick={() => setFindingsProgramId("")}>Clear Filter</button>
            </div>
          )}

          <button className="ghost" type="button" onClick={() => navigate(ROUTES.HOME)}>Back To Dashboard</button>
        </article>

        <article className="card">
          <h2>Details</h2>
          <div className="list compact">
            {rows.map((row) => (
              <div key={row.key} className="list-row">
                <div>
                  <strong>{row.title}</strong>
                  <p>{row.sub}</p>
                  <div className="badge-stack">
                    {row.severity ? <SeverityBadge severity={row.severity} /> : null}
                    {row.status ? <StatusBadge status={row.status} /> : null}
                  </div>
                  <p>{row.meta}</p>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <EmptyState
                compact
                icon="spark"
                title="No records available for this view"
                description="Change the filter or create more program activity to populate this drill-down."
              />
            )}
          </div>
        </article>
      </section>
    );
  } else {
    content = (
      <>
        <section className="grid four kpi-grid">
          <button type="button" className="card card-link" onClick={() => navigate(ROUTES.OPEN_PROGRAMS)}>
            <h3>Open Programs</h3>
            <p className="stat">{stats.openEngagements}</p>
          </button>
          <button type="button" className="card card-link" onClick={() => navigate(ROUTES.FINDINGS)}>
            <h3>High/Critical Findings</h3>
            <p className="stat">{stats.highCriticalFindings}</p>
          </button>
          <button type="button" className="card card-link" onClick={() => navigate(ROUTES.SLA_BREACHES)}>
            <h3>SLA Breaches</h3>
            <p className="stat">{metrics.slaBreached || 0}</p>
          </button>
          <button type="button" className="card card-link" onClick={() => navigate(ROUTES.MTTA)}>
            <h3>MTTA (hours)</h3>
            <p className="stat">{Number(metrics.mttaHours || 0).toFixed(1)}</p>
          </button>
        </section>

        <section className="mini-kpi-row">
          <article className="mini-kpi">
            <span>Closed Programs</span>
            <strong>{metrics.closedPrograms || 0}</strong>
          </article>
          <article className="mini-kpi">
            <span>Total Findings</span>
            <strong>{metrics.findingsTotal || 0}</strong>
          </article>
          <article className="mini-kpi">
            <span>Ready For Retest</span>
            <strong>{stats.readyForRetest || 0}</strong>
          </article>
          <article className="mini-kpi">
            <span>Internal Active</span>
            <strong>{stats.internalResearchersActive || 0}</strong>
          </article>
          <article className="mini-kpi">
            <span>External Active</span>
            <strong>{stats.externalResearchersActive || 0}</strong>
          </article>
          <article className="mini-kpi">
            <span>MTTR (hours)</span>
            <strong>{Number(metrics.mttrHours || 0).toFixed(1)}</strong>
          </article>
        </section>

        <section className="grid four">
          <article className="card compact-card">
            <h3>Critical Findings</h3>
            <p className="stat">{Number(metrics.severityMix?.critical || 0)}</p>
            <p className="muted">Immediate attention required</p>
          </article>
          <article className="card compact-card">
            <h3>High Findings</h3>
            <p className="stat">{Number(metrics.severityMix?.high || 0)}</p>
            <p className="muted">Prioritized in triage queue</p>
          </article>
          <article className="card compact-card">
            <h3>Medium Findings</h3>
            <p className="stat">{Number(metrics.severityMix?.medium || 0)}</p>
            <p className="muted">Scheduled remediation stream</p>
          </article>
          <article className="card compact-card">
            <h3>Low/Info Findings</h3>
            <p className="stat">{Number(metrics.severityMix?.low || 0) + Number(metrics.severityMix?.informational || 0)}</p>
            <p className="muted">Hardening and hygiene tasks</p>
          </article>
        </section>

        <section className="grid two">
          <article className="card">
            <h2>Reports & Analytics</h2>
            <p className="section-intro">Download structured reports and use them in weekly security operations reviews.</p>
            <select value={reportProgramId} onChange={(e) => setReportProgramId(e.target.value)}>
              <option value="">Choose a program</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
            <button onClick={viewReport}>View Report (CSV)</button>
          </article>

          <article className="card">
            <h2>Program Health</h2>
            <p className="section-intro">At-a-glance operational health for triage and remediation performance.</p>
            <div className="health-grid">
              <button type="button" className="health-tile" onClick={() => navigate(ROUTES.OPEN_PROGRAMS)}>
                <span>Open Programs</span>
                <strong>{metrics.openPrograms || 0}</strong>
              </button>
              <button type="button" className="health-tile" onClick={() => navigate(ROUTES.CLOSED_PROGRAMS)}>
                <span>Closed Programs</span>
                <strong>{metrics.closedPrograms || 0}</strong>
              </button>
              <button type="button" className="health-tile" onClick={() => navigate(ROUTES.FINDINGS_TOTAL)}>
                <span>Findings Total</span>
                <strong>{metrics.findingsTotal || 0}</strong>
              </button>
              <button type="button" className="health-tile" onClick={() => navigate(ROUTES.MTTR)}>
                <span>MTTR (hours)</span>
                <strong>{Number(metrics.mttrHours || 0).toFixed(1)}</strong>
              </button>
            </div>
            <h3 className="subhead">Severity Distribution</h3>
            <div className="badge-stack">
              <span className="metric-pill"><SeverityBadge severity="critical" small /> {Number(metrics.severityMix?.critical || 0)}</span>
              <span className="metric-pill"><SeverityBadge severity="high" small /> {Number(metrics.severityMix?.high || 0)}</span>
              <span className="metric-pill"><SeverityBadge severity="medium" small /> {Number(metrics.severityMix?.medium || 0)}</span>
              <span className="metric-pill"><SeverityBadge severity="low" small /> {Number(metrics.severityMix?.low || 0)}</span>
              <span className="metric-pill"><SeverityBadge severity="informational" small /> {Number(metrics.severityMix?.informational || 0)}</span>
            </div>
          </article>
        </section>

        <section className="grid two">
          <article className="card">
            <h2>Authorize Payout</h2>
            <p className="section-intro">Approve bounty payouts for validated findings and maintain payment references.</p>
            <div className="mini-kpi-row">
              <div className="mini-kpi">
                <span>Pending Payouts</span>
                <strong>{payoutTotals.pendingCount}</strong>
              </div>
              <div className="mini-kpi">
                <span>Pending (ETB)</span>
                <strong>{Number(payoutTotals.pendingAmount || 0).toLocaleString()}</strong>
              </div>
              <div className="mini-kpi">
                <span>Authorized (ETB)</span>
                <strong>{Number(payoutTotals.authorizedAmount || 0).toLocaleString()}</strong>
              </div>
            </div>
            <select value={payoutForm.programId} onChange={(e) => setPayoutForm({ ...payoutForm, programId: e.target.value })}>
              <option value="">Choose a program</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({formatProgramStatus(e.status)})
                </option>
              ))}
            </select>
            <div>
              <strong>Payout Amount (ETB)</strong>
              <input
                type="number"
                placeholder="e.g. 12000"
                min="1"
                value={payoutForm.amount}
                onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
              />
            </div>
            <input placeholder="Reference (optional)" value={payoutForm.reference} onChange={(e) => setPayoutForm({ ...payoutForm, reference: e.target.value })} />
            {payoutError && <p className="action-error">{payoutError}</p>}
            <button onClick={authorizePayout}>Authorize Payout</button>
          </article>

          <article className="card">
            <h2>Invite Researchers</h2>
            <p className="section-intro">Invite internal or external researchers from approved profiles.</p>
            <div className="mini-kpi-row">
              <div className="mini-kpi">
                <span>Matching Profiles</span>
                <strong>{inviteResearchers.length}</strong>
              </div>
              <div className="mini-kpi">
                <span>Open Programs</span>
                <strong>{openEngagements.length}</strong>
              </div>
            </div>
            <input
              placeholder="Search researchers"
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
            />
            <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value, researcherId: "" })}>
              <option value="researcher_internal">Internal Researcher</option>
              <option value="researcher_external">External Researcher</option>
            </select>
            <select value={inviteForm.researcherId} onChange={(e) => setInviteForm({ ...inviteForm, researcherId: e.target.value })}>
              <option value="">Choose a researcher</option>
              {inviteResearchers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} ({r.handle}) • {r.email}
                </option>
              ))}
            </select>
            <select value={inviteForm.engagementId} onChange={(e) => setInviteForm({ ...inviteForm, engagementId: e.target.value })}>
              <option value="">Choose a program</option>
              {openEngagements.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
            {selectedInviteResearcher ? (
              <div className="profile-box">
                <h3>{selectedInviteResearcher.fullName}</h3>
                <p><strong>Handle:</strong> {selectedInviteResearcher.handle}</p>
                <p><strong>Email:</strong> {selectedInviteResearcher.email}</p>
                <p><strong>Skills:</strong> {selectedInviteResearcher.skills || "Not specified"}</p>
                <div className="badge-stack">
                  <StatusBadge status={selectedInviteResearcher.status} small />
                  <span className={`pill ${selectedInviteResearcher.isInternal ? "internal" : "external"} small`}>
                    {selectedInviteResearcher.isInternal ? "Internal" : "External"}
                  </span>
                  <span className="metric-pill">{ratingValue(selectedInviteResearcher).toFixed(1)} stars</span>
                </div>
              </div>
            ) : null}
            {inviteResearchers.length === 0 && (
              <EmptyState
                compact
                icon="search"
                title="No researchers match this invitation filter"
                description="Try switching the pool or refining the search phrase to find the right profile."
              />
            )}
            {inviteError && <p className="action-error">{inviteError}</p>}
            <button onClick={inviteResearcher}>Send Invite</button>
          </article>
        </section>

        <section className="grid two">
          <FindingReviewBoard
            title="Finding Review & Approval"
            findings={findings}
            onUpdateFinding={updateFindingReview}
            successMessage={(status, finding, actionForm) => {
              if (status === "accepted") return `Accepted ${finding.title}${actionForm.bounty ? ` with ${actionForm.bounty} ETB bounty.` : "."}`;
              if (status === "paid") return `Marked ${finding.title} as paid.`;
              if (status === "retesting") return `Requested retest for ${finding.title}.`;
              if (status === "rejected") return `Rejected ${finding.title}.`;
              return `Updated ${finding.title}.`;
            }}
          />

          <article className="card">
            <h2>Notifications</h2>
            <p className="section-intro">Latest program and triage activity for this organization workspace.</p>
            <div className="list compact">
              {notifications.map((n) => (
                <div key={n.id} className={`list-row ${n.read ? "" : "unread"}`}>
                  <div>
                    <strong>{n.title}</strong>
                    <div className="badge-stack">
                      <StatusBadge status={n.read ? "read" : "unread"} small />
                    </div>
                    <p>{n.message}</p>
                    <p>{n.createdAt}</p>
                  </div>
                  {!n.read && <button className="ghost" onClick={() => markRead(n.id)}>Mark read</button>}
                </div>
              ))}
              {notifications.length === 0 && (
                <EmptyState
                  compact
                  icon="inbox"
                  title="No notifications yet"
                  description="Program updates, assignment actions, and review events will appear here as they happen."
                />
              )}
            </div>
          </article>
        </section>

        <section className="grid two">
          <article className="card">
            <h2>Create A Program</h2>
            <p className="muted">Start a new pentest program with internal or external researchers.</p>
            <button onClick={() => navigate(ROUTES.ENGAGEMENTS)}>Create a Program</button>
          </article>
        </section>
      </>
    );
  }

  const activeLinkStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "none",
    transition: "all 0.2s",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    color: "#f59e0b",
    borderLeft: "3px solid #f59e0b"
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
    transition: "all 0.2s",
    color: "#94a3b8",
    borderLeft: "3px solid transparent"
  };

  return (
    <div className="app-shell" style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "Inter, -apple-system, sans-serif" }}>
      <aside style={{ position: "sticky", top: 0, height: "100vh", background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #334155" }}>
          <a href={`#${ROUTES.HOME}`} style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
            <span style={{ color: "#f59e0b", fontWeight: "800", fontSize: "1.25rem", letterSpacing: "-0.025em" }}>AntCrowd</span>
          </a>
          <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#64748b", margin: "4px 0 0 0" }}>PENTEST</p>
        </div>
        <nav style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <a href={`#${ROUTES.HOME}`} style={route === ROUTES.HOME ? activeLinkStyle : inactiveLinkStyle}>
            <span style={{ fontSize: "16px" }}>📊</span> Dashboard
          </a>
          <a href={`#${ROUTES.ENGAGEMENTS}`} style={route.startsWith(ROUTES.ENGAGEMENTS) ? activeLinkStyle : inactiveLinkStyle}>
            <span style={{ fontSize: "16px" }}>📁</span> Programs
          </a>
          <a href={`#${ROUTES.ASSIGNMENTS}`} style={route.startsWith(ROUTES.ASSIGNMENTS) ? activeLinkStyle : inactiveLinkStyle}>
            <span style={{ fontSize: "16px" }}>💼</span> Assignments
          </a>
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid #334155", fontSize: "12px", color: "#64748b" }}>&copy; 2026 AntCrowd</div>
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", overflowX: "hidden" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 20, height: "60px", borderBottom: "1px solid #334155", backgroundColor: "#1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", margin: 0 }}>Organization &mdash; Penetration Testing Service</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              type="button"
              className="notification-pill"
              onClick={() => navigate(ROUTES.HOME)}
              aria-label="Open notifications"
              style={{ background: "transparent", border: "none", cursor: "pointer", position: "relative" }}
            >
              <span className="notification-pill-icon" aria-hidden="true" style={{ color: "#94a3b8" }}>
                <svg viewBox="0 0 24 24" style={{ width: "20px", height: "20px", fill: "currentColor" }}>
                  <path d="M12 3.75a4.75 4.75 0 0 0-4.75 4.75v1.1c0 1.1-.36 2.17-1.02 3.05L4.7 14.7a1 1 0 0 0 .8 1.6h13a1 1 0 0 0 .8-1.6l-1.53-2.05a5.08 5.08 0 0 1-1.02-3.05V8.5A4.75 4.75 0 0 0 12 3.75Zm0 17a2.5 2.5 0 0 0 2.33-1.6H9.67A2.5 2.5 0 0 0 12 20.75Z" />
                </svg>
              </span>
              {notifications.filter((n) => !n.read).length > 0 && (
                <span style={{ position: "absolute", top: "-2px", right: "-2px", display: "grid", placeItems: "center", width: "16px", height: "16px", background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: "bold", borderRadius: "50%" }}>
                  {notifications.filter((n) => !n.read).length > 99 ? "99+" : notifications.filter((n) => !n.read).length}
                </span>
              )}
            </button>
            <span className="user-pill" style={{ fontSize: "14px", fontWeight: "500", color: "#f1f5f9" }}>{user?.fullName} ({formatPortalLabel(user?.role)})</span>
            <button className="demo-btn" onClick={logout} style={{ padding: "8px 16px", background: "#334155", color: "#f1f5f9", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "background 0.2s" }}>Logout</button>
          </div>
        </header>

        <main style={{ flex: 1, width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
          {loading && <div className="notice muted">Loading service data...</div>}
          {error && <div className="notice error">{error}</div>}
          {info && <div className="notice success">{info}</div>}

          <section className="hero-shell" style={{ border: "1px solid #334155", background: "linear-gradient(to bottom right, rgba(245, 158, 11, 0.03), #1e293b, #0f172a)", borderRadius: "16px", padding: "32px" }}>
            <div className="hero-copy">
              <p className="hero-kicker" style={{ fontSize: "10px", fontWeight: "bold", uppercase: "true", letterSpacing: "0.22em", textTransform: "uppercase", color: "#f59e0b", margin: 0 }}>AntCrowd Organization Workspace</p>
              <h1 style={{ fontSize: "2.25rem", fontWeight: "800", color: "#ffffff", margin: "12px 0 8px 0" }}>{hero.title}</h1>
              <p style={{ color: "#94a3b8", fontSize: "1rem", margin: "0 0 20px 0", lineHeight: "1.6" }}>{hero.text}</p>
              <div className="hero-badges" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button type="button" className="badge-link" onClick={() => navigate(ROUTES.OPEN_PROGRAMS)}>
                  Open Programs: {stats.openEngagements}
                </button>
                <button type="button" className="badge-link" onClick={() => navigate(ROUTES.FINDINGS)}>
                  Findings: {metrics.findingsTotal || 0}
                </button>
                <button type="button" className="badge-link" onClick={() => navigate(ROUTES.SLA_BREACHES)}>
                  SLA Breaches: {metrics.slaBreached || 0}
                </button>
              </div>
            </div>
          </section>

          {content}
        </main>
      </div>
    </div>
  );
}
