import { useState } from "react";
import { signInWithPopup } from "firebase/auth";

import ThemeToggle from "../components/ThemeToggle";
import { auth, provider } from "../auth/firebase";
import { useTheme } from "../context/ThemeContext";

const font = {
  heading: "'Playfair Display', Georgia, serif",
  subhead: "'Nunito', 'Segoe UI', sans-serif",
  body: "'Inter', system-ui, sans-serif",
};

function DoctorIllustration() {
  return (
    <svg viewBox="0 0 400 380" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-sm">
      <circle cx="200" cy="190" r="160" fill="#e0f2fe" opacity="0.5" />
      <circle cx="280" cy="100" r="70" fill="#bae6fd" opacity="0.4" />
      <circle cx="110" cy="290" r="55" fill="#7dd3fc" opacity="0.35" />
      {[[48, 68], [345, 55], [30, 230], [370, 230], [190, 25], [200, 355]].map(([cx, cy], index) => (
        <g key={index} transform={`translate(${cx},${cy})`} fill="#0ea5e9" opacity="0.5">
          <rect x="-3" y="-10" width="6" height="20" rx="2" />
          <rect x="-10" y="-3" width="20" height="6" rx="2" />
        </g>
      ))}
      <rect x="145" y="160" width="110" height="130" rx="18" fill="#f0f9ff" />
      <polygon points="200,175 165,175 155,280 200,260" fill="white" />
      <polygon points="200,175 235,175 245,280 200,260" fill="white" />
      <path
        d="M175 190 Q160 225 175 245 Q190 265 200 250 Q210 265 225 245 Q240 225 225 190"
        fill="none"
        stroke="#0284c7"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="200" cy="252" r="8" fill="#0369a1" />
      <ellipse cx="200" cy="130" rx="42" ry="45" fill="#fcd7a0" />
      <ellipse cx="200" cy="92" rx="40" ry="18" fill="#c8956c" />
      <rect x="160" y="92" width="80" height="20" fill="#c8956c" />
      <ellipse cx="185" cy="128" rx="5" ry="6" fill="#7c4a2d" />
      <ellipse cx="215" cy="128" rx="5" ry="6" fill="#7c4a2d" />
      <path d="M188 145 Q200 157 212 145" fill="none" stroke="#c2410c" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="108" y="168" width="40" height="18" rx="9" fill="#f0f9ff" />
      <rect x="252" y="168" width="40" height="18" rx="9" fill="#f0f9ff" />
      <ellipse cx="105" cy="177" rx="13" ry="10" fill="#fcd7a0" />
      <ellipse cx="295" cy="177" rx="13" ry="10" fill="#fcd7a0" />
      <rect x="72" y="178" width="38" height="52" rx="5" fill="white" stroke="#7dd3fc" strokeWidth="2" />
      <rect x="79" y="186" width="24" height="3" rx="1.5" fill="#7dd3fc" />
      <rect x="79" y="194" width="20" height="3" rx="1.5" fill="#bae6fd" />
      <rect x="79" y="202" width="22" height="3" rx="1.5" fill="#bae6fd" />
      <rect x="79" y="210" width="18" height="3" rx="1.5" fill="#bae6fd" />
      <rect x="290" y="162" width="45" height="62" rx="6" fill="#0369a1" />
      <rect x="294" y="168" width="37" height="48" rx="3" fill="#bae6fd" />
      <polyline
        points="298,192 304,182 308,198 313,178 318,200 323,186 328,196 331,192"
        fill="none"
        stroke="#0369a1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="162" y="285" width="30" height="60" rx="10" fill="#c8956c" />
      <rect x="208" y="285" width="30" height="60" rx="10" fill="#c8956c" />
      <ellipse cx="177" cy="347" rx="20" ry="9" fill="#ffffff" />
      <ellipse cx="223" cy="347" rx="20" ry="9" fill="#ffffff" />
    </svg>
  );
}

