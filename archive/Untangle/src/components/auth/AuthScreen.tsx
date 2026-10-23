"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { api, CurrentUser } from "@/lib/api";
import { useApp } from "@/store/app";
import { useToast } from "@/hooks/use-toast";
import { BANNER } from "@/lib/ascii";
import { Panel } from "@/components/ascii";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useApp();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { username, password }
          : { username, password, displayName };
      const res = await api<{ user: CurrentUser }>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(res.user);
      toast({ title: `welcome, ${res.user.username}` });
    } catch (err) {
      toast({
        title: "auth failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <pre className="text-primary glow leading-none text-[10px] sm:text-xs whitespace-pre overflow-x-auto terminal-scroll mb-4 text-center">
          {BANNER}
        </pre>
        <p className="text-center text-[var(--dim)] text-xs tracking-[0.3em] mb-6 uppercase">
          shared expense ledger // v1.0
        </p>

        <Panel title={mode === "login" ? "// login" : "// register"}>
          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <label className="block">
                <span className="text-[10px] tracking-widest text-[var(--dim)] uppercase">
                  display name
                </span>
                <input
                  className="w-full mt-1 px-2 py-2 border bg-input text-sm"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="optional"
                  autoComplete="off"
                />
              </label>
            )}
            <label className="block">
              <span className="text-[10px] tracking-widest text-[var(--dim)] uppercase">
                username
              </span>
              <input
                className="w-full mt-1 px-2 py-2 border bg-input text-sm lowercase"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3-24 chars"
                autoComplete="username"
                required
              />
            </label>
            <label className="block">
              <span className="text-[10px] tracking-widest text-[var(--dim)] uppercase">
                password
              </span>
              <input
                type="password"
                className="w-full mt-1 px-2 py-2 border bg-input text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 4 chars"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full px-3 py-2.5 border border-primary bg-primary/10 text-primary glow hover:bg-primary hover:text-primary-foreground transition-colors text-sm tracking-widest uppercase disabled:opacity-50"
            >
              {busy ? "processing..." : `[ ${mode === "login" ? "login" : "create account"} ]`}
            </button>
          </form>
          <div className="mt-4 pt-3 border-t border-border text-center">
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-xs text-[var(--dim)] hover:text-primary transition-colors"
            >
              {mode === "login"
                ? "> no account? register"
                : "< have an account? login"}
            </button>
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
