/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F6F7F9",
        surface: "#FFFFFF",
        ink: "#0E1B2A",
        "ink-soft": "#1B2A3A",
        body: "#3A4757",
        muted: "#8A93A3",
        faint: "#AEB6C2",
        line: "#EAECEF",
        "line-strong": "#DEE1E6",
        accent: "#0F766E",
        "accent-deep": "#0B5E57",
        "accent-soft": "#0D9488",
        gold: "#B07A2B",
        success: "#15803D",
        warning: "#B45309",
        danger: "#B91C1C",
        info: "#1D4ED8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,27,42,0.04), 0 1px 3px rgba(14,27,42,0.03)",
        "card-hover": "0 4px 16px -6px rgba(14,27,42,0.10), 0 2px 6px -2px rgba(14,27,42,0.05)",
        pop: "0 12px 40px -12px rgba(14,27,42,0.22)",
        focus: "0 0 0 4px rgba(15,118,110,0.12)",
      },
      letterSpacing: {
        tightish: "-0.011em",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-up": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.4s ease-out both",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
