import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, FieldHint, LoadingCard, Toast } from "../components/AdminUI";
import { getOrgProfile, updateOrgProfile } from "../services/api";

const EXTRAS_KEY = "vdp_org_profile_extras";

function loadExtras() {
  try {
    return JSON.parse(localStorage.getItem(EXTRAS_KEY) || "{}");
  } catch {
    return {};
  }
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OrganizationProfilePage() {
  const extras = useMemo(() => loadExtras(), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [emptyState, setEmptyState] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    contact_email: "",
    contact_name: "",
    website: "",
    description: "",
    logo_preview: extras.logo_preview || "",
    linkedin: extras.linkedin || "",
    x: extras.x || "",
    github: extras.github || "",
    bounty_range: extras.bounty_range || "",
  });

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getOrgProfile();
      setEmptyState(false);
      setForm((prev) => ({
        ...prev,
        name: data?.name || "",
        slug: data?.slug || "",
        contact_email: data?.contact_email || "",
        contact_name: data?.contact_name || "",
        website: data?.website || "",
        description: data?.description || "",
      }));
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) {
        setEmptyState(true);
      } else {
        setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const logo_preview = await readFileAsDataUrl(file);
      setForm((prev) => ({ ...prev, logo_preview }));
    } catch {
      setError("Failed to read logo file");
    }
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      await updateOrgProfile({
        name: form.name,
        slug: form.slug,
        contact_email: form.contact_email,
        contact_name: form.contact_name,
        website: form.website,
        description: form.description,
      });
      localStorage.setItem(
        EXTRAS_KEY,
        JSON.stringify({
          logo_preview: form.logo_preview,
          linkedin: form.linkedin,
          x: form.x,
          github: form.github,
          bounty_range: form.bounty_range,
        })
      );
      setEmptyState(false);
      setToast("Organization profile saved successfully.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to save profile");
    }
  }

  const publicPreviewUrl = form.slug ? `/security/${form.slug}` : "/security/your-company";

  return (
    <section className="section">
      <Toast message={toast} />
      <div className="section-header">
        <div>
          <h2>Organization Profile</h2>
          <p className="muted">Define the identity, contact details, and public trust signals that researchers will see before they report to your VDP.</p>
        </div>
      </div>

      {loading ? <LoadingCard label="Loading organization profile..." /> : null}
      {error ? <div className="error">{error}</div> : null}
      {error ? (
        <div className="actions">
          <Link className="btn secondary" to="/login">Sign In Again</Link>
        </div>
      ) : null}

      {emptyState && !loading ? (
        <EmptyState
          icon="user"
          title="No profile exists yet"
          description="Set up your organization profile now so your public disclosure page looks credible and complete when researchers land on it."
        />
      ) : null}

      <div className="split profile-split">
        <form className="card field" onSubmit={save}>
          <h3>Organization Details</h3>
          <div className="card-grid">
            <div className="field">
              <label>Organization Name</label>
              <input className="input" placeholder="Acme Security" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </div>
            <div className="field">
              <label>Public Slug</label>
              <input className="input" placeholder="acme-security" value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} required />
              <FieldHint>Used in your public VDP page URL.</FieldHint>
            </div>
            <div className="field">
              <label>Security Contact Email</label>
              <input className="input" type="email" placeholder="security@acme.com" value={form.contact_email} onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))} />
            </div>
            <div className="field">
              <label>Primary Contact Name</label>
              <input className="input" placeholder="Alem Tesfaye" value={form.contact_name} onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))} />
            </div>
            <div className="field">
              <label>Website</label>
              <input className="input" placeholder="https://acme.com" value={form.website} onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))} />
            </div>
            <div className="field">
              <label>Optional Bounty Range</label>
              <input className="input" placeholder="$100 - $2,500" value={form.bounty_range} onChange={(e) => setForm((prev) => ({ ...prev, bounty_range: e.target.value }))} />
              <FieldHint>Displayed in the preview only until payout ranges are centrally managed.</FieldHint>
            </div>
          </div>

          <div className="field">
            <label>Public Program Description</label>
            <textarea className="input" rows={5} placeholder="Tell researchers what you value, how you respond, and which kind of testing helps your security team most." value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>

          <div className="card-grid">
            <div className="field">
              <label>Logo Upload</label>
              <input className="input" type="file" accept="image/*" onChange={handleLogoChange} />
            </div>
            <div className="field">
              <label>LinkedIn</label>
              <input className="input" placeholder="https://linkedin.com/company/acme" value={form.linkedin} onChange={(e) => setForm((prev) => ({ ...prev, linkedin: e.target.value }))} />
            </div>
            <div className="field">
              <label>X / Twitter</label>
              <input className="input" placeholder="https://x.com/acme" value={form.x} onChange={(e) => setForm((prev) => ({ ...prev, x: e.target.value }))} />
            </div>
            <div className="field">
              <label>GitHub / Security Policy</label>
              <input className="input" placeholder="https://github.com/acme" value={form.github} onChange={(e) => setForm((prev) => ({ ...prev, github: e.target.value }))} />
            </div>
          </div>

          <div className="actions">
            <button className="btn" type="submit">Save Profile</button>
          </div>
        </form>

        <aside className="card field">
          <h3>Public VDP Preview</h3>
          <div className="profile-preview">
            <div className="profile-preview-hero">
              {form.logo_preview ? <img src={form.logo_preview} alt={`${form.name || "Organization"} logo`} className="profile-preview-logo" /> : null}
              <div>
                <strong>{form.name || "Your organization name"}</strong>
                <p>{form.description || "Your program description will appear here so researchers immediately understand your scope and response style."}</p>
              </div>
            </div>
            <div className="badge-row">
              {form.bounty_range ? <span className="pill">{form.bounty_range}</span> : null}
              {form.contact_email ? <span className="pill">{form.contact_email}</span> : null}
              {form.website ? <span className="pill">Public website</span> : null}
            </div>
            <div className="mini-bar-row preview-link-row">
              <span className="muted">Public page</span>
              <strong>{publicPreviewUrl}</strong>
            </div>
            <div className="card-grid">
              <div className="card">
                <div className="card-title">Trust Signals</div>
                <div className="card-sub">{[form.linkedin, form.x, form.github].filter(Boolean).length || 0} linked channels</div>
              </div>
              <div className="card">
                <div className="card-title">Researcher Contact</div>
                <div className="card-sub">{form.contact_name || "Primary contact not set yet"}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
