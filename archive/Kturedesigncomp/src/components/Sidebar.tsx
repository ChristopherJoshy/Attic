import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  IconLayoutDashboard, IconUser, IconBooks, IconCalendarCheck, IconFileText,
  IconReceipt2, IconShieldCheck, IconMessageCircle, IconCertificate,
  IconCalendarEvent, IconBell, IconHeadset, IconX, IconSchool,
} from "@tabler/icons-react";
import { cn } from "../lib/cn";

const groups = [
  { label: "Overview", items: [{ label: "Dashboard", path: "/dashboard", icon: IconLayoutDashboard }] },
  {
    label: "Academics",
    items: [
      { label: "My Profile", path: "/profile", icon: IconUser },
      { label: "Academic Records", path: "/academics", icon: IconBooks },
      { label: "Attendance", path: "/attendance", icon: IconCalendarCheck },
      { label: "Exam Centre", path: "/exams", icon: IconFileText },
    ],
  },
  {
    label: "Services",
    items: [
      { label: "My Fees", path: "/fees", icon: IconReceipt2 },
      { label: "Suraksha", path: "/suraksha", icon: IconShieldCheck },
      { label: "Feedback", path: "/feedback", icon: IconMessageCircle },
      { label: "Certificates", path: "/certificates", icon: IconCertificate },
    ],
  },
  {
    label: "University",
    items: [
      { label: "Calendar", path: "/calendar", icon: IconCalendarEvent },
      { label: "Notifications", path: "/notifications", icon: IconBell },
      { label: "Grievance", path: "/grievance", icon: IconHeadset },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsMobileOpen((p) => !p);
    window.addEventListener("toggle-mobile-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-mobile-sidebar", handleToggle);
  }, []);

  useEffect(() => setIsMobileOpen(false), [location]);

  const isExpanded = isMobileOpen || isHovered;

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 bg-ink/25 backdrop-blur-[2px] z-40 md:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-surface border-r border-line h-screen flex flex-col transition-[width,transform] duration-300 ease-out-expo md:sticky md:top-0 md:z-20",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isExpanded ? "w-[244px]" : "w-[68px]"
        )}
      >
        <div className={cn("px-4 py-4 flex items-center border-b border-line mb-3 transition-[justify-content,width] duration-300", isExpanded ? "justify-between gap-3" : "justify-center")}>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-ink text-white flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/logo.png" alt="KTU" className="w-6 h-6 object-contain" />
            </div>
            {isExpanded && (
              <div className="leading-tight">
                <div className="font-serif font-semibold text-[15px] text-ink">KTU</div>
                <div className="text-[11px] text-muted -mt-0.5">Student Portal</div>
              </div>
            )}
          </div>
          {isMobileOpen && (
            <button onClick={() => setIsMobileOpen(false)} className="p-1 text-muted hover:text-ink md:hidden focus-ring rounded-md" aria-label="Close">
              <IconX size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              {isExpanded && (
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">{group.label}</div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={!isExpanded ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center rounded-[10px] text-sm transition-[background-color,color] duration-200 focus-ring",
                        !isExpanded ? "justify-center px-0 py-2.5" : "px-3 py-2 gap-3",
                        isActive ? "bg-accent/[0.08] text-accent font-medium" : "text-body hover:text-ink hover:bg-ink/[0.03]"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={cn("absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-accent transition-opacity duration-200", isActive ? "opacity-100" : "opacity-0")} />
                        <item.icon size={19} stroke={1.6} className="shrink-0 relative" />
                        {isExpanded && <span className="relative truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          <div className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2", !isExpanded && "justify-center px-0")}>
            <div className="w-7 h-7 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0"><IconSchool size={15} /></div>
            {isExpanded && (
              <div className="leading-tight min-w-0">
                <div className="text-xs font-medium text-ink truncate">SJCET, Palai</div>
                <div className="text-[10px] text-faint truncate">2019 Scheme · S6</div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
