import { Navigate } from "react-router-dom";
import { useOrgSession } from "../hooks/useOrgSession";

export default function SessionGuard({ children }) {
  const { hasSession } = useOrgSession();

  if (!hasSession) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
