import { NavLink } from "react-router-dom";
import { LayoutDashboard, UserPlus, Users, Settings, Bug } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/setup", label: "Add Patient", icon: UserPlus },
  { to: "/debug", label: "Debug", icon: Bug },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-sahayi-border px-6 py-3 flex items-center justify-around lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-colors ${
              isActive ? "text-sahayi-primary" : "text-slate-400"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <link.icon size={20} strokeWidth={isActive ? 3 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {link.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
