import { Navigate } from "react-router-dom";

export default function AuthGate({ tokenReady, children }) {
  if (!tokenReady) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
