import React, { useState, useRef, useEffect } from "react";
import { IconSearch, IconBell, IconLogout, IconMenu2, IconChevronRight, IconCheck } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { studentData, notifications as allNotifications } from "../lib/mockData";
import { cn } from "../lib/cn";

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unread = allNotifications.filter((n) => !n.read && !readIds.includes(n.id));

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setNotifOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="h-16 border-b border-line bg-surface/80 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
      <div className="flex-1 flex items-center gap-3">
        <button onClick={() => window.dispatchEvent(new Event("toggle-mobile-sidebar"))} className="p-1.5 text-muted hover:text-ink md:hidden focus-ring rounded-md" aria-label="Toggle menu">
          <IconMenu2 size={22} stroke={1.6} />
        </button>

        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted bg-ink/[0.03] rounded-[10px] border border-transparent hover:border-line-strong hover:text-body transition-colors focus-ring w-full max-w-xs"
        >
          <IconSearch size={16} />
          <span className="truncate">Search</span>
          <kbd className="hidden sm:inline-block ml-auto text-[10px] font-sans px-1.5 py-0.5 rounded bg-ink/[0.06] text-faint">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2" ref={ref}>
        <div className="relative">
          <button onClick={() => setNotifOpen((v) => !v)} className="relative p-2 text-muted hover:text-ink hover:bg-ink/[0.04] rounded-md transition-colors focus-ring" aria-label="Notifications">
            <IconBell size={20} stroke={1.6} />
            {unread.length > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-semibold flex items-center justify-center border-2 border-surface">{unread.length}</span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-[340px] max-w-[92vw] bg-surface rounded-lg border border-line shadow-pop overflow-hidden z-50 animate-[fade-up_0.18s_ease-out]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <span className="font-semibold text-ink text-sm">Notifications</span>
                <button onClick={() => setReadIds(allNotifications.map((n) => n.id))} className="text-xs text-accent hover:underline">Mark all read</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {allNotifications.map((n) => {
                  const isUnread = !n.read && !readIds.includes(n.id);
                  return (
                    <button key={n.id} onClick={() => setReadIds((p) => [...p, n.id])} className={cn("w-full text-left px-4 py-3 border-b border-line/70 last:border-0 hover:bg-ink/[0.02] transition-colors flex gap-3", isUnread && "bg-accent/[0.03]")}>
                      <div className="mt-0.5 shrink-0">
                        {isUnread ? <span className="block w-2 h-2 rounded-full bg-accent mt-1.5" /> : <IconCheck size={16} className="text-faint" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-sm font-medium", isUnread ? "text-ink" : "text-body")}>{n.title}</div>
                        <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.body}</p>
                        <span className="text-[11px] text-faint mt-1 block">{n.time}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => navigate("/notifications")} className="w-full text-center py-2.5 text-xs font-medium text-accent hover:bg-ink/[0.02] border-t border-line flex items-center justify-center gap-1">
                View all <IconChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-line mx-1 hidden sm:block" />

        <button onClick={() => navigate("/profile")} className="flex items-center gap-2.5 group focus-ring rounded-full pl-1 pr-1 sm:pr-2 py-1 hover:bg-ink/[0.03] transition-colors">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-sm font-medium text-ink leading-none">{studentData.name.split(" ")[0]}</span>
            <span className="text-[11px] text-muted mt-1">{studentData.rollNumber}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-ink text-white flex items-center justify-center font-semibold text-sm shadow-sm shrink-0">{studentData.name.charAt(0)}</div>
        </button>

        <button onClick={() => navigate("/login")} className="text-muted hover:text-danger p-2 rounded-md transition-colors focus-ring" title="Logout" aria-label="Logout">
          <IconLogout size={20} stroke={1.6} />
        </button>
      </div>
    </header>
  );
};
