import OrganizationSearchPage from "../components/OrganizationSearchPage";
import ReportTracker from "../components/ReportTracker";

export default function VDPPage() {
  return (
    <div>
      <div className="section">
        <div className="section-header">
          <div>
            <h1>Public Vulnerability Intake</h1>
            <p className="muted">
              Choose an organization to open its disclosure portal at
              <strong> /security/{"{organization}"}</strong>.
            </p>
          </div>
          <span className="severity-chip informational">Public Directory</span>
        </div>
        <div className="callout field" style={{ marginTop: "16px" }}>
          <h3>How this page works</h3>
          <p>
            This directory only helps researchers discover published VDP programs.
            Submission happens inside each organization portal.
          </p>
        </div>
        <div className="actions" style={{ marginTop: "16px" }}>
          <span className="badge ok">Policy-first workflow</span>
          <span className="badge">Report tracking included</span>
          <span className="badge disabled">No account required for intake</span>
        </div>
      </div>

      <OrganizationSearchPage />
      <ReportTracker />
    </div>
  );
}
