import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const prefersReduced = typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
      }}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-40 btn-cosmic rounded-full shadow-lg focus-cosmic flex items-center gap-2 px-4 py-3"
    >
      <ArrowUp className="w-4 h-4 text-white" />
      <span className="hidden sm:inline text-white">Top</span>
    </button>
  );
}
