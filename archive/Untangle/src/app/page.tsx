"use client";

import { useEffect } from "react";
import { api, CurrentUser } from "@/lib/api";
import { useApp } from "@/store/app";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { GroupView } from "@/components/group/GroupView";
import { BANNER_SMALL } from "@/lib/ascii";
import { LogOut, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Page() {
  const { user, loading, view, currentGroup, setUser, setLoading, logout } =
    useApp();

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ user: CurrentUser | null }>("/api/auth/me");
        setUser(res.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [setUser, setLoading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary glow text-sm cursor-blink">
          booting untangle
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} onLogout={logout} />
      <main className="flex-1 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={view === "group" ? currentGroup?.id || "group" : "dashboard"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {view === "group" && currentGroup ? (
              <GroupView groupId={currentGroup.id} />
            ) : (
              <Dashboard />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

function Header({
  user,
  onLogout,
}: {
  user: CurrentUser;
  onLogout: () => void;
}) {
  return (
    <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <pre className="text-primary glow leading-none text-[7px] sm:text-[9px] whitespace-pre hidden sm:block select-none">
          {BANNER_SMALL}
        </pre>
        <div className="sm:hidden flex items-center gap-1.5">
          <Terminal size={16} className="text-primary glow" />
          <span className="text-primary glow text-sm font-bold tracking-widest">
            untangle
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-foreground">
              {user.displayName || user.username}
            </div>
            <div className="text-[10px] text-[var(--dim)]">@{user.username}</div>
          </div>
          <button
            onClick={onLogout}
            className="p-2 border border-border text-[var(--dim)] hover:border-destructive hover:text-destructive transition-colors"
            aria-label="logout"
            title="logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 backdrop-blur-sm mt-auto">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center text-[10px] text-[var(--dim)]">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          untangle v1.0
        </span>
      </div>
    </footer>
  );
}
