import { LogOut } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle.jsx";

/**
 * Settings page: account and session options (e.g. logout).
 * @param {{ onLogout: () => void }} props
 * @returns {JSX.Element} Rendered settings page.
 */
export default function Settings({ onLogout }) {
  return (
    <div className="w-full space-y-8 pb-12 animate-slideIn">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Account and application preferences</p>
      </div>

      <section className="rounded-[28px] border border-white/50 bg-white/72 p-6 shadow-card backdrop-blur-xl">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400 mb-4">Theme</h2>
        <div className="mb-6">
          <p className="text-sm text-slate-600 mb-2">Switch between light and dark mode.</p>
          <ThemeToggle position="relative" />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400 mb-4">Account</h2>
        <p className="text-sm text-slate-600 mb-6">Sign out of your doctor account on this device.</p>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 rounded-xl bg-red-50 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-100 transition"
        >
          <LogOut size={18} strokeWidth={3} />
          Logout
        </button>
      </section>
    </div>
  );
}
