import { Search, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSearch } from "../../context/SearchContext";

export default function Navbar({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useSearch();

  const isSetupPage = location.pathname === "/setup";

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value && location.pathname === "/") {
      navigate("/patients");
    }
  };

  const initials = (user.displayName || "Doctor")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-sahayi-border bg-white dark:bg-black">
      <div className="flex h-full items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-12">
          <div className="flex flex-col">
            <h1 className="text-xl font-extrabold tracking-tight text-sahayi-primary">
              {import.meta.env.VITE_APP_NAME.toUpperCase()}
            </h1>
          </div>

          <div className={`hidden lg:relative lg:block ${isSetupPage ? "invisible" : ""}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search patients, records..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="h-10 w-[min(36vw,30rem)] rounded-lg border border-sahayi-border bg-gray-50 dark:bg-neutral-900 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900 leading-none">{user.displayName || "Authorized Doctor"}</p>
              <p className="text-xs font-medium text-slate-400 mt-1 truncate max-w-[120px]">{user.email}</p>
            </div>
            <div className="h-12 w-12 overflow-hidden rounded-2xl bg-sahayi-primary/10 flex items-center justify-center text-sahayi-primary border-2 border-sahayi-primary/20">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : initials ? (
                <span className="text-sm font-extrabold tracking-wide">{initials}</span>
              ) : (
                <User size={24} />
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
