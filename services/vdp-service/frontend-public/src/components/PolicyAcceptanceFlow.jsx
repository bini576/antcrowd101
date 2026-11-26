import { useState } from "react";
import api from "../services/api";

export default function PolicyAcceptanceFlow({ procedureId }) {
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    setError("");
    try {
      await api.post(`/procedures/${procedureId}/accept`);
      setAccepted(true);
    } catch {
      setError("Unable to accept policy");
    }
  };

  if (!procedureId) return <div>Missing procedure</div>;

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={accept}
        disabled={accepted}
        style={{ padding: "10px 16px", fontWeight: 600 }}
      >
        {accepted ? "Policy Accepted" : "Accept Policy"}
      </button>
      {error && <div style={{ color: "#b00020", marginTop: 8 }}>{error}</div>}
    </div>
  );
}
