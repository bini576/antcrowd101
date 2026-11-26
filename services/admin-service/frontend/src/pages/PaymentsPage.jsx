import { useEffect, useMemo, useState } from "react";
import { EmptyState, SeverityBadge, StatusBadge } from "../components/shared/PortalUI";
import { bugBountyApi } from "../services/bugBountyApi";
import { penTestApi } from "../services/penTestApi";

function currency(value) {
  return `${Number(value || 0).toLocaleString()} ETB`;
}

export default function PaymentsPage({ findings = [], updateFindingReview }) {
  const [referenceByFinding, setReferenceByFinding] = useState({});
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [payoutError, setPayoutError] = useState("");
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [noteModal, setNoteModal] = useState(null);
  const [adminNote, setAdminNote] = useState("");

  // Pen Test payment state
  const [penPayments, setPenPayments] = useState([]);
  const [penPayError, setPenPayError] = useState("");
  const [penPayLoading, setPenPayLoading] = useState(true);
  const [penRefById, setPenRefById] = useState({});
  const [penBountyById, setPenBountyById] = useState({});
  const [penToast, setPenToast] = useState("");

  const payoutCandidates = useMemo(
    () => findings.filter((item) => ["accepted", "paid"].includes(String(item.status || "").toLowerCase())),
    [findings],
  );

  const totalAuthorized = payoutCandidates
    .filter((item) => String(item.status || "").toLowerCase() === "paid")
    .reduce((sum, item) => sum + Number(item.bounty || 0), 0);

  const totalPending = payoutCandidates
    .filter((item) => String(item.status || "").toLowerCase() === "accepted")
    .reduce((sum, item) => sum + Number(item.bounty || 0), 0);

  const penTotalAuthorized = penPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.bounty || 0), 0);

  const penTotalPending = penPayments
    .filter((p) => ["accepted", "in_fix", "retesting", "triaged"].includes(p.status))
    .reduce((sum, p) => sum + Number(p.bounty || 0), 0);

  const penNewCount = penPayments.filter((p) => p.status === "new").length;
  const penPendingCount = penPayments.filter((p) => !(["new", "paid", "duplicate", "informative"].includes(p.status))).length;
  const penAuthorizedCount = penPayments.filter((p) => p.status === "paid").length;

  async function authorizePayout(finding) {
    await updateFindingReview(
      finding.id,
      {
        status: "paid",
        bounty: Number(finding.bounty || 0),
        reviewComment: finding.reviewComment || "",
        paymentReference: referenceByFinding[finding.id] || finding.paymentReference || "",
      },
      `Payout authorized for ${finding.title}.`,
    );
  }

  async function loadPayoutRequests() {
    setPayoutLoading(true);
    setPayoutError("");
    try {
      const payload = await bugBountyApi.payoutRequests();
      setPayoutRequests(payload.items || []);
    } catch (error) {
      setPayoutError(error.message || "Unable to load payout requests.");
    } finally {
      setPayoutLoading(false);
    }
  }

  async function loadPenPayments() {
    setPenPayLoading(true);
    setPenPayError("");
    try {
      const payload = await penTestApi.paymentRequests();
      setPenPayments(payload.items || []);
    } catch (error) {
      setPenPayError(error.message || "Unable to load pen-test payment requests.");
    } finally {
      setPenPayLoading(false);
    }
  }

  async function authorizePenPayment(id) {
    try {
      const bounty = penBountyById[id];
      await penTestApi.authorizePayment(id, penRefById[id] || "", bounty !== undefined && bounty !== "" ? bounty : null);
      setPenToast("Payment authorized — researcher earnings updated.");
      await loadPenPayments();
    } catch (err) {
      setPenToast(err.message || "Authorization failed.");
    }
  }

  useEffect(() => {
    loadPayoutRequests();
    loadPenPayments();
  }, []);

  useEffect(() => {
    if (!penToast) return;
    const t = setTimeout(() => setPenToast(""), 3500);
    return () => clearTimeout(t);
  }, [penToast]);

  async function runPayoutAction() {
    if (!noteModal) return;
    if (noteModal.action === "approve") await bugBountyApi.approvePayout(noteModal.id, adminNote);
    if (noteModal.action === "reject") await bugBountyApi.rejectPayout(noteModal.id, adminNote);
    if (noteModal.action === "paid") await bugBountyApi.markPayoutPaid(noteModal.id, adminNote);
    setNoteModal(null);
    setAdminNote("");
    await loadPayoutRequests();
  }

  function openNoteModal(id, action) {
    setNoteModal({ id, action });
    setAdminNote("");
  }

  return (
    <>
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Researcher Payout Requests</h2>
            <p className="section-intro">
              Review bug bounty withdrawal requests, capture finance notes, and move approved requests to paid.
            </p>
          </div>
          <button type="button" className="ghost" onClick={loadPayoutRequests}>Refresh</button>
        </div>

        {payoutError ? <div className="notice error">{payoutError}</div> : null}

        <div className="review-table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <th>Researcher</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Account Details</th>
                <th>Status</th>
                <th>Admin Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payoutRequests.map((item) => (
                <tr key={item.id}>
                  <td>{item.researcherName || item.username}</td>
                  <td>{currency(item.amount)}</td>
                  <td>{String(item.paymentMethod || "").replace("-", " ")}</td>
                  <td>
                    <pre className="json-cell">{JSON.stringify(item.accountDetails || {}, null, 2)}</pre>
                  </td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>{item.adminNote || "—"}</td>
                  <td>
                    <div className="inline-actions">
                      {item.status === "pending" ? (
                        <>
                          <button type="button" className="ghost" onClick={() => openNoteModal(item.id, "approve")}>Approve</button>
                          <button type="button" className="danger" onClick={() => openNoteModal(item.id, "reject")}>Reject</button>
                        </>
                      ) : null}
                      {["pending", "approved"].includes(item.status) ? (
                        <button type="button" className="accent" onClick={() => openNoteModal(item.id, "paid")}>Mark paid</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!payoutLoading && payoutRequests.length === 0 ? (
          <EmptyState
            compact
            icon="inbox"
            title="No payout requests yet"
            description="Researcher withdrawal requests from Bug Bounty will appear here."
          />
        ) : null}
      </section>

      <section className="kpi-grid">
        <article className="kpi"><span>BB Pending Payout</span><strong>{currency(totalPending)}</strong></article>
        <article className="kpi"><span>BB Authorized Payout</span><strong>{currency(totalAuthorized)}</strong></article>
        <article className="kpi"><span>Pen Test New Reports</span><strong>{penNewCount}</strong></article>
        <article className="kpi"><span>Pen Test In Review</span><strong>{penPendingCount}</strong></article>
        <article className="kpi"><span>Pen Test Authorized</span><strong>{currency(penTotalAuthorized)} ({penAuthorizedCount})</strong></article>
        <article className="kpi"><span>Pen Test Value Pending</span><strong>{currency(penTotalPending)}</strong></article>
      </section>

      <section className="card">
        <h2>Bounty Payments</h2>
        <p className="section-intro">
          Authorize payouts for accepted findings and keep payment references audit-ready.
        </p>

        <div className="review-table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Finding</th>
                <th>Researcher</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Bounty</th>
                <th>Reference</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payoutCandidates.map((finding) => (
                <tr key={finding.id}>
                  <td>{finding.jobTitle}</td>
                  <td>{finding.title}</td>
                  <td>{finding.submittedBy || "Researcher"}</td>
                  <td><SeverityBadge severity={finding.severity} /></td>
                  <td><StatusBadge status={finding.status} /></td>
                  <td>{currency(finding.bounty)}</td>
                  <td>
                    <input
                      placeholder="Payment reference"
                      value={referenceByFinding[finding.id] ?? finding.paymentReference ?? ""}
                      onChange={(event) =>
                        setReferenceByFinding((prev) => ({ ...prev, [finding.id]: event.target.value }))
                      }
                    />
                  </td>
                  <td>
                    {finding.status === "paid" ? (
                      <span className="metric-pill">Authorized</span>
                    ) : (
                      <button type="button" className="ghost" onClick={() => authorizePayout(finding)}>
                        Authorize
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payoutCandidates.length === 0 ? (
          <EmptyState
            compact
            icon="inbox"
            title="No payout-ready findings yet"
            description="Accepted findings with bounty values will appear here for payout authorization."
          />
        ) : null}
      </section>

      {/* ── Pen Test Payments ── */}
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Pen Test Payments</h2>
            <p className="section-intro">
              All submitted pen-test findings appear here. Set a prize amount and authorize
              payment to credit the researcher’s earnings immediately.
            </p>
          </div>
          <button type="button" className="ghost" onClick={loadPenPayments}>Refresh</button>
        </div>

        {penToast ? <div className="notice info">{penToast}</div> : null}
        {penPayError ? <div className="notice error">{penPayError}</div> : null}

        <div className="review-table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <th>Researcher</th>
                <th>Engagement</th>
                <th>Finding</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Prize (ETB)</th>
                <th>Reference</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {penPayments.map((p) => (
                <tr key={p.id}>
                  <td>{p.submittedBy || "—"}</td>
                  <td>{p.engagementTitle || "—"}</td>
                  <td>{p.title}</td>
                  <td><SeverityBadge severity={p.severity} /></td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    {p.status === "paid" ? (
                      <span>{currency(p.bounty)}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        placeholder={p.bounty > 0 ? String(p.bounty) : "Enter amount"}
                        value={penBountyById[p.id] ?? (p.bounty > 0 ? p.bounty : "")}
                        onChange={(e) => setPenBountyById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        style={{ width: "110px" }}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      placeholder="Payment ref"
                      value={penRefById[p.id] ?? p.paymentReference ?? ""}
                      onChange={(e) => setPenRefById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                  </td>
                  <td>
                    {p.status === "paid" ? (
                      <span className="metric-pill">Authorized</span>
                    ) : (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => authorizePenPayment(p.id)}
                        disabled={!(penBountyById[p.id] > 0 || p.bounty > 0)}
                        title={!(penBountyById[p.id] > 0 || p.bounty > 0) ? "Enter a prize amount first" : ""}
                      >
                        Authorize Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!penPayLoading && penPayments.length === 0 ? (
          <EmptyState
            compact
            icon="inbox"
            title="No pen-test reports yet"
            description="Submitted pen-test findings will appear here for review and payment authorization."
          />
        ) : null}
      </section>

      {noteModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{noteModal.action === "paid" ? "Mark payout as paid" : `${noteModal.action} payout request`}</h3>
            <p className="muted">Add an optional admin note before confirming this payout action.</p>
            <textarea
              rows={4}
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              placeholder="Finance reference, rejection reason, or internal note"
            />
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setNoteModal(null)}>Cancel</button>
              <button type="button" className="accent" onClick={runPayoutAction}>Confirm</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
