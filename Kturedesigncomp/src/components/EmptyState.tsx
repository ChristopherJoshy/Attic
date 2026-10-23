import React from "react";
import { cn } from "../lib/cn";

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className = "" }) => (
  <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
    {icon && <div className="mb-3 text-muted">{icon}</div>}
    <h3 className="text-base font-semibold text-ink">{title}</h3>
    {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
