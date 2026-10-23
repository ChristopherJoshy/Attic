import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { IconAlertCircle, IconArrowRight, IconShieldCheck } from "@tabler/icons-react";
import { cn } from "../lib/cn";
import { PageLoader } from "../components/AsciiLoader";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Enter your register number and password to continue.");
      return;
    }
    setLoading(true);
    setTimeout(() => { navigate("/dashboard"); }, 900);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface">
      <div className="relative lg:w-[42%] xl:w-[40%] p-8 md:p-12 lg:p-16 flex flex-col justify-between overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 bg-grid opacity-[0.07] pointer-events-none" aria-hidden />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <img src="/logo.png" alt="KTU" className="w-6 h-6 object-contain" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">KTU Student Portal</span>
        </div>

        <div className="relative max-w-md my-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-accent/15 text-accent-deep mb-6">
              <IconShieldCheck size={14} /> APJ Abdul Kalam Technological University
            </span>
            <h1 className="text-4xl md:text-[42px] font-semibold leading-[1.12] tracking-tight">
              Your academics,<br />in one place.
            </h1>
            <p className="text-white/65 text-[15px] mt-5 leading-relaxed max-w-sm">
              Results, attendance, exam registration, fees and Suraksha — organised the way you actually use them.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-12 lg:p-16 bg-surface">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 rounded-lg bg-ink flex items-center justify-center"><img src="/logo.png" alt="KTU" className="w-6 h-6 object-contain" /></div>
            <span className="font-semibold text-ink">KTU</span>
          </div>

          <h2 className="text-2xl font-semibold text-ink">Sign in</h2>
          <p className="text-body text-sm mt-1.5 mb-8">Welcome back. Continue to your portal.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-medium text-ink">Register number</label>
              <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} spellCheck={false} className={cn("input-field", error && "border-danger/50 focus:border-danger/60")} placeholder="KTU21CS045" autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-ink">Password</label>
                <button type="button" className="text-xs text-accent hover:underline">Forgot?</button>
              </div>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} spellCheck={false} className={cn("input-field", error && "border-danger/50 focus:border-danger/60")} placeholder="••••••••" autoComplete="current-password" />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-[10px] px-3 py-2.5">
                <IconAlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 disabled:opacity-70">
              {loading ? "Signing in" : "Sign in"} {!loading && <IconArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-6 rounded-[10px] bg-ink/[0.03] border border-line px-3.5 py-3 text-xs text-muted">
            <span className="font-medium text-body">Demo —</span> any register number and password works. This is a portal prototype with sample data.
          </div>
        </motion.div>
      </div>
      <PageLoader show={loading} label="Getting your info" />
    </div>
  );
};
