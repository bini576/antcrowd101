import { Navigate, Route, Routes } from "react-router-dom";
import SessionGuard from "../components/SessionGuard";
import AdminLayout from "../layouts/AdminLayout";
import MetricsPage from "../pages/MetricsPage";
import NotificationsPage from "../pages/NotificationsPage";
import OrganizationAdminLandingPage from "../pages/OrganizationAdminLandingPage";
import OrganizationProfilePage from "../pages/OrganizationProfilePage";
import ProgramSetupPage from "../pages/ProgramSetupPage";
import ReportTriagePage from "../pages/ReportTriagePage";
import SessionRequiredPage from "../pages/SessionRequiredPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OrganizationAdminLandingPage />} />
      <Route path="/org-admin" element={<OrganizationAdminLandingPage />} />
      <Route path="/organization-admin" element={<Navigate to="/org-admin" replace />} />
      <Route path="/login" element={<SessionRequiredPage />} />
      <Route path="/session-required" element={<SessionRequiredPage />} />
      <Route
        path="/admin"
        element={
          <SessionGuard>
            <AdminLayout />
          </SessionGuard>
        }
      >
        <Route index element={<Navigate to="/admin/profile" replace />} />
        <Route path="profile" element={<OrganizationProfilePage />} />
        <Route path="program" element={<ProgramSetupPage />} />
        <Route path="triage" element={<ReportTriagePage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
