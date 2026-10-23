import { useTheme } from "../context/ThemeContext";

function SunIcon({ active }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.55, transition: "opacity 0.2s ease" }}
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ active }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.55, transition: "opacity 0.2s ease" }}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function ThemeToggle({ position = "fixed-tr" }) {
  const { dark, toggle } = useTheme();

  const posStyle =
    position === "fixed-tr"
      ? { position: "fixed", top: "1.25rem", right: "1.25rem", zIndex: 999 }
      : {};

  const trackBackground = dark
    ? "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92))"
    : "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(224,242,254,0.94))";
  const trackBorder = dark ? "1px solid rgba(148,163,184,0.2)" : "1px solid rgba(14,165,233,0.22)";
  const trackColor = dark ? "#cbd5e1" : "#0369a1";
  const thumbBackground = dark
    ? "linear-gradient(135deg, #38bdf8, #0f172a)"
    : "linear-gradient(135deg, #facc15, #fb7185)";
  const baseShadow = dark
    ? "0 10px 28px rgba(2,6,23,0.4)"
    : "0 10px 24px rgba(14,116,144,0.18)";

  // Toggle thumb position: dark left, light right
  const thumbPosition = dark ? "0.15rem" : "calc(100% - 2.1rem)";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        ...posStyle,
        position: posStyle.position ?? "relative",
        width: "4.75rem",
        height: "2.5rem",
        padding: "0.25rem",
        borderRadius: "999px",
        border: trackBorder,
        background: trackBackground,
        color: trackColor,
        cursor: "pointer",
        backdropFilter: "blur(14px)",
        boxShadow: baseShadow,
        transition: "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = dark
          ? "0 14px 34px rgba(2,6,23,0.48)"
          : "0 14px 30px rgba(14,116,144,0.24)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = baseShadow;
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "0 0.3rem",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SunIcon active={!dark} />
        </span>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MoonIcon active={dark} />
        </span>
        <span
          style={{
            position: "absolute",
            top: "0.15rem",
            left: thumbPosition,
            width: "1.9rem",
            height: "1.9rem",
            borderRadius: "999px",
            background: thumbBackground,
            boxShadow: dark
              ? "0 6px 18px rgba(14,165,233,0.28)"
              : "0 6px 18px rgba(251,191,36,0.38)",
            transition: "left 0.24s ease, background 0.24s ease, box-shadow 0.24s ease",
          }}
        />
      </span>
    </button>
  );
}
