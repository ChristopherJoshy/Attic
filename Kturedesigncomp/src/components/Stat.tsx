import React from "react";
import { IconArrowUpRight, IconArrowDownRight, IconMinus } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type Trend = { dir: "up" | "down" | "flat"; label: string; tone?: "good" | "bad" | "neutral" };

const trendStyle: Record<string, string> = {
  good: "bg-success/10 text-success",
  bad: "bg-danger/10 text-danger",
  neutral: "bg-ink/[0.05] text-muted",
};

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: boolean;
  trend?: Trend;
  className?: string;
}> = ({ label, value, sub, icon, accent = false, trend, className = "" }) => {
  const TrendIcon = trend?.dir === "up" ? IconArrowUpRight : trend?.dir === "down" ? IconArrowDownRight : IconMinus;
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className={cn("text-[28px] leading-none font-semibold tracking-tight", accent ? "text-accent" : "text-ink")}>
          {value}
        </div>
        {trend && (
          <span className={cn("mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium", trendStyle[trend.tone ?? "neutral"])}>
            <TrendIcon size={11} />
            {trend.label}
          </span>
        )}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
};
