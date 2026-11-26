import { useMemo, useState } from "react";
import { EmptyState, StatusBadge } from "../components/shared/PortalUI";

function formatDateTime(value) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function ResearchersPage({
  researcherForm,
  setResearcherForm,
  createInternalResearcher,
  inviteLink = "",
  internalResearchers,
  allResearchers = internalResearchers,
  organizationOptions = [],
  verificationQueue = [],
  reviewResearcherVerification,
}) {
  const [tab, setTab] = useState("internal");
  const [search, setSearch] = useState("");
  const [reviewNotesByUserId, setReviewNotesByUserId] = useState({});
  const [activeReviewUserId, setActiveReviewUserId] = useState("");

  async function handleReview(userId, status) {
    if (typeof reviewResearcherVerification !== "function") return;
    setActiveReviewUserId(userId);
    try {
      await reviewResearcherVerification(userId, status, reviewNotesByUserId[userId] || "");
    } finally {
      setActiveReviewUserId("");
    }
  }

  const organizationNameById = new Map(organizationOptions.map((org) => [Number(org.id), org.name]));
  const visibleResearchers = useMemo(() => {
    const source = tab === "internal" ? internalResearchers : (allResearchers || []).filter((item) => !item.isInternal);
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter((item) => [item.fullName, item.handle, item.email, item.skills].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [tab, search, internalResearchers, allResearchers]);

  const prioritizedQueue = useMemo(() => {
    const rank = { submitted: 0, pending_submission: 1, rejected: 2, approved: 3 };
    return [...verificationQueue].sort((a, b) => {
      const statusA = String(a?.verification?.status || "").toLowerCase();
      const statusB = String(b?.verification?.status || "").toLowerCase();
      const rankA = Object.prototype.hasOwnProperty.call(rank, statusA) ? rank[statusA] : 4;
      const rankB = Object.prototype.hasOwnProperty.call(rank, statusB) ? rank[statusB] : 4;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b?.verification?.submittedAt || 0).getTime() - new Date(a?.verification?.submittedAt || 0).getTime();
    });
  }, [verificationQueue]);

  return (
    <>
      <section className="grid two">
        <article className="card">
          <h2>Invite Internal Researcher</h2>
          <p className="section-intro">Send a Brevo-backed onboarding invite that lets an internal researcher create a secure password and activate their ANTCROWD account.</p>
          <input placeholder="Full name *" value={researcherForm.fullName} onChange={(e) => setResearcherForm({ ...researcherForm, fullName: e.target.value })} />
          <input placeholder="Work email *" value={researcherForm.email} onChange={(e) => setResearcherForm({ ...researcherForm, email: e.target.value })} />
          <textarea rows={3} placeholder="Optional onboarding note for the invite email" value={researcherForm.notes} onChange={(e) => setResearcherForm({ ...researcherForm, notes: e.target.value })} />
          <button onClick={createInternalResearcher}>Invite Internal Researcher</button>
          {inviteLink ? (
            <div className="notice success">
              <strong>Invitation Sent</strong>
              <p>Invitation sent to {researcherForm.email || "the researcher"}. The researcher will receive an email with their account setup link.</p>
            </div>
          ) : null}
        </article>

        <article className="card">
          <h2>Internal Researcher Roster</h2>
          <p className="section-intro">Track your active internal bench and confirm each researcher is attached to the correct customer organization.</p>
          <div className="badge-stack">
            <button className={tab === "internal" ? "" : "ghost"} type="button" onClick={() => setTab("internal")}>Internal Researchers</button>
            <button className={tab === "external" ? "" : "ghost"} type="button" onClick={() => setTab("external")}>External Researchers</button>
          </div>
          <input placeholder="Search by name, handle, email, or skill" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="list compact">
            {visibleResearchers.map((r) => (
              <div key={r.id} className="list-row">
                <div>
                  <strong>{r.fullName}</strong>
                  <p>{r.handle} • {r.email}</p>
                  <p>{organizationNameById.get(Number(r.organizationId)) || `Organization #${r.organizationId}`} • {r.skills || "No skills"}</p>
                  <p>Acceptance rate: {Number(r.completedPrograms || 0) > 0 ? `${Math.min(100, 60 + Number(r.completedPrograms || 0) * 5)}%` : "New researcher"}</p>
                </div>
                <div className="badge-stack">
                  <StatusBadge status={r.status || "active"} />
                  <span className={`pill ${r.isInternal ? "internal" : "external"}`}>{r.isInternal ? "Internal" : "External"}</span>
                  <span className="metric-pill">{Number(r.avgRating || 0).toFixed(1)} stars</span>
                </div>
              </div>
            ))}
            {visibleResearchers.length === 0 && (
              <EmptyState
                compact
                icon="users"
                title={tab === "internal" ? "No internal researchers yet" : "No external researchers match this search"}
                description={tab === "internal"
                  ? "Create your first internal researcher here to start assigning organization requests."
                  : "External researchers will appear here for platform-wide visibility and review."}
              />
            )}
          </div>
        </article>
      </section>

      <section className="card">
        <h2>Researcher Identity Verification Queue</h2>
        <p className="section-intro">
          Review national ID and certification submissions from internal and external researchers before service access is unlocked.
        </p>
        <div className="list">
          {prioritizedQueue.map((item) => (
            (() => {
              const hasRequiredDocuments = Boolean(
                item?.verification?.nationalIdDocumentUrl && item?.verification?.certificationDocumentUrl,
              );
              const isReviewable = String(item?.verification?.status || "").toLowerCase() === "submitted" && hasRequiredDocuments;

              return (
                <article key={item.id} className="list-row">
                  <div className="stacked-copy">
                    <strong>
                      {item.firstName} {item.lastName}
                      {item.displayName ? ` (${item.displayName})` : ""}
                    </strong>
                    <p>{item.email}</p>
                    <p>Type: {item.researcherType} researcher</p>
                    <p>Submitted: {formatDateTime(item?.verification?.submittedAt)}</p>
                    <p>Country of issue: {item?.verification?.countryOfIssue || "Not provided"}</p>
                    <p>
                      National ID:{" "}
                      {item?.verification?.nationalIdDocumentUrl ? (
                        <a href={item.verification.nationalIdDocumentUrl} target="_blank" rel="noreferrer">
                          {item?.verification?.nationalIdDocumentName || "Open document"}
                        </a>
                      ) : "Missing"}
                    </p>
                    <p>
                      Certification:{" "}
                      {item?.verification?.certificationDocumentUrl ? (
                        <a href={item.verification.certificationDocumentUrl} target="_blank" rel="noreferrer">
                          {item?.verification?.certificationDocumentName || "Open document"}
                        </a>
                      ) : "Missing"}
                    </p>
                    <p>Summary: {item?.verification?.certificationsSummary || "No summary provided."}</p>
                  </div>
                  <div className="row-actions">
                    <div className="badge-stack">
                      <StatusBadge status={item?.verification?.status || "submitted"} />
                      <span className={`pill ${item.researcherType === "internal" ? "internal" : "external"}`}>
                        {item.researcherType}
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Reviewer notes"
                      value={reviewNotesByUserId[item.userId] ?? item?.verification?.reviewerNotes ?? ""}
                      onChange={(e) => setReviewNotesByUserId((prev) => ({ ...prev, [item.userId]: e.target.value }))}
                    />
                    {!isReviewable ? (
                      <p className="helper-text">Waiting for complete document submission before review.</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={activeReviewUserId === item.userId || !isReviewable}
                      onClick={() => void handleReview(item.userId, "approved")}
                    >
                      {activeReviewUserId === item.userId ? "Saving..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={activeReviewUserId === item.userId || !isReviewable}
                      onClick={() => void handleReview(item.userId, "rejected")}
                    >
                      Request Resubmission
                    </button>
                  </div>
                </article>
              );
            })()
          ))}

          {prioritizedQueue.length === 0 ? (
            <EmptyState
              compact
              icon="shield"
              title="No verification submissions yet"
              description="Researcher identity submissions will appear here when users upload national ID and certification documents."
            />
          ) : null}
        </div>
      </section>
    </>
  );
}
