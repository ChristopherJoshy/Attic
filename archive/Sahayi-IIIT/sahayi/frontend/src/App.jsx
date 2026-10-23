import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { setAuthToken } from "./api/sahayi";
import { auth } from "./auth/firebase";
import Navbar from "./components/Layout/Navbar";
import Sidebar from "./components/Layout/Sidebar";
import MobileNav from "./components/Layout/MobileNav";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import PatientProfile from "./pages/PatientProfile";
import Patients from "./pages/Patients";
import Setup from "./pages/Setup";
import Settings from "./pages/Settings";
import Debug from "./pages/Debug";

/**
 * Root frontend app shell with auth gating and route layout.
 * @returns {JSX.Element} Rendered application shell.
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Timeout fallback to prevent forever-blank screen if Firebase hangs
    const timer = setTimeout(() => {
      setReady((current) => {
        if (!current) {
          console.warn("Auth sync timeout reached, forcing ready state.");
          return true;
        }
        return current;
      });
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      try {
        if (nextUser) {
          const token = await nextUser.getIdToken();
          setAuthToken(token);
        } else {
          setAuthToken("");
        }
        setUser(nextUser);
      } catch (e) {
        console.error("Auth sync error:", e);
      } finally {
        setReady(true);
        clearTimeout(timer);
      }
    }, (error) => {
      console.error("Auth observer error:", error);
      setReady(true);
      clearTimeout(timer);
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Synchronizing SAHAYI...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-shell bg-transparent dark:bg-slate-900">
      <div className="app-frame relative overflow-hidden">
        <Navbar user={user} />
        <div className="shell-grid pt-16">
          <Sidebar />
          <main className="page-shell min-w-0">
            <div className="workspace-panel p-4 lg:p-5 overflow-y-auto scrollbar-thin">
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/patients" element={<Patients />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/settings" element={<Settings onLogout={() => signOut(auth)} />} />
                <Route path="/patient/:id" element={<PatientProfile user={user} />} />
                <Route path="/debug" element={<Debug user={user} />} />
              </Routes>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </div>
  );
}
