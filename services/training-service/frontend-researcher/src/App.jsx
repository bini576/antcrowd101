import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getMe } from "@shared-api/auth";
import ProtectedRoute from "@shared-ui/ProtectedRoute";
import { applySessionFromUrl, clearSession, getStoredToken, getStoredUser } from "@shared-session/session";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import TrainerDashboard from "./pages/TrainerDashboard";

function HomeRedirect() {
  const token = getStoredToken();
  const user = getStoredUser();
  if (!token || !user || user.role !== "trainer") {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/researcher" replace />;
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
        if (me?.role === "trainer") {
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
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage expectedRole="trainer" successPath="/researcher" title="Internal Researcher Login" />} />
      <Route
        path="/researcher"
        element={
          <ProtectedRoute allowedRoles={["trainer"]} forbiddenPath="/">
            <TrainerDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
