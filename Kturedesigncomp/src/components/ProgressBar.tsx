import React from "react";
import { cn } from "../lib/cn";

const toneBar: Record<string, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  ink: "bg-ink",
};

export const ProgressBar: React.FC<{
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  tone?: "accent" | "success" | "warning" | "danger" | "info" | "ink";
  showTrack?: boolean;
}> = ({ value, max = 100, className = "", barClassName = "", tone = "accent", showTrack = true }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      className={cn("h-1.5 w-full rounded-full overflow-hidden", showTrack && "bg-ink/[0.06]", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out-expo", toneBar[tone], barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
