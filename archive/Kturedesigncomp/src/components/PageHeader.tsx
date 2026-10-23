import React from "react";
import { cn } from "../lib/cn";

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, className = "" }) => (
  <header className={cn("mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4", className)}>
    <div>
      <h1 className="text-[26px] font-serif font-semibold text-ink tracking-tight">{title}</h1>
      {subtitle && <p className="text-body text-sm mt-1.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </header>
);
