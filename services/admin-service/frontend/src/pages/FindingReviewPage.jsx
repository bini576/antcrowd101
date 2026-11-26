import FindingReviewBoard from "../components/shared/FindingReviewBoard";

export default function FindingReviewPage({ findings, updateFindingReview }) {
  return (
    <FindingReviewBoard
      title="Platform Finding Review"
      findings={findings}
      onUpdateFinding={updateFindingReview}
      successMessage={(status, finding, actionForm) => {
        if (status === "accepted") return `Accepted ${finding.title}${actionForm.bounty ? ` with ${actionForm.bounty} ETB bounty.` : "."}`;
        if (status === "paid") return `Payout authorized for ${finding.title}.`;
        if (status === "retesting") return `Retest requested for ${finding.title}.`;
        if (status === "rejected") return `Rejected ${finding.title}.`;
        return `Updated ${finding.title}.`;
      }}
    />
  );
}
