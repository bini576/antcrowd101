import { Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout";
import SecurityDisclosurePage from "../pages/SecurityDisclosurePage";
import VDPPage from "../pages/VDPPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<VDPPage />} />
        <Route path="security/:organization" element={<SecurityDisclosurePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
