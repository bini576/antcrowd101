import { useEffect, useMemo, useState } from "react";
import { researcherApi } from "../api/researcherApi";
import { getResearcherPortalConfig } from "../utils/portalConfig";
import { EmptyState, SeverityBadge, StatusBadge, formatPortalLabel } from "./PortalUI";
import { Avatar, brandAssets } from "@ant-ui";

const severities = ["critical", "high", "medium", "low", "informational"];

const initialFinding = {
  engagementId: "",
  title: "",
  severity: "medium",
  cvss: "",
  poc: "",
  remediation: "",
  evidenceUrl: "",
  assetPath: "",
  cwe: "",
};

const initialProfileForm = {
  phone: "",
  bio: "",
  skills: "",
  specialization: "",
  experienceLevel: "",
  socialLinks: {
    github: "",
    linkedin: "",
    x: "",
    website: "",
  },
};

function statCard(label, value) {
  return (
    <article className="stat-card" key={label}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function bellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.75a4.75 4.75 0 0 0-4.75 4.75v1.1c0 1.1-.36 2.17-1.02 3.05L4.7 14.7a1 1 0 0 0 .8 1.6h13a1 1 0 0 0 .8-1.6l-1.53-2.05a5.08 5.08 0 0 1-1.02-3.05V8.5A4.75 4.75 0 0 0 12 3.75Zm0 17a2.5 2.5 0 0 0 2.33-1.6H9.67A2.5 2.5 0 0 0 12 20.75Z" />
    </svg>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });
}

