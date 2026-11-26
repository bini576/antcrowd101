import { Link } from "react-router-dom";

export default function SettingsPage({ showLogo, setShowLogo }) {
  return (
    <section className="grid two">
      <article className="card">
        <h2>Console Preferences</h2>
        <p className="section-intro">Manage global display and operational preferences.</p>
        <label className="check-row">
          <input type="checkbox" checked={showLogo} onChange={(event) => setShowLogo(event.target.checked)} />
          <span>Show AntCrowd logo in sidebar</span>
        </label>
      </article>

      <article className="card">
        <h2>Workspace Navigation</h2>
        <p className="section-intro">All platform-admin operations run inside this unified console.</p>
        <div className="list compact">
          <Link className="list-row action-row" to="/admin/pentesting">
            <div>
              <strong>Pentesting Workspace</strong>
              <p>Platform operations for assignments, findings, and researchers.</p>
            </div>
          </Link>
          <Link className="list-row action-row" to="/admin/vdp">
            <div>
              <strong>VDP Workspace</strong>
              <p>Global VDP program portfolio, SLA monitoring, and report oversight.</p>
            </div>
          </Link>
          <Link className="list-row action-row" to="/admin/training">
            <div>
              <strong>Training Workspace</strong>
              <p>Unified platform-admin training operations and setup inside this console.</p>
            </div>
          </Link>
        </div>
      </article>
    </section>
  );
}