export default function Login() {
  const { dark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed:", err);
      // Ignore common errors like popup closed by user or cancelled
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        setError(err.message || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const pageBackground = dark
    ? "linear-gradient(180deg, #020617 0%, #0f172a 48%, #111827 100%)"
    : "#f0f9ff";
  const cardBackground = dark ? "#0f172a" : "#ffffff";
  const cardBorder = dark ? "1px solid rgba(148, 163, 184, 0.22)" : "1px solid #bae6fd";
  const cardShadow = dark
    ? "0 22px 60px rgba(2, 6, 23, 0.48)"
    : "0 8px 40px rgba(3, 105, 161, 0.12)";
  const leftPanelBackground = dark
    ? "linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))"
    : "#ffffff";
  const headingColor = dark ? "#f8fafc" : "#1a3a5c";
  const brandColor = dark ? "#7dd3fc" : "#0369a1";
  const subheadingColor = dark ? "#38bdf8" : "#0369a1";
  const bodyColor = dark ? "#cbd5e1" : "#475569";
  const buttonBackground = dark ? "rgba(15, 23, 42, 0.92)" : "#ffffff";
  const buttonBorder = dark ? "1.5px solid rgba(125, 211, 252, 0.25)" : "1.5px solid #bae6fd";
  const buttonText = dark ? "#e0f2fe" : "#1a5276";
  const footerColor = dark ? "#94a3b8" : "#94a3b8";
  const rightPanelBackground = dark
    ? "linear-gradient(145deg, #0f172a 0%, #0f3a5f 45%, #0284c7 100%)"
    : "linear-gradient(145deg, #0369a1 0%, #0ea5e9 55%, #38bdf8 100%)";
  const badgeBackground = dark ? "rgba(15, 23, 42, 0.34)" : "rgba(255, 255, 255, 0.22)";
  const badgeBorder = dark ? "1px solid rgba(186, 230, 253, 0.2)" : "1px solid transparent";
  const featureChipBackground = dark ? "rgba(15, 23, 42, 0.32)" : "rgba(255, 255, 255, 0.2)";

  return (
    <div
      className="login-page flex items-center justify-center px-4 py-10"
      style={{ fontFamily: font.body, background: pageBackground }}
    >
      <ThemeToggle position="fixed-tr" />

      <div
        className="login-card flex w-full max-w-4xl overflow-hidden rounded-3xl"
        style={{
          background: cardBackground,
          boxShadow: cardShadow,
          border: cardBorder,
          transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        }}
      >
        <div
          className="flex w-full flex-col justify-center px-10 py-14 md:w-1/2"
          style={{
            background: leftPanelBackground,
            transition: "background 0.25s ease",
          }}
        >
          <div className="mb-10 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, #0ea5e9, #0369a1)" }}
            >
              <svg className="h-5 w-5" fill="none" stroke="#ffffff" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span
              style={{
                fontFamily: font.heading,
                fontSize: "1.5rem",
                fontWeight: 800,
                color: brandColor,
                letterSpacing: "-0.5px",
              }}
            >
              SAHAYI
            </span>
          </div>

          <h1
            style={{
              fontFamily: font.heading,
              fontSize: "2rem",
              fontWeight: 700,
              lineHeight: 1.25,
              color: headingColor,
              marginBottom: "0.5rem",
            }}
          >
            AI Health Assistant
          </h1>

          <p
            style={{
              fontFamily: font.subhead,
              fontSize: "0.95rem",
              fontWeight: 700,
              color: subheadingColor,
              marginBottom: "0.6rem",
              letterSpacing: "0.01em",
            }}
          >
            Doctor Portal - Secure Access
          </p>

          <p
            style={{
              fontFamily: font.body,
              fontSize: "0.85rem",
              fontWeight: 400,
              lineHeight: 1.75,
              color: bodyColor,
              marginBottom: "2rem",
            }}
          >
            A voice-based healthcare assistant helping elderly patients understand medicines, report symptoms,
            and keep doctors informed in real time.
          </p>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              fontFamily: font.subhead,
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              background: buttonBackground,
              border: buttonBorder,
              borderRadius: "1rem",
              padding: "0.875rem 1.25rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: buttonText,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: dark ? "0 8px 24px rgba(2, 6, 23, 0.28)" : "0 1px 3px rgba(0, 0, 0, 0.08)",
              transition: "background 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (loading) return;
              e.currentTarget.style.background = dark ? "#162033" : "#f0f9ff";
              e.currentTarget.style.boxShadow = dark
                ? "0 12px 30px rgba(2, 6, 23, 0.4)"
                : "0 4px 12px rgba(3, 105, 161, 0.12)";
            }}
            onMouseLeave={(e) => {
              if (loading) return;
              e.currentTarget.style.background = buttonBackground;
              e.currentTarget.style.boxShadow = dark
                ? "0 8px 24px rgba(2, 6, 23, 0.28)"
                : "0 1px 3px rgba(0, 0, 0, 0.08)";
            }}
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-sahayi-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.7 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35.3 26.8 36 24 36c-5.4 0-9.9-3.3-11.3-7.9l-6.6 5.1C9.6 39.5 16.4 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2.1 3.7-3.9 4.8l6.2 5.2C41 35.1 44 30 44 24c0-1.2-.1-2.4-.4-3.5z" />
              </svg>
            )}
            {loading ? "Signing in..." : "Sign in with Google"}
          </button>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-[11px] font-bold text-red-600">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <p
            style={{
              fontFamily: font.body,
              fontSize: "0.72rem",
              color: footerColor,
              marginTop: "1.75rem",
              textAlign: "center",
            }}
          >
            For authorised medical professionals only. Contact your administrator for access.
          </p>
        </div>

        <div
          className="login-right-panel hidden md:flex md:w-1/2 flex-col items-center justify-center px-8 py-12"
          style={{
            background: rightPanelBackground,
            transition: "background 0.25s ease",
          }}
        >
          <span
            style={{
              fontFamily: font.subhead,
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              background: badgeBackground,
              border: badgeBorder,
              color: "#ffffff",
              borderRadius: "999px",
              padding: "0.25rem 1rem",
              display: "inline-block",
              marginBottom: "0.75rem",
            }}
          >
            Doctor Portal
          </span>

          <h2
            style={{
              fontFamily: font.heading,
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.3,
              marginBottom: "0.4rem",
            }}
          >
            Patient Insights,
            <br />
            Right When You Need Them
          </h2>
          <p
            style={{
              fontFamily: font.body,
              fontSize: "0.78rem",
              color: "#bae6fd",
              marginBottom: "1.5rem",
              textAlign: "center",
            }}
          >
            Real-time alerts - Symptom summaries - Health trends
          </p>

          <DoctorIllustration />

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem", marginTop: "1.25rem" }}>
            {["Real-time Alerts", "Symptom Reports", "Medicine Assistant", "Health Trends"].map((feature) => (
              <span
                key={feature}
                style={{
                  fontFamily: font.subhead,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: featureChipBackground,
                  borderRadius: "999px",
                  padding: "0.25rem 0.75rem",
                }}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
