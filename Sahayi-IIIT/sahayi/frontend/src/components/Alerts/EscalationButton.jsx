/**
 * Button that triggers the family alert escalation flow.
 * @param {{ patientId: number }} props Component props.
 * @returns {JSX.Element} Rendered escalation button.
 */
import { useState } from "react";

import { sahayiApi } from "../../api/sahayi";

export default function EscalationButton({ patientId }) {
  const [status, setStatus] = useState("idle");

  async function handleEscalate() {
    setStatus("loading");
    try {
      await sahayiApi.escalatePatient(patientId);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button className="rounded-2xl bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/25" onClick={handleEscalate}>
      {status === "loading" ? "Escalating..." : status === "sent" ? "Alert Sent" : status === "error" ? "Retry Alert" : "Escalate to Family"}
    </button>
  );
}
