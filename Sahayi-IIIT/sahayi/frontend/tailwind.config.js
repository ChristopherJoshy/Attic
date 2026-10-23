/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // only activate dark mode with .dark class, never from OS preference
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        sahayi: {
          base: "#f8fafc",
          primary: "#2563eb",
          secondary: "#64748b",
          accent: "#3b82f6",
          surface: "#ffffff",
          border: "#e2e8f0",
          green: "#10b981",
          yellow: "#f59e0b",
          red: "#ef4444",
        },
      },
      boxShadow: {
        medical: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "medical-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      },
      animation: {
        pulseRing: "pulseRing 1.8s ease-out infinite",
        slideIn: "slideIn 0.4s ease-out",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.9" },
          "70%": { transform: "scale(1.18)", opacity: "0.08" },
          "100%": { transform: "scale(1.18)", opacity: "0" },
        },
        slideIn: {
          "0%": { transform: "translateY(18px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
