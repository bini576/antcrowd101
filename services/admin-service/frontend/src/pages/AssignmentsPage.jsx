import { EmptyState, StatusBadge } from "../components/shared/PortalUI";

export default function AssignmentsPage({ pendingInternalRequests, internalResearchers, internalRequests, adminAssigneeByRequest, setAdminAssigneeByRequest, assignInternal }) {
  return (
    <section className="card">
      <h2>Internal Assignment Queue ({pendingInternalRequests.length} pending)</h2>
      <p className="section-intro">Keep the internal queue moving by matching open requests with the right in-house researcher as soon as they are triage-ready.</p>
      {internalResearchers.length === 0 && <p className="notice error">No internal researchers are available yet. Create one in the Researchers tab first.</p>}
      <div className="list compact">
        {internalRequests.map((req) => (
          <div key={req.id} className="list-row">
            <div>
              <strong>{req.engagementName}</strong>
              <div className="badge-stack">
                <StatusBadge status={req.status} />
              </div>
              <p>Assigned researcher: {req.assignedResearcher || "Not assigned yet"}</p>
            </div>
            {req.status !== "assigned" && (
              <div className="row-actions">
                <select value={adminAssigneeByRequest[req.id] || (internalResearchers[0]?.id || "")} onChange={(e) => setAdminAssigneeByRequest({ ...adminAssigneeByRequest, [req.id]: e.target.value })}>
                  <option value="">Choose an internal researcher</option>
                  {internalResearchers.map((r) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
                </select>
                <button onClick={() => assignInternal(req.id)} disabled={internalResearchers.length === 0}>Assign</button>
              </div>
            )}
          </div>
        ))}
        {internalRequests.length === 0 && (
          <EmptyState
            compact
            icon="inbox"
            title="No internal requests in queue"
            description="New internal assignment requests will appear here as soon as organizations send them for review."
          />
        )}
      </div>
    </section>
  );
}
