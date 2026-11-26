import { useMemo, useState } from "react";
import { adminApi } from "../services/api";
import { authAdminApi } from "../services/authAdminApi";

const emptyInternalResearcher = {
  fullName: "",
  email: "",
  notes: "",
};

const emptyOverview = {
  researchers: [],
  verifications: [],
  organizations: 0,
  organizationApprovals: [],
};

export const adminStages = [
  {
    title: "Internal Researcher Onboarding",
    detail: "Create internal identities with skills and organization mapping.",
  },
  {
    title: "Assignment Governance",
    detail: "Review org requests and assign internal researchers with accountability.",
  },
  {
    title: "Quality Oversight",
    detail: "Track triage latency, severity mix, and breach trends across programs.",
  },
  {
    title: "Identity Approvals",
    detail: "Approve researcher verification submissions and organization onboarding before access is unlocked.",
  },
];

function normalizePenAdmin(user) {
  if (!user) return null;
  return user.user || user.admin || user;
}

export function useAdminPortal() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [tokenReady, setTokenReady] = useState(!!adminApi.getToken());
  const [loginForm, setLoginForm] = useState({ email: "platform-admin@antcrowd.local", password: "Antcrowd123!" });
  const [user, setUser] = useState(null);

  const [dashboard, setDashboard] = useState({ openEngagements: 0, highCriticalFindings: 0, readyForRetest: 0, internalResearchersActive: 0, externalResearchersActive: 0 });
  const [metrics, setMetrics] = useState({ findingsTotal: 0, slaBreached: 0, openPrograms: 0, closedPrograms: 0, mttaHours: 0, mttrHours: 0, severityMix: {} });
  const [researchers, setResearchers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [internalRequests, setInternalRequests] = useState([]);
  const [findings, setFindings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [researcherForm, setResearcherForm] = useState(emptyInternalResearcher);
  const [inviteLink, setInviteLink] = useState("");
  const [adminAssigneeByRequest, setAdminAssigneeByRequest] = useState({});
  const [authOverview, setAuthOverview] = useState(emptyOverview);
  const [researcherVerificationQueue, setResearcherVerificationQueue] = useState([]);
  const [organizationApprovalQueue, setOrganizationApprovalQueue] = useState([]);

  const internalResearchers = useMemo(() => researchers.filter((item) => item.isInternal), [researchers]);
  const pendingInternalRequests = useMemo(() => internalRequests.filter((item) => item.status !== "assigned"), [internalRequests]);
  const pendingResearcherApprovals = useMemo(
    () => researcherVerificationQueue.filter((item) => ["submitted", "pending_submission", "rejected"].includes(String(item?.verification?.status || "").toLowerCase())),
    [researcherVerificationQueue],
  );
  const pendingOrganizationApprovals = useMemo(
    () => organizationApprovalQueue.filter((item) => !["approved", "not_required"].includes(String(item.approvalStatus || item.ownerApprovalStatus || "").toLowerCase())),
    [organizationApprovalQueue],
  );

  const workspaceSummary = useMemo(() => {
    const normalizedFindings = findings || [];
    const unresolvedFindings = normalizedFindings.filter((item) => !["resolved", "paid", "rejected"].includes(String(item.status || "").toLowerCase()));
    const reviewQueue = normalizedFindings.filter((item) => ["new", "triaged", "retesting"].includes(String(item.status || "").toLowerCase())).length;
    const payoutQueue = normalizedFindings.filter((item) => String(item.status || "").toLowerCase() === "accepted").length;
    const highCriticalOpen = unresolvedFindings.filter((item) => ["high", "critical"].includes(String(item.severity || "").toLowerCase())).length;
    return {
      pendingAssignments: pendingInternalRequests.length,
      reviewQueue,
      payoutQueue,
      highCriticalOpen,
      unreadNotifications: notifications.filter((item) => !item.read).length,
      pendingResearcherApprovals: pendingResearcherApprovals.length,
      pendingOrganizationApprovals: pendingOrganizationApprovals.length,
    };
  }, [findings, notifications, pendingInternalRequests.length, pendingOrganizationApprovals.length, pendingResearcherApprovals.length]);

  async function bootstrap() {
    setLoading(true);
    setError("");
    try {
      const [penMeRaw, authMeRaw] = await Promise.all([adminApi.me(), authAdminApi.me()]);
      const penMe = normalizePenAdmin(penMeRaw);
      const authMe = authMeRaw?.user || null;

      if (!penMe) {
        throw new Error("Unable to load admin account.");
      }
      if (!authMe || authMe.accountType !== "platform_admin") {
        throw new Error("Use platform admin account for this portal.");
      }

      setUser({
        ...penMe,
        email: authMe.email || penMe.email,
        fullName: `${authMe.firstName || ""} ${authMe.lastName || ""}`.trim() || penMe.fullName || penMe.name || "Platform Admin",
        role: "platform_admin",
      });
      await loadAll();
    } catch (e) {
      adminApi.setToken("");
      setTokenReady(false);
      setUser(null);
      setError(e.message || "Session expired.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAll() {
    const [d, m, r, reqs, findingData, notes, orgs, overviewData, researcherQueueData, organizationQueueData] = await Promise.all([
      adminApi.getDashboard(),
      adminApi.getMetrics(),
      adminApi.getResearchers(),
      adminApi.getInternalRequests(),
      adminApi.getFindings(),
      adminApi.getNotifications(),
      adminApi.getOrganizations(),
      authAdminApi.getPlatformOverview(),
      authAdminApi.listResearcherVerifications(),
      authAdminApi.listPlatformOrganizations(),
    ]);
    const normalizedOrgs = orgs || [];
    setDashboard(d);
    setMetrics(m);
    setResearchers(r || []);
    setInternalRequests(reqs || []);
    setFindings(findingData || []);
    setNotifications(notes || []);
    setOrganizations(normalizedOrgs);
    setAuthOverview(overviewData || emptyOverview);
    setResearcherVerificationQueue(researcherQueueData?.queue || []);
    setOrganizationApprovalQueue(organizationQueueData?.organizations || []);
  }

  async function login() {
    setError("");
    setInfo("");
    setInviteLink("");
    const email = loginForm.email.trim().toLowerCase();
    const password = loginForm.password;

    try {
      await authAdminApi.bootstrapCsrf();
      await authAdminApi.login(email, password, true);
      const penResponse = await adminApi.bootstrapFromSession();
      adminApi.setToken(penResponse?.access_token || penResponse?.token || "");
      if (!adminApi.getToken()) {
        throw new Error("Unable to establish admin workspace session.");
      }
      setTokenReady(true);
      setInfo("Logged in successfully.");
    } catch (e) {
      adminApi.setToken("");
      setTokenReady(false);
      setError(e.message || "Login failed");
    }
  }

  function logout() {
    adminApi.setToken("");
    setTokenReady(false);
    setUser(null);
    setInviteLink("");
    setAuthOverview(emptyOverview);
    setResearcherVerificationQueue([]);
    setOrganizationApprovalQueue([]);
    setInfo("Logged out.");
    void authAdminApi.logout().catch(() => null).finally(() => {
      const mainAppLoginUrl = (import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173").replace(/\/$/, "") + "/login";
      window.location.assign(mainAppLoginUrl);
    });
  }

  async function createInternalResearcher() {
    setError("");
    setInfo("");
    setInviteLink("");

    if (!researcherForm.fullName || !researcherForm.email) {
      setError("fullName and email are required.");
      return;
    }

    try {
      const response = await authAdminApi.createResearcherInvitation({
        email: researcherForm.email.trim().toLowerCase(),
        fullName: researcherForm.fullName.trim(),
        researcherType: "internal",
        notes: researcherForm.notes.trim(),
      });

      setResearcherForm(emptyInternalResearcher);
      setInviteLink(response?.inviteLink || "");
      setInfo(response?.message || "Internal researcher invitation sent.");
      await loadAll();
    } catch (e) {
      setError(e.message || "Failed to create internal researcher");
    }
  }

  async function assignInternal(requestId) {
    const researcherId = adminAssigneeByRequest[requestId] || internalResearchers[0]?.id;
    if (!researcherId) return setError("Select internal researcher first.");
    if (!window.confirm("Assign selected internal researcher?")) return;
    try {
      await adminApi.assignInternalRequest(requestId, Number(researcherId));
      setInfo("Internal researcher assigned.");
      await loadAll();
    } catch (e) {
      setError(e.message || "Assignment failed");
    }
  }

  async function reviewResearcherVerificationDecision(userId, status, reviewerNotes = "") {
    setError("");
    setInfo("");
    try {
      const response = await authAdminApi.reviewResearcherVerification(userId, status, reviewerNotes);
      setInfo(response?.message || "Researcher review updated.");
      await loadAll();
    } catch (e) {
      setError(e.message || "Failed to update researcher review.");
    }
  }

  async function reviewOrganizationApprovalDecision(organizationId, status, reviewerNotes = "") {
    setError("");
    setInfo("");
    try {
      const response = await authAdminApi.reviewOrganizationApproval(organizationId, status, reviewerNotes);
      setInfo(response?.message || "Organization review updated.");
      await loadAll();
    } catch (e) {
      setError(e.message || "Failed to update organization review.");
    }
  }

  async function markRead(id) {
    try {
      await adminApi.markNotificationRead(id);
      setNotifications((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
    } catch {
      // ignore notification mark errors
    }
  }

  async function markAllRead() {
    const unread = notifications.filter((item) => !item.read);
    if (unread.length === 0) return;
    await Promise.all(unread.map((item) => adminApi.markNotificationRead(item.id).catch(() => null)));
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }

  async function updateFindingReview(id, payload, message = "Finding updated.") {
    setError("");
    setInfo("");
    try {
      await adminApi.updateFindingStatus(id, payload.status, payload.duplicateOf || 0, payload.bounty || 0, payload.reviewComment || "", payload.paymentReference || "");
      setInfo(message);
      await loadAll();
    } catch (e) {
      setError(e.message || "Failed to update finding");
    }
  }

  return {
    loading,
    error,
    info,
    tokenReady,
    loginForm,
    user,
    dashboard,
    metrics,
    researchers,
    internalRequests,
    findings,
    notifications,
    organizations,
    researcherForm,
    inviteLink,
    adminAssigneeByRequest,
    internalResearchers,
    pendingInternalRequests,
    workspaceSummary,
    authOverview,
    researcherVerificationQueue,
    organizationApprovalQueue,
    pendingResearcherApprovals,
    pendingOrganizationApprovals,
    setTokenReady,
    setLoginForm,
    setResearcherForm,
    setAdminAssigneeByRequest,
    setLoading,
    bootstrap,
    loadAll,
    login,
    logout,
    createInternalResearcher,
    assignInternal,
    reviewResearcherVerificationDecision,
    reviewOrganizationApprovalDecision,
    markRead,
    markAllRead,
    updateFindingReview,
  };
}
