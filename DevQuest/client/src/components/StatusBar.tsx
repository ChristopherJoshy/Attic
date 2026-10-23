import { useGameStore } from "@/store/gameStore";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const StatusBar = () => {
  const {
    currentZone,
    setCurrentZone,
    isMobileMenuOpen,
    setMobileMenuOpen,
    isMusicPlaying,
    toggleMusic
  } = useGameStore();

  const musicMenuRef = useRef<HTMLDivElement>(null);

  const handleZoneChange = (zone: string) => {
    setCurrentZone(zone);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if(isMobileMenuOpen) setMobileMenuOpen(false); // Close mobile menu on selection
  };

  const toggleMenu = () => {
    setMobileMenuOpen(!isMobileMenuOpen);
  };

  const navItems = [
    { id: 'home', label: 'Home Spire' },
    { id: 'skills', label: 'Training Grounds' },
    { id: 'education', label: 'Royal Archives' },
    { id: 'projects', label: 'The Forge' },
    { id: 'quests', label: 'Guild Hall' }, // Assuming QuestsZone exists or will be styled
    { id: 'contact', label: 'Send Raven' }
  ];

  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      // Apply exact same style as the Send Raven button
      className="sticky top-0 z-50 shadow-md"
      style={{
        background: 'linear-gradient(to bottom, #8b4513 0%, #5c2c0e 100%)',
        borderBottom: '2px solid #ffd700',
        borderTop: '2px solid #ffd700',
        color: '#ffd700'
      }}
    >
      <div className="container mx-auto px-4 py-1 flex items-center justify-between">
        {/* Left side: Title/Brand - Use primary foreground color */}
        <motion.div
          className="flex items-center space-x-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {/* Enhanced medieval styling for the name */}
          <span className="font-heading font-bold tracking-wider text-xs md:text-sm uppercase flex items-center" style={{ color: '#ffd700' }}>
            <span className="mr-1" style={{ color: '#ffd700' }}>❧</span>
            Christopher Joshy
            <span className="ml-1" style={{ color: '#ffd700' }}>❧</span>
          </span>
          {/* Optional: Keep Level if desired, styled */}
          {/* <motion.span
            className="font-medieval text-accent text-xs"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            LVL 25
          </motion.span> */}
        </motion.div>

        {/* Desktop Navigation - Use primary foreground color, highlight for active */}
        <nav className="hidden md:flex items-center space-x-3 lg:space-x-4">
          {navItems.map((item, index) => (
            <motion.button
              key={item.id}
              // Match text color with Send Raven button
              className={`font-medieval text-[0.7rem] lg:text-xs tracking-normal transition-colors duration-200
                ${currentZone === item.id
                  ? 'font-bold scale-105'
                  : 'opacity-90 hover:opacity-100 hover:scale-105'}`}
              style={{ color: '#ffd700', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
              onClick={() => handleZoneChange(item.id)}
              whileHover={{ scale: 1.1 }} // Keep simple hover scale
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05, duration: 0.4 }}
            >
              {item.label}
            </motion.button>
          ))}
        </nav>

        {/* Right Side: Mobile Menu Toggle & Music - Use defined button styles */}
        <div className="flex items-center space-x-2">
          {/* Mobile Menu Button - Ensure it uses .medieval-button-secondary */}
          <div className="md:hidden">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              // Enhanced medieval-button style to match other buttons
              className="medieval-button text-[0.6rem] px-2 py-0.5 border-2 border-primary/50"
              style={{ borderRadius: '4px' }}
              onClick={toggleMenu}
              aria-label="Toggle Menu"
            >
              MENU
            </motion.button>
          </div>

          {/* Music Button - Ensure it uses .medieval-button */}
          <motion.div
            className="relative"
            ref={musicMenuRef}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              // Enhanced medieval-button style to match other buttons
              className="medieval-button text-[0.65rem] flex items-center gap-0.5 px-2 py-0.5 border-2 border-primary/50"
              style={{ borderRadius: '4px' }}
              onClick={toggleMusic}
              aria-label="Toggle Music"
            >
              {/* Icon color should inherit from button's text color (primary-foreground) */}
              <motion.span
                 className="text-xs"
                 animate={{ rotate: isMusicPlaying ? [0, 5, -5, 0] : 0 }}
                 transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                {isMusicPlaying ? '♫' : '♪'}
              </motion.span>
              {/* Text color should inherit */}
              <span className="hidden sm:inline">Music</span>
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Mobile Menu Dropdown - Adjust styles for theme */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            // Match the background with the Send Raven button style
            className="md:hidden shadow-inner overflow-hidden border-t border-[#ffd700]/50"
            style={{ background: 'linear-gradient(to bottom, #8b4513 0%, #5c2c0e 100%)' }}
          >
            <div className="container mx-auto py-1.5 px-3">
              <div className="flex flex-col space-y-1.5">
                {navItems.map((item, index) => (
                  <motion.button
                    key={`mobile-${item.id}`}
                    // Match text color with Send Raven button
                    className={`font-medieval text-xs tracking-wide text-left py-1 px-2 rounded
                      ${currentZone === item.id
                        ? 'bg-[#5c2c0e] font-bold'
                        : 'hover:bg-[#5c2c0e]/60'}`}
                    style={{ color: '#ffd700', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
                    onClick={() => handleZoneChange(item.id)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                  >
                    {item.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StatusBar;
