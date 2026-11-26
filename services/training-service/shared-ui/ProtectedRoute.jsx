import { Navigate } from "react-router-dom";
import { getStoredToken, getStoredUser } from "@shared-session/session";

export default function ProtectedRoute({ allowedRoles, children, forbiddenPath = "/" }) {
  const token = getStoredToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={forbiddenPath} replace />;
  }

  return children;
}
