import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  IconSearch,
  IconLayoutDashboard,
  IconUser,
  IconBooks,
  IconCalendarCheck,
  IconFileText,
  IconReceipt2,
  IconShieldCheck,
  IconMessageCircle,
  IconCertificate,
  IconCalendarEvent,
  IconBell,
  IconHeadset,
  IconArrowRight,
} from "@tabler/icons-react";
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const routes = [
  { title: "Dashboard", path: "/dashboard", icon: IconLayoutDashboard, hint: "Overview" },
  { title: "My Profile", path: "/profile", icon: IconUser, hint: "Personal details" },
  { title: "Academic Records", path: "/academics", icon: IconBooks, hint: "Results & grades" },
  { title: "Attendance", path: "/attendance", icon: IconCalendarCheck, hint: "Course attendance" },
  { title: "Exam Centre", path: "/exams", icon: IconFileText, hint: "Register & timetable" },
  { title: "My Fees", path: "/fees", icon: IconReceipt2, hint: "Pay dues" },
  { title: "Suraksha", path: "/suraksha", icon: IconShieldCheck, hint: "Insurance" },
  { title: "Feedback", path: "/feedback", icon: IconMessageCircle, hint: "Course survey" },
  { title: "Certificates", path: "/certificates", icon: IconCertificate, hint: "Download docs" },
  { title: "Calendar", path: "/calendar", icon: IconCalendarEvent, hint: "Academic events" },
  { title: "Notifications", path: "/notifications", icon: IconBell, hint: "Alerts" },
  { title: "Grievance", path: "/grievance", icon: IconHeadset, hint: "Raise ticket" },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const filtered = routes.filter((r) =>
    `${r.title} ${r.hint}`.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/25 backdrop-blur-sm z-[70]"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[14vh] pointer-events-none px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -12 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-xl bg-surface rounded-pop shadow-pop border border-line overflow-hidden pointer-events-auto"
            >
              <div className="flex items-center px-4 py-3.5 border-b border-line">
                <IconSearch className="text-muted mr-3" size={20} />
                <input
                  autoFocus
                  className="flex-1 bg-transparent text-ink placeholder:text-muted text-sm focus:outline-none"
                  placeholder="Search pages and actions…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd className="hidden sm:inline-block text-[10px] font-sans px-1.5 py-0.5 rounded bg-black/[0.06] text-muted">ESC</kbd>
              </div>

              <div className="max-h-[58vh] overflow-y-auto p-2">
                {filtered.length > 0 ? (
                  <>
                    <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Navigation</div>
                    {filtered.map((route) => (
                      <button
                        key={route.path}
                        onClick={() => handleSelect(route.path)}
                        className="w-full flex items-center px-3 py-2.5 hover:bg-black/[0.04] rounded-lg transition-colors group text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-black/[0.04] group-hover:bg-accent/10 flex items-center justify-center mr-3 transition-colors">
                          <route.icon size={17} className="text-muted group-hover:text-accent transition-colors" />
                        </div>
                        <span className="font-medium text-ink text-sm">{route.title}</span>
                        <span className="ml-auto text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          Go <IconArrowRight size={13} />
                        </span>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="py-10 text-center text-muted text-sm">No results found for "{query}"</div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
