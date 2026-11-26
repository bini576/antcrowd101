import { Route, Routes } from "react-router-dom";
import "./trust-app.css";
import Navbar from "./components/layout/Navbar";
import ControlsPage from "./pages/ControlsPage";
import FaqPage from "./pages/FaqPage";
import HomePage from "./pages/HomePage";
import OverviewPage from "./pages/OverviewPage";
import ResourcesPage from "./pages/ResourcesPage";
import SubprocessorsPage from "./pages/SubprocessorsPage";
import UpdatesPage from "./pages/UpdatesPage";

export default function TrustApp() {
  return (
    <div className="trust-app">
      <div id="app" className="app app-shell min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="controls" element={<ControlsPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="subprocessors" element={<SubprocessorsPage />} />
          <Route path="updates" element={<UpdatesPage />} />
          <Route path="faq" element={<FaqPage />} />
        </Routes>
      </div>
    </div>
  );
}
