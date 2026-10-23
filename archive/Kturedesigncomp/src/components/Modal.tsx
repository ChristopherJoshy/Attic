import React from "react";
import { cn } from "../lib/cn";
import { IconX } from "@tabler/icons-react";

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}> = ({ open, onClose, children, title, size = "md", className = "" }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink/25 backdrop-blur-[2px] animate-[fade-up_0.2s_ease-out]" onClick={onClose} />
      <div
        className={cn(
          "relative bg-surface rounded-lg border border-line shadow-pop w-full overflow-hidden z-10 max-h-[90vh] flex flex-col",
          widths[size],
          className
        )}
      >
        {title && (
          <div className="flex items-start justify-between border-b border-line px-5 py-4">
            <div className="text-[15px] font-semibold text-ink pr-4">{title}</div>
            <button onClick={onClose} className="text-muted hover:text-ink p-1 -mr-1 rounded-md focus-ring" aria-label="Close">
              <IconX size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
