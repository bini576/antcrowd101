import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getMe } from "@shared-api/auth";
import ProtectedRoute from "@shared-ui/ProtectedRoute";
import { applySessionFromUrl, clearSession, getStoredToken, getStoredUser } from "@shared-session/session";
import LoginPage from "./pages/LoginPage";
import OrganizationDashboard from "./pages/OrganizationDashboard";

function RootRedirect() {
  const token = getStoredToken();
  const role = getStoredUser()?.role || "";

  if (token && role === "organization_admin") {
    return <Navigate to="/organization/training" replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      applySessionFromUrl();
      const token = getStoredToken();

      if (!token) {
        setReady(true);
        return;
      }

      try {
        const me = await getMe();
        if (me?.role === "organization_admin") {
          localStorage.setItem("auth_user", JSON.stringify(me));
        } else {
          clearSession();
        }
      } catch {
        clearSession();
      } finally {
        setReady(true);
      }
    }

    bootstrap();
  }, []);

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/login"
        element={
          <LoginPage
            expectedRole="organization_admin"
            successPath="/organization/training"
            title="Organization Training Login"
          />
        }
      />
      <Route
        path="/organization/training"
        element={
          <ProtectedRoute allowedRoles={["organization_admin"]} forbiddenPath="/login">
            <OrganizationDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
