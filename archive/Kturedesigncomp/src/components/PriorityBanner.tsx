import React from "react";
import { useNavigate } from "react-router-dom";
import { IconAlertTriangle, IconArrowRight, IconCircleCheck } from "@tabler/icons-react";
import { cn } from "../lib/cn";

export type Priority = {
  id: string;
  title: string;
  detail: string;
  tone: "warning" | "danger" | "info";
  to?: string;
  cta?: string;
};

const toneStyle: Record<string, string> = {
  warning: "border-warning/25 bg-warning/[0.06]",
  danger: "border-danger/25 bg-danger/[0.06]",
  info: "border-accent/25 bg-accent/[0.06]",
};

const toneIcon: Record<string, string> = {
  warning: "text-warning",
  danger: "text-danger",
  info: "text-accent",
};

export const PriorityBanner: React.FC<{ items: Priority[] }> = ({ items }) => {
  const navigate = useNavigate();
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-pop border border-success/25 bg-success/[0.06] px-4 py-3 text-sm text-success">
        <IconCircleCheck size={18} />
        <span className="font-medium">All clear — nothing needs your attention right now.</span>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 3).map((it) => (
        <div key={it.id} className={cn("flex items-center gap-3 rounded-pop border px-4 py-3", toneStyle[it.tone])}>
          <IconAlertTriangle size={18} className={cn("shrink-0", toneIcon[it.tone])} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink truncate">{it.title}</div>
            <div className="text-xs text-muted truncate">{it.detail}</div>
          </div>
          {it.to && (
            <button
              onClick={() => navigate(it.to!)}
              className="shrink-0 text-xs font-medium text-ink hover:text-accent inline-flex items-center gap-1 focus-ring rounded-md px-1 py-0.5"
            >
              {it.cta ?? "Resolve"} <IconArrowRight size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
