"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BANNER_SMALL } from "@/lib/ascii";

export function AsciiBanner({ className }: { className?: string }) {
  return (
    <pre
      className={cn(
        "text-primary glow leading-none whitespace-pre overflow-x-auto terminal-scroll",
        className
      )}
      aria-label="UNTANGLE"
    >
      {BANNER_SMALL}
    </pre>
  );
}

export function Panel({
  title,
  children,
  className,
  right,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <div className={cn("ascii-box bg-card/40 backdrop-blur-sm", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-primary/5">
          <span className="text-xs tracking-widest text-primary/80 uppercase">
            {title}
          </span>
          {right}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}

export function Tag({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "dim";
}) {
  const tones: Record<string, string> = {
    green: "text-primary border-primary/40 bg-primary/5",
    amber: "text-[var(--amber)] border-[var(--amber)]/40 bg-[var(--amber)]/5",
    red: "text-destructive border-destructive/40 bg-destructive/5",
    dim: "text-[var(--dim)] border-border",
  };
  return (
    <span
      className={cn(
        "inline-block border px-1.5 py-0.5 text-[10px] tracking-widest uppercase",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function Rule({ label }: { label?: string }) {
  if (!label) return <div className="h-px w-full bg-border my-2" />;
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] tracking-widest text-[var(--dim)] uppercase">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function PromptLine({
  children,
  symbol = ">",
}: {
  children: ReactNode;
  symbol?: string;
}) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-primary glow shrink-0">{symbol}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
