import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/cn";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type Variant = "page" | "inline" | "compact";

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const AsciiLoader: React.FC<{ variant?: Variant; label?: string; className?: string }> = ({
  variant = "inline",
  label = "Getting your info",
  className = "",
}) => {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => window.clearInterval(id);
  }, []);

  const spinner = (
    <span className="text-accent font-mono tabular-nums" aria-hidden="true">
      {FRAMES[frame]}
    </span>
  );

  if (variant === "compact") {
    return (
      <motion.span
        {...fade}
        transition={{ duration: 0.15 }}
        role="status"
        aria-label={label}
        className={cn("inline-flex items-center", className)}
      >
        {spinner}
      </motion.span>
    );
  }

  const body = (
    <div className="flex items-center gap-2 text-sm text-muted">
      {spinner}
      <span>{label}…</span>
    </div>
  );

  if (variant === "page") {
    return (
      <motion.div
        {...fade}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas"
      >
        {body}
      </motion.div>
    );
  }

  return (
    <motion.div
      {...fade}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center py-6", className)}
    >
      {body}
    </motion.div>
  );
};

/** Full-screen page loader that fades in/out smoothly based on `show`. */
export const PageLoader: React.FC<{ show: boolean; label?: string }> = ({ show, label = "Getting your info" }) => (
  <AnimatePresence>
    {show && <AsciiLoader key="page-loader" variant="page" label={label} />}
  </AnimatePresence>
);

/** Inline loader (with label) that fades in/out smoothly based on `show`. */
export const InlineLoader: React.FC<{ show: boolean; label?: string; className?: string }> = ({
  show,
  label = "Getting your info",
  className,
}) => (
  <AnimatePresence>
    {show && <AsciiLoader key="inline-loader" variant="inline" label={label} className={className} />}
  </AnimatePresence>
);

/** Compact spinner (just the animated glyph) for buttons. */
export const Spinner: React.FC<{ show?: boolean; label?: string; className?: string }> = ({
  show = true,
  label = "Loading",
  className,
}) => (
  <AnimatePresence>
    {show && <AsciiLoader key="spinner" variant="compact" label={label} className={className} />}
  </AnimatePresence>
);
