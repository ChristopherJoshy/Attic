import { ReactNode, useEffect } from "react";
import StatusBar from "./StatusBar";
import MobileMenu from "./MobileMenu";
import AudioController from "./AudioController";
import CursorTrail from "./CursorTrail";
import { useGameStore } from "@/store/gameStore";

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { currentZone, setCurrentZone, isMobileMenuOpen, setMobileMenuOpen } = useGameStore();

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [isMobileMenuOpen, setMobileMenuOpen]);

  return (
    <div id="game-container" className="min-h-screen flex flex-col relative">
      <StatusBar />
      
      <MobileMenu />
      
      <div id="zones-container" className="flex-grow flex flex-col">
        {children}
      </div>
      
      <AudioController />
      <CursorTrail />
    </div>
  );
};

export default MainLayout;
