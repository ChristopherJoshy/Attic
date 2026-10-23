import { NavLink } from "react-router-dom";
import { LayoutDashboard, UserPlus, Users, Bug, Settings } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/setup", label: "Add Patient", icon: UserPlus },
  { to: "/debug", label: "Debug", icon: Bug },
];

export default function Sidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col justify-between border-r border-sahayi-border bg-white dark:bg-black px-4 py-6 lg:flex">
      <div>
        <p className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Medical Console
        </p>
        <nav className="mt-6 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "sidebar-link-active" : "sidebar-link-inactive"}`
              }
            >
              <link.icon size={20} strokeWidth={2.5} />
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="space-y-1 border-t border-sahayi-border pt-6">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "sidebar-link-active" : "sidebar-link-inactive"}`
          }
        >
          <Settings size={20} strokeWidth={2.5} />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
