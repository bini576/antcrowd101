import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthGate from "../components/AuthGate";
import { useAdminPortal } from "../hooks/useAdminPortal";
import AdminLayout from "../layouts/AdminLayout";
import AiRedteamWorkspacePage from "../pages/AiRedteamWorkspacePage";
import AssignmentsPage from "../pages/AssignmentsPage";
import BugBountyWorkspacePage from "../pages/BugBountyWorkspacePage";
import ChallengeWorkspacePage from "../pages/ChallengeWorkspacePage";
import CodeWorkspacePage from "../pages/CodeWorkspacePage";
import DisputesPage from "../pages/DisputesPage";
import FeedbackInboxPage from "../pages/FeedbackInboxPage";
import ConsolePage from "../pages/ConsolePage";
import TrustWorkspacePage from "../pages/TrustWorkspacePage";
import FindingReviewPage from "../pages/FindingReviewPage";
import LoginPage from "../pages/LoginPage";
import OrganizationsPage from "../pages/OrganizationsPage";
import OversightPage from "../pages/OversightPage";
import PaymentsPage from "../pages/PaymentsPage";
import ResearchersPage from "../pages/ResearchersPage";
import SettingsPage from "../pages/SettingsPage";
import SystemMonitoringPage from "../pages/SystemMonitoringPage";
import TrainingWorkspacePage from "../pages/TrainingWorkspacePage";
import UnifiedDashboardPage from "../pages/UnifiedDashboardPage";
import VdpWorkspacePage from "../pages/VdpWorkspacePage";

export default function AppRoutes() {
  const brandLogo = import.meta.env.VITE_BRAND_LOGO || "/branding/antcrowd-logo.png";
  const [showLogo, setShowLogo] = useState(true);

  const portal = useAdminPortal();

  useEffect(() => {
    if (!portal.tokenReady) {
      portal.setLoading(false);
      return;
    }
    portal.bootstrap();
  }, [portal.tokenReady]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={portal.tokenReady ? "/admin" : "/admin/login"} replace />} />
      <Route
        path="/admin/login"
        element={portal.tokenReady ? <Navigate to="/admin" replace /> : <LoginPage loginForm={portal.loginForm} setLoginForm={portal.setLoginForm} login={portal.login} error={portal.error} />}
      />
      <Route
        path="/admin"
        element={
          <AuthGate tokenReady={portal.tokenReady}>
            <AdminLayout
              brandLogo={brandLogo}
              showLogo={showLogo}
              setShowLogo={setShowLogo}
              user={portal.user}
              logout={portal.logout}
              loading={portal.loading}
              error={portal.error}
              info={portal.info}
              notifications={portal.notifications}
              markRead={portal.markRead}
              markAllRead={portal.markAllRead}
            />
          </AuthGate>
        }
      >
        <Route
          index
          element={
            <UnifiedDashboardPage
              dashboard={portal.dashboard}
              metrics={portal.metrics}
              notifications={portal.notifications}
              findings={portal.findings}
              internalRequests={portal.internalRequests}
              workspaceSummary={portal.workspaceSummary}
              authOverview={portal.authOverview}
              researcherVerificationQueue={portal.researcherVerificationQueue}
              organizationApprovalQueue={portal.organizationApprovalQueue}
            />
          }
        />
        <Route path="pentesting" element={<ConsolePage dashboard={portal.dashboard} metrics={portal.metrics} workspaceSummary={portal.workspaceSummary} />} />
        <Route path="vdp" element={<VdpWorkspacePage />} />
        <Route path="training" element={<TrainingWorkspacePage internalResearchers={portal.internalResearchers} />} />
        <Route path="bug-bounty" element={<BugBountyWorkspacePage />} />
        <Route path="ai-redteam" element={<AiRedteamWorkspacePage />} />
        <Route path="challenges" element={<ChallengeWorkspacePage />} />
        <Route path="code" element={<CodeWorkspacePage />} />
        <Route path="trust" element={<TrustWorkspacePage />} />
        <Route
          path="researchers"
          element={
            <ResearchersPage
              researcherForm={portal.researcherForm}
              setResearcherForm={portal.setResearcherForm}
              createInternalResearcher={portal.createInternalResearcher}
              inviteLink={portal.inviteLink}
              internalResearchers={portal.internalResearchers}
              allResearchers={portal.researchers}
              organizationOptions={portal.organizations}
              verificationQueue={portal.researcherVerificationQueue}
              reviewResearcherVerification={portal.reviewResearcherVerificationDecision}
            />
          }
        />
        <Route
          path="organizations"
          element={
            <OrganizationsPage
              organizations={portal.organizations}
              researchers={portal.researchers}
              internalRequests={portal.internalRequests}
              approvalQueue={portal.organizationApprovalQueue}
              reviewOrganizationApproval={portal.reviewOrganizationApprovalDecision}
            />
          }
        />
        <Route path="payments" element={<PaymentsPage findings={portal.findings} updateFindingReview={portal.updateFindingReview} />} />
        <Route path="reports" element={<OversightPage metrics={portal.metrics} notifications={portal.notifications} markRead={portal.markRead} />} />
        <Route path="settings" element={<SettingsPage showLogo={showLogo} setShowLogo={setShowLogo} loadAll={portal.loadAll} />} />
        <Route path="assignments" element={<AssignmentsPage pendingInternalRequests={portal.pendingInternalRequests} internalResearchers={portal.internalResearchers} internalRequests={portal.internalRequests} adminAssigneeByRequest={portal.adminAssigneeByRequest} setAdminAssigneeByRequest={portal.setAdminAssigneeByRequest} assignInternal={portal.assignInternal} />} />
        <Route path="reviews" element={<FindingReviewPage findings={portal.findings} updateFindingReview={portal.updateFindingReview} />} />
        <Route path="oversight" element={<Navigate to="/admin/reports" replace />} />
        <Route path="feedback" element={<FeedbackInboxPage />} />
        <Route path="disputes" element={<DisputesPage />} />
        <Route path="monitoring" element={<SystemMonitoringPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
