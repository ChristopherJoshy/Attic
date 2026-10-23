export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

export function toneForStatus(status: string): Tone {
  const s = status.toLowerCase();
  if (["paid", "registered", "completed", "passed", "ready", "active", "resolved", "enrolled", "cleared"].includes(s))
    return "success";
  if (["unpaid", "pending", "processing", "under review", "in progress", "open", "closed", "fail", "absent"].includes(s))
    return s === "closed" ? "neutral" : s.includes("fail") || s === "absent" ? "danger" : "warning";
  return "neutral";
}
