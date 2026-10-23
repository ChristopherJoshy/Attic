import React from "react";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/status";

const toneStyles: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  neutral: "bg-ink/[0.05] text-muted",
  accent: "bg-accent/10 text-accent",
};

export const StatusPill: React.FC<{
  status: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}> = ({ status, tone = "neutral", dot = false, className = "" }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap",
      toneStyles[tone],
      className
    )}
  >
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
    {status}
  </span>
);
