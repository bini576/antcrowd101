import { useMemo, useState } from "react";
import { EmptyState, StatusBadge } from "../components/shared/PortalUI";

function organizationSummary(organization, researchers, internalRequests) {
  const relatedResearchers = (researchers || []).filter((item) => Number(item.organizationId) === Number(organization.id));
  const openRequests = (internalRequests || []).filter(
    (item) => Number(item.organizationId) === Number(organization.id) && item.status !== "assigned",
  );
  return {
    researcherCount: relatedResearchers.length,
    internalCount: relatedResearchers.filter((item) => item.isInternal).length,
    externalCount: relatedResearchers.filter((item) => !item.isInternal).length,
    openRequests: openRequests.length,
  };
}

function formatDateTime(value) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function OrganizationsPage({
  organizations = [],
  researchers = [],
  internalRequests = [],
  approvalQueue = [],
  reviewOrganizationApproval,
}) {
  const [reviewNotesByOrganizationId, setReviewNotesByOrganizationId] = useState({});
  const [activeOrganizationId, setActiveOrganizationId] = useState("");

  async function handleReview(organizationId, status) {
    if (typeof reviewOrganizationApproval !== "function") return;
    setActiveOrganizationId(organizationId);
    try {
      await reviewOrganizationApproval(organizationId, status, reviewNotesByOrganizationId[organizationId] || "");
    } finally {
      setActiveOrganizationId("");
    }
  }

  const prioritizedApprovalQueue = useMemo(() => {
    const rank = { submitted: 0, rejected: 1, approved: 2, not_required: 3 };
    return [...approvalQueue].sort((a, b) => {
      const statusA = String(a.approvalStatus || a.ownerApprovalStatus || "").toLowerCase();
      const statusB = String(b.approvalStatus || b.ownerApprovalStatus || "").toLowerCase();
      const rankA = Object.prototype.hasOwnProperty.call(rank, statusA) ? rank[statusA] : 4;
      const rankB = Object.prototype.hasOwnProperty.call(rank, statusB) ? rank[statusB] : 4;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [approvalQueue]);

  return (
    <section className="grid two">
      <article className="card">
        <h2>Organizations</h2>
        <p className="section-intro">
          Portfolio-level view of organizations, mapped researchers, and open assignment pressure.
        </p>
        <div className="list">
          {organizations.map((organization) => {
            const summary = organizationSummary(organization, researchers, internalRequests);
            return (
              <article key={organization.id} className="list-row">
                <div>
                  <strong>{organization.name}</strong>
                  <p>Org ID: {organization.id}</p>
                  <p>Researchers: {summary.researcherCount} ({summary.internalCount} internal, {summary.externalCount} external)</p>
                  <p>Open internal requests: {summary.openRequests}</p>
                </div>
                <div className="badge-stack">
                  <StatusBadge status={summary.openRequests > 0 ? "pending" : "active"} />
                  <span className="metric-pill">#{organization.id}</span>
                </div>
              </article>
            );
          })}
          {organizations.length === 0 ? (
            <EmptyState
              compact
              icon="inbox"
              title="No organizations found"
              description="Organization records will appear after onboarding is completed."
            />
          ) : null}
        </div>
      </article>

      <article className="card">
        <h2>Organization Access Approval Queue</h2>
        <p className="section-intro">
          Approve new organization registrations before owner access is enabled across pentesting, VDP, and training services.
        </p>
        <div className="list">
          {prioritizedApprovalQueue.map((organization) => (
            <article key={organization.id} className="list-row">
              <div className="stacked-copy">
                <strong>{organization.name}</strong>
                <p>Owner: {organization.ownerName || "Unknown"} • {organization.ownerEmail || organization.billingEmail}</p>
                <p>Website: {organization.website || "Not provided"}</p>
                <p>Members: {Number(organization.memberCount || 0)}</p>
                <p>Created: {formatDateTime(organization.createdAt)}</p>
              </div>
              <div className="row-actions">
                <div className="badge-stack">
                  <StatusBadge status={organization.approvalStatus || organization.ownerApprovalStatus || "submitted"} />
                </div>
                <textarea
                  rows={3}
                  placeholder="Reviewer notes"
                  value={reviewNotesByOrganizationId[organization.id] || ""}
                  onChange={(e) => setReviewNotesByOrganizationId((prev) => ({ ...prev, [organization.id]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={activeOrganizationId === organization.id}
                  onClick={() => void handleReview(organization.id, "approved")}
                >
                  {activeOrganizationId === organization.id ? "Saving..." : "Approve Organization"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={activeOrganizationId === organization.id}
                  onClick={() => void handleReview(organization.id, "rejected")}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
          {prioritizedApprovalQueue.length === 0 ? (
            <EmptyState
              compact
              icon="shield"
              title="No organization approvals pending"
              description="New organization registrations will appear here for platform-admin review."
            />
          ) : null}
        </div>
      </article>
    </section>
  );
}
