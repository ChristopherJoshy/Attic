import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Profile } from "./pages/Profile";
import { Academics } from "./pages/Academics";
import { Attendance } from "./pages/Attendance";
import { Exams } from "./pages/Exams";
import { Fees } from "./pages/Fees";
import { Suraksha } from "./pages/Suraksha";
import { Feedback } from "./pages/Feedback";
import { Certificates } from "./pages/Certificates";
import { Calendar } from "./pages/Calendar";
import { Notifications } from "./pages/Notifications";
import { Grievance } from "./pages/Grievance";
import { CommandPalette } from "./components/CommandPalette";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Routes location={location}>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/academics" element={<Academics />} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/exams" element={<Exams />} />
      <Route path="/fees" element={<Fees />} />
      <Route path="/suraksha" element={<Suraksha />} />
      <Route path="/feedback" element={<Feedback />} />
      <Route path="/certificates" element={<Certificates />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/grievance" element={<Grievance />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <BrowserRouter>
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

export default App;