function formatExperienceLevel(value) {
  if (!value) return "Experience not set";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function ResearcherPortalApp() {
  const { expectedRole, portalLabel, loginHint, isInternalPortal } = getResearcherPortalConfig();
  const draftKey = `antcrowd_finding_draft_${expectedRole || "researcher"}`;

  const [tokenReady, setTokenReady] = useState(!!researcherApi.getToken());
  const [sessionState, setSessionState] = useState(tokenReady ? "active" : "bootstrapping");

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [engagements, setEngagements] = useState([]);
  const [applications, setApplications] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [findings, setFindings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [earnings, setEarnings] = useState({ totalEarned: 0, pendingPayouts: 0, paidHistory: [], pendingFindings: [] });
  const [finding, setFinding] = useState(initialFinding);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [respondingInvitationId, setRespondingInvitationId] = useState(0);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [toast, setToast] = useState("");
  const [activeSection, setActiveSection] = useState(window.location.hash || "#assigned");

  useEffect(() => {
    const handleHashChange = () => {
      setActiveSection(window.location.hash || "#assigned");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const activeEngagements = useMemo(() => engagements.filter((x) => x.status === "active").length, [engagements]);
  const highOrCritical = useMemo(() => findings.filter((x) => x.severity === "high" || x.severity === "critical").length, [findings]);
  const resolvedFindings = useMemo(() => findings.filter((x) => x.status === "resolved" || x.status === "paid").length, [findings]);
  const pendingInvitations = useMemo(() => invitations.filter((x) => x.status === "pending").length, [invitations]);
  const unreadNotifications = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  useEffect(() => {
    if (!tokenReady) {
      bootstrapPlatformSession();
      return;
    }
    setSessionState("active");
    load();
  }, [tokenReady]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setFinding((prev) => ({ ...prev, ...draft, severity: draft?.severity || prev.severity }));
    } catch {
      // ignore broken drafts
    }
  }, [draftKey]);

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      phone: profile.phone || "",
      bio: profile.bio || "",
      skills: profile.skills || "",
      specialization: profile.specialization || "",
      experienceLevel: profile.experienceLevel || "",
      socialLinks: {
        github: profile.socialLinks?.github || "",
        linkedin: profile.socialLinks?.linkedin || "",
        x: profile.socialLinks?.x || "",
        website: profile.socialLinks?.website || profile.socialLinks?.portfolio || "",
      },
    });
  }, [profile]);

  async function bootstrapPlatformSession() {
    setError("");
    setInfo("");
    setSessionState("bootstrapping");
    try {
      const response = await researcherApi.bootstrap();
      researcherApi.setToken(response.access_token || response.token || "");
      setTokenReady(true);
      setInfo("Connected from your AntCrowd workspace.");
    } catch (e) {
      setSessionState("needs-platform-login");
      setError(e.message || "Open this workspace from your AntCrowd dashboard.");
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error(e);
    }
    researcherApi.setToken("");
    setTokenReady(false);
    setSessionState("needs-platform-login");
    setUser(null);
    setProfile(null);
    setEngagements([]);
    setApplications([]);
    setInvitations([]);
    setFindings([]);
    setNotifications([]);
    setEarnings({ totalEarned: 0, pendingPayouts: 0, paidHistory: [], pendingFindings: [] });
    const mainAppLoginUrl = (import.meta.env.VITE_MAIN_APP_URL || "http://localhost:5173").replace(/\/$/, "") + "/login";
    window.location.assign(mainAppLoginUrl);
  }

  async function load() {
    setError("");
    try {
      const [me, p, e, a, inv, f, noteData, earningData] = await Promise.all([
        researcherApi.me(),
        researcherApi.getProfile(),
        researcherApi.getEngagements(),
        researcherApi.getApplications(),
        researcherApi.getInvitations(),
        researcherApi.getFindings(),
        researcherApi.getNotifications().catch(() => []),
        researcherApi.getEarnings().catch(() => ({ totalEarned: 0, pendingPayouts: 0, paidHistory: [], pendingFindings: [] })),
      ]);
      if (expectedRole && me.role !== expectedRole) {
        throw new Error(`This portal is for ${expectedRole.replace("researcher_", "")} researchers only.`);
      }
      setUser(me);
      setProfile(p);
      setEngagements(e || []);
      setApplications(a || []);
      setInvitations(inv || []);
      setFindings(f || []);
      setNotifications(noteData || []);
      setEarnings(earningData || { totalEarned: 0, pendingPayouts: 0, paidHistory: [], pendingFindings: [] });
      if (!finding.engagementId && (e || []).length > 0) {
        setFinding((prev) => ({ ...prev, engagementId: String(e[0].id) }));
      }
    } catch (e) {
      researcherApi.setToken("");
      setTokenReady(false);
      setError(e.message || "Failed to load portal data");
    }
  }

  async function respondInvitation(invitationId, status) {
    setError("");
    setInfo("");
    setRespondingInvitationId(invitationId);
    try {
      await researcherApi.respondInvitation(invitationId, status);
      setInfo(`Invitation ${status}.`);
      await load();
    } catch (e) {
      setError(e.message || "Failed to respond to invitation");
    } finally {
      setRespondingInvitationId(0);
    }
  }

  function saveDraft() {
    const payload = {
      ...finding,
      evidenceUrl: evidenceFiles.map((file) => file.name).join(", "),
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
    setToast("Finding draft saved locally.");
  }

  async function submitFinding() {
    setError("");
    setInfo("");
    if (!finding.engagementId || !finding.title || !finding.poc || !finding.remediation) {
      setError("Engagement, title, PoC, and remediation are required.");
      return;
    }
    try {
      await researcherApi.submitFinding({
        engagementId: Number(finding.engagementId),
        title: finding.title,
        severity: finding.severity,
        cvss: Number(finding.cvss || 0),
        poc: finding.poc,
        remediation: finding.remediation,
        evidenceUrl: [finding.evidenceUrl, ...evidenceFiles.map((file) => file.name)].filter(Boolean).join(" | "),
        assetPath: finding.assetPath,
        cwe: finding.cwe,
      });
      const preservedEngagementId = finding.engagementId;
      setFinding({ ...initialFinding, engagementId: preservedEngagementId });
      setEvidenceFiles([]);
      localStorage.removeItem(draftKey);
      setToast("Finding submitted successfully.");
      window.location.hash = "#findings";
      await load();
    } catch (e) {
      setError(e.message || "Failed to submit finding");
    }
  }

  async function markNotificationRead(id) {
    try {
      await researcherApi.markNotificationRead(id);
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch {
      // ignore
    }
  }

  function updateProfileField(field, value) {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateSocialLink(field, value) {
    setProfileForm((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [field]: value,
      },
    }));
  }

  function resetProfileForm() {
    if (!profile) {
      setProfileForm(initialProfileForm);
      return;
    }
    setProfileForm({
      phone: profile.phone || "",
      bio: profile.bio || "",
      skills: profile.skills || "",
      specialization: profile.specialization || "",
      experienceLevel: profile.experienceLevel || "",
      socialLinks: {
        github: profile.socialLinks?.github || "",
        linkedin: profile.socialLinks?.linkedin || "",
        x: profile.socialLinks?.x || "",
        website: profile.socialLinks?.website || profile.socialLinks?.portfolio || "",
      },
    });
  }

  async function saveProfile() {
    setError("");
    setInfo("");
    setProfileSaving(true);
    try {
      const updatedProfile = await researcherApi.updateProfile({
        phone: profileForm.phone,
        bio: profileForm.bio,
        skills: profileForm.skills,
        specialization: profileForm.specialization,
        experienceLevel: profileForm.experienceLevel,
        socialLinks: profileForm.socialLinks,
      });
      setProfile(updatedProfile);
      setInfo("Researcher profile updated.");
    } catch (e) {
      setError(e.message || "Unable to update profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleProfilePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setInfo("");
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photo must be 5MB or smaller.");
      event.target.value = "";
      return;
    }

    setPhotoUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const updatedProfile = await researcherApi.uploadProfilePhoto(dataUrl);
      setProfile(updatedProfile);
      setInfo("Profile photo updated.");
    } catch (e) {
      setError(e.message || "Unable to upload profile photo");
    } finally {
      setPhotoUploading(false);
      event.target.value = "";
    }
  }

  if (!tokenReady) {
    if (sessionState === "bootstrapping") {
      return (
        <div className="page auth-page" style={{ background: "#020617" }}>
          <div className="auth-shell">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.75rem", fontWeight: "900", color: "#facc15", marginBottom: "16px", justifyContent: "center" }}>
              <span style={{ display: "grid", placeItems: "center", width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(to bottom right, #f59e0b, #ea580c)", color: "#090d16", fontSize: "14px", fontWeight: "900" }}>A</span>
              AntCrowd
            </div>
            <div className="card auth-card" style={{ border: "1px solid rgba(245,158,11,0.15)", background: "#0b0f19" }}>
              <h2>Preparing {portalLabel.toLowerCase()} researcher workspace</h2>
              <p className="muted">We are confirming your AntCrowd session and connecting you to the pentest service.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="page auth-page" style={{ background: "#020617" }}>
        <div className="auth-shell">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.75rem", fontWeight: "900", color: "#facc15", marginBottom: "16px", justifyContent: "center" }}>
            <span style={{ display: "grid", placeItems: "center", width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(to bottom right, #f59e0b, #ea580c)", color: "#090d16", fontSize: "14px", fontWeight: "900" }}>A</span>
            AntCrowd
          </div>
          <div className="card auth-card" style={{ border: "1px solid rgba(245,158,11,0.15)", background: "#0b0f19" }}>
            <h2>{portalLabel} Researcher Workspace</h2>
            <p className="muted">{loginHint}</p>
            <p className="muted">Open this service from the main AntCrowd workspace after signing in with your verified researcher account.</p>
            <button type="button" onClick={() => window.location.assign("/researchers/login")}>
              Return to AntCrowd Login
            </button>
            {error && <div className="notice error">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  function SidebarLink({ href, icon, label, active }) {
    const [hovered, setHovered] = useState(false);
    const style = {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "10px 12px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      textDecoration: "none",
      transition: "all 0.2s",
      backgroundColor: active ? "rgba(245, 158, 11, 0.1)" : hovered ? "#334155" : "transparent",
      color: active ? "#f59e0b" : hovered ? "#ffffff" : "#94a3b8",
      borderLeft: active ? "3px solid #f59e0b" : "3px solid transparent"
    };
    return (
      <a
        href={href}
        style={style}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={{ fontSize: "16px", marginRight: "4px" }}>{icon}</span> {label}
      </a>
    );
  }

  return (
    <div className="app-shell" style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "Inter, -apple-system, sans-serif" }}>
      <aside style={{ position: "sticky", top: 0, height: "100vh", background: "#1e293b", borderRight: "1px solid #334155", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #334155" }}>
          <a href="#" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
            <span style={{ color: "#f59e0b", fontWeight: "800", fontSize: "1.25rem", letterSpacing: "-0.025em" }}>AntCrowd</span>
          </a>
          <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.3em", color: "#64748b", margin: "4px 0 0 0" }}>PENTEST</p>
        </div>
        <nav style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <SidebarLink href="#assigned" icon="📬" label="Assigned" active={activeSection === "#assigned"} />
          <SidebarLink href="#submit" icon="📤" label="Submit" active={activeSection === "#submit"} />
          <SidebarLink href="#findings" icon="🔍" label="Findings" active={activeSection === "#findings"} />
          <SidebarLink href="#earnings" icon="💰" label="Earnings" active={activeSection === "#earnings"} />
          <SidebarLink href="#notifications" icon="🔔" label="Notifications" active={activeSection === "#notifications"} />
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid #334155", fontSize: "12px", color: "#64748b" }}>&copy; 2026 AntCrowd</div>
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", overflowX: "hidden" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 20, height: "60px", borderBottom: "1px solid #334155", backgroundColor: "#1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#94a3b8", margin: 0 }}>Researcher &mdash; Penetration Testing Service</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {toast ? <div className="notice success toast-inline" style={{ padding: "4px 12px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", fontSize: "12px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>{toast}</div> : null}
            <a href="#notifications" className="notification-pill" style={{ background: "transparent", border: "none", cursor: "pointer", position: "relative", textDecoration: "none", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="notification-pill-icon">{bellIcon()}</span>
              {unreadNotifications > 0 && (
                <span style={{ display: "grid", placeItems: "center", width: "16px", height: "16px", background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: "bold", borderRadius: "50%" }}>
                  {unreadNotifications}
                </span>
              )}
            </a>
            <span className="user-chip" style={{ fontSize: "14px", fontWeight: "500", color: "#f1f5f9" }}>{user?.fullName} ({formatPortalLabel(user?.role)})</span>
            <button className="ghost" onClick={load} style={{ padding: "8px 12px", background: "transparent", border: "1px solid #334155", borderRadius: "8px", color: "#94a3b8", fontWeight: "600", cursor: "pointer" }}>Refresh</button>
            <button onClick={logout} style={{ padding: "8px 16px", background: "#334155", color: "#f1f5f9", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Logout</button>
          </div>
        </header>

        <main style={{ flex: 1, width: "100%", maxWidth: "1280px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <section className="hero" style={{ border: "1px solid #334155", background: "linear-gradient(to bottom right, rgba(245, 158, 11, 0.03), #1e293b, #0f172a)", borderRadius: "16px", padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="hero-copy">
              <p className="eyebrow" style={{ fontSize: "10px", fontWeight: "bold", letterSpacing: "0.22em", textTransform: "uppercase", color: "#f59e0b", margin: 0 }}>{isInternalPortal ? "Internal Security Team" : "External Security Researchers"}</p>
              <h1 style={{ fontSize: "2.25rem", fontWeight: "800", color: "#ffffff", margin: "12px 0 8px 0" }}>{isInternalPortal ? "Internal Researcher Operations Workspace" : "External Researcher Delivery Workspace"}</h1>
              <p style={{ color: "#94a3b8", fontSize: "1rem", margin: "0 0 20px 0", lineHeight: "1.6" }}>
                {isInternalPortal
                  ? "Receive assignments from platform admin and execute tests with organization context, faster collaboration, and clear remediation handoff."
                  : "Work assigned programs with consistent evidence, high-quality PoC, and professional reporting standards for fast acceptance."}
              </p>
              <div className="quick-stats" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {statCard("Assigned", engagements.length)}
                {statCard("Active", activeEngagements)}
                {statCard("Pending Invites", pendingInvitations)}
                {statCard("High/Critical", highOrCritical)}
                {statCard("Resolved", resolvedFindings)}
              </div>
            </div>
          </section>

      <section className="identity card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <Avatar name={profile?.fullName || user?.fullName} size="lg" src={profile?.photoDataUrl || ""} />
            <div>
              <h2>Researcher Identity</h2>
              <p className="muted">
                {profile?.fullName} • {profile?.isInternal ? "Internal" : "External"} • {profile?.skills || "No skills listed"}
              </p>
              <p className="muted" style={{ marginTop: "6px" }}>
                {profile?.specialization || "Specialization pending"} • {formatExperienceLevel(profile?.experienceLevel)}
              </p>
            </div>
          </div>
          <div className="double" style={{ width: "min(100%, 360px)" }}>
            {statCard("Submissions", profile?.submissionsCount || 0)}
            {statCard("Rating", profile?.reputationStats?.ratingCount ? profile.reputationStats.averageRating.toFixed(1) : "New")}
          </div>
        </div>
        <div className="role-pill-row">
          {isInternalPortal ? (
            <>
              <span className="role-pill">Direct admin assignment</span>
              <span className="role-pill">Organization-aligned testing</span>
              <span className="role-pill">Priority validation support</span>
            </>
          ) : (
            <>
              <span className="role-pill">Org-selected researcher</span>
              <span className="role-pill">Independent security perspective</span>
              <span className="role-pill">Repeatable report quality</span>
            </>
          )}
        </div>
        <div className="quick-stats" style={{ marginTop: "18px" }}>
          {statCard("Accepted", profile?.reputationStats?.acceptedFindings || 0)}
          {statCard("Resolved", profile?.reputationStats?.resolvedFindings || 0)}
          {statCard("Paid", profile?.reputationStats?.paidFindings || 0)}
          {statCard("Bounty", `$${profile?.reputationStats?.totalBounty || 0}`)}
        </div>
        <div className="grid two">
          <article className="item">
            <strong>Service-owned profile</strong>
            <p className="muted">These details stay editable inside the pentest researcher workspace and flow back into the broader AntCrowd researcher experience.</p>
            <input
              placeholder="Phone number"
              value={profileForm.phone}
              onChange={(event) => updateProfileField("phone", event.target.value)}
            />
            <input
              placeholder="Primary skills"
              value={profileForm.skills}
              onChange={(event) => updateProfileField("skills", event.target.value)}
            />
            <input
              placeholder="Specialization"
              value={profileForm.specialization}
              onChange={(event) => updateProfileField("specialization", event.target.value)}
            />
            <select
              value={profileForm.experienceLevel}
              onChange={(event) => updateProfileField("experienceLevel", event.target.value)}
            >
              <option value="">Select experience level</option>
              <option value="entry">Entry</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
              <option value="principal">Principal</option>
              <option value="expert">Expert</option>
            </select>
            <textarea
              placeholder="Bio / about"
              value={profileForm.bio}
              onChange={(event) => updateProfileField("bio", event.target.value)}
            />
            <div className="double">
              <button disabled={profileSaving} onClick={saveProfile} type="button">
                {profileSaving ? "Saving..." : "Save profile"}
              </button>
              <button className="ghost" onClick={resetProfileForm} type="button">
                Reset fields
              </button>
            </div>
          </article>

          <article className="item">
            <strong>Social links and photo</strong>
            <p className="muted">Upload a profile image and keep the links your organizations and admins use during assignment and review.</p>
            <input
              placeholder="GitHub URL"
              value={profileForm.socialLinks.github}
              onChange={(event) => updateSocialLink("github", event.target.value)}
            />
            <input
              placeholder="LinkedIn URL"
              value={profileForm.socialLinks.linkedin}
              onChange={(event) => updateSocialLink("linkedin", event.target.value)}
            />
            <input
              placeholder="X / Twitter URL"
              value={profileForm.socialLinks.x}
              onChange={(event) => updateSocialLink("x", event.target.value)}
            />
            <input
              placeholder="Website or portfolio URL"
              value={profileForm.socialLinks.website}
              onChange={(event) => updateSocialLink("website", event.target.value)}
            />
            <input
              accept="image/png,image/jpeg,image/webp"
              disabled={photoUploading}
              onChange={handleProfilePhotoChange}
              type="file"
            />
            <p className="muted">{photoUploading ? "Uploading profile photo..." : "PNG, JPG, or WebP up to 5MB."}</p>
          </article>
        </div>
      </section>

      {error && <div className="notice error">{error}</div>}
      {info && <div className="notice success">{info}</div>}

      <section id="assigned" className="grid two">
        <article className="card">
          <h2>Invitation Inbox</h2>
          {invitations.map((inv) => (
            <div className="item" key={inv.id}>
              <div className="stacked-copy">
                <strong>{inv.engagementName}</strong>
                <div className="badge-stack">
                  <StatusBadge status={inv.status} />
                </div>
              </div>
              {inv.status === "pending" ? (
                <div className="double">
                  <button disabled={respondingInvitationId === inv.id} onClick={() => respondInvitation(inv.id, "accepted")}>
                    {respondingInvitationId === inv.id ? "Working..." : "Accept"}
                  </button>
                  <button className="ghost" disabled={respondingInvitationId === inv.id} onClick={() => respondInvitation(inv.id, "declined")}>
                    Decline
                  </button>
                </div>
              ) : (
                <p className="muted">Invitation finalized.</p>
              )}
            </div>
          ))}
          {invitations.length === 0 && (
            <EmptyState
              icon="inbox"
              compact
              title="Your invitation inbox is clear"
              description="New testing invitations from organizations and admins will appear here as soon as they are assigned."
            />
          )}
        </article>

        <article className="card">
          <h2>{isInternalPortal ? "Internal Assignments" : "Assigned Engagements"}</h2>
          {engagements.map((e) => (
            <div className="item" key={e.id}>
              <div className="stacked-copy">
                <strong>{e.title}</strong>
                <div className="badge-stack">
                  <StatusBadge status={e.status} />
                  <span className={`pill ${e.testerPool === "internal" ? "internal" : "external"}`}>
                    {formatPortalLabel(e.testerPool)}
                  </span>
                </div>
                <p>{e.type} • {e.mode.replace("_", " ")} • {e.target}</p>
                <p>Deadline: {e.deadline || "TBD"}</p>
              </div>
            </div>
          ))}
          {engagements.length === 0 && (
            <EmptyState
              icon="shield"
              compact
              title="No active programs have been assigned yet"
              description="Once an admin routes a program to you, it will show up here with scope, pool, and deadline details."
            />
          )}
        </article>

        <article className="card">
          <h2>{isInternalPortal ? "Assignment Governance Trace" : "Assignment History"}</h2>
          {applications.map((a) => (
            <div className="item" key={a.id}>
              <div className="stacked-copy">
                <strong>{a.engagementName}</strong>
                <div className="badge-stack">
                  <StatusBadge status={a.status} />
                </div>
                <p>Assigned by: {formatPortalLabel(a.assignedBy || "system")}</p>
              </div>
            </div>
          ))}
          {applications.length === 0 && (
            <EmptyState
              icon="search"
              compact
              title="No assignment history yet"
              description="As your approved programs move through the queue, their assignment trail will be listed here."
            />
          )}
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>{isInternalPortal ? "Internal Playbook" : "External Delivery Standard"}</h2>
          {isInternalPortal ? (
            <>
              <p className="muted">1. Confirm scope and constraints before testing starts.</p>
              <p className="muted">2. Report reproducible findings with remediation and business context.</p>
              <p className="muted">3. Support retesting and closure with the organization engineering team.</p>
            </>
          ) : (
            <>
              <p className="muted">1. Follow engagement brief and approved testing windows.</p>
              <p className="muted">2. Submit concise PoC and clear impact narrative.</p>
              <p className="muted">3. Maintain professionalism, response speed, and evidence quality.</p>
            </>
          )}
        </article>

        <article className="card">
          <h2>{isInternalPortal ? "Quality Baseline" : "Performance Baseline"}</h2>
          <p className="muted">Total findings submitted: {findings.length}</p>
          <p className="muted">High/Critical submitted: {highOrCritical}</p>
          <p className="muted">Resolved findings: {resolvedFindings}</p>
          <p className="muted">Pending payout amount: {Number(earnings.pendingPayouts || 0)} ETB</p>
        </article>
      </section>

      <section id="submit" className="grid two">
        <article className="card">
          <h2>Submit Finding</h2>
          <label className="field-label">Assigned Engagement</label>
          <select value={finding.engagementId} onChange={(e) => setFinding({ ...finding, engagementId: e.target.value })}>
            <option value="">Choose an assigned engagement</option>
            {engagements.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <label className="field-label">Finding Title</label>
          <input placeholder="Summarize the issue clearly" value={finding.title} onChange={(e) => setFinding({ ...finding, title: e.target.value })} />
          <div className="double">
            <div>
              <strong>Severity</strong>
              <select value={finding.severity} onChange={(e) => setFinding({ ...finding, severity: e.target.value })}>
                {severities.map((s) => <option key={s} value={s}>{formatPortalLabel(s)}</option>)}
              </select>
              <div className="helper-text">
                <SeverityBadge severity={finding.severity} small />
              </div>
            </div>
            <div>
              <strong>CVSS Score (0.0 to 10.0)</strong>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                placeholder="e.g. 8.4"
                value={finding.cvss}
                onChange={(e) => setFinding({ ...finding, cvss: e.target.value })}
              />
              <p className="helper-text">Use CVSS to help the triage team understand exploitability and impact quickly.</p>
            </div>
          </div>
          <label className="field-label">CWE / Asset / Evidence Reference</label>
          <input placeholder="CWE-79" value={finding.cwe} onChange={(e) => setFinding({ ...finding, cwe: e.target.value })} />
          <input placeholder="Affected asset or endpoint" value={finding.assetPath} onChange={(e) => setFinding({ ...finding, assetPath: e.target.value })} />
          <input placeholder="Evidence URL or internal reference" value={finding.evidenceUrl} onChange={(e) => setFinding({ ...finding, evidenceUrl: e.target.value })} />
          <label className="field-label">Evidence Files</label>
          <input type="file" multiple onChange={(e) => setEvidenceFiles(Array.from(e.target.files || []))} />
          {evidenceFiles.length > 0 ? (
            <div className="file-tag-list">
              {evidenceFiles.map((file) => <span className="metric-pill" key={file.name}>{file.name}</span>)}
            </div>
          ) : null}
          <label className="field-label">Proof Of Concept</label>
          <textarea rows={6} placeholder="Provide the steps, payload, and impact proof. Markdown-style bullet points are supported." value={finding.poc} onChange={(e) => setFinding({ ...finding, poc: e.target.value })} />
          <p className="helper-text">Tip: use short sections like `Steps`, `Observed`, and `Expected` to make triage faster.</p>
          <label className="field-label">Suggested Remediation</label>
          <textarea rows={6} placeholder="Explain what engineering should change to fix the issue. Markdown-style lists are supported." value={finding.remediation} onChange={(e) => setFinding({ ...finding, remediation: e.target.value })} />
          <p className="helper-text">Tip: include both the root-cause fix and any short-term containment recommendation.</p>
          <div className="double">
            <button className="ghost" onClick={saveDraft}>Save As Draft</button>
            <button onClick={submitFinding}>Submit Finding</button>
          </div>
        </article>

        <article id="findings" className="card">
          <h2>My Findings</h2>
          {findings.map((f) => (
            <div className="item" key={f.id}>
              <div className="stacked-copy">
                <strong>{f.title}</strong>
                <p>{f.jobTitle}</p>
                <div className="badge-stack">
                  <SeverityBadge severity={f.severity} />
                  <StatusBadge status={f.status} />
                  <span className="metric-pill">CVSS {Number(f.cvss || 0).toFixed(1)}</span>
                  {Number(f.bounty || 0) > 0 ? <span className="metric-pill">Bounty {Number(f.bounty || 0)} ETB</span> : null}
                </div>
                <p>{f.cwe || "No CWE provided"} • {f.assetPath || "No asset reference provided"}</p>
                {f.reviewComment ? <p>Review note: {f.reviewComment}</p> : null}
                {f.paymentReference ? <p>Payment reference: {f.paymentReference}</p> : null}
              </div>
            </div>
          ))}
          {findings.length === 0 && (
            <EmptyState
              icon="spark"
              compact
              title="Your finding queue is empty"
              description="Once you submit a validated issue, it will appear here with severity, review status, and CVSS context."
            />
          )}
        </article>
      </section>

      <section id="earnings" className="grid two">
        <article className="card">
          <h2>Earnings</h2>
          <div className="quick-stats">
            {statCard("Total Earned", earnings.totalEarned || 0)}
            {statCard("Pending Payouts", earnings.pendingPayouts || 0)}
            {statCard("Paid Findings", earnings.paidHistory?.length || 0)}
          </div>
          <div className="list compact">
            {(earnings.paidHistory || []).map((item) => (
              <div className="list-row" key={`paid-${item.id}`}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.jobTitle}</p>
                  <p>{item.paymentReference || "Reference pending"}</p>
                </div>
                <div className="badge-stack">
                  <StatusBadge status={item.status} />
                  <span className="metric-pill">{item.bounty || 0} ETB</span>
                </div>
              </div>
            ))}
            {(earnings.paidHistory || []).length === 0 && (
              <EmptyState compact icon="shield" title="No payout history yet" description="Once accepted findings are paid, references and payout amounts will appear here." />
            )}
          </div>
        </article>

        <article id="notifications" className="card">
          <h2>Notifications</h2>
          <div className="list compact">
            {notifications.map((item) => (
              <div className={`list-row ${item.read ? "" : "unread"}`} key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <div className="badge-stack">
                    <StatusBadge status={item.read ? "read" : "unread"} />
                  </div>
                  <p>{item.message}</p>
                  <p>{item.createdAt}</p>
                </div>
                {!item.read ? <button className="ghost" onClick={() => markNotificationRead(item.id)}>Mark read</button> : null}
              </div>
            ))}
            {notifications.length === 0 && (
              <EmptyState compact icon="inbox" title="No notifications yet" description="Assignment updates, review decisions, and payout notices will show up here." />
            )}
          </div>
        </article>
      </section>
    </main>
    </div>
    </div>
  );
}
