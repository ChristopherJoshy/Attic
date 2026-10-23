import { useGameStore } from "@/store/gameStore";
import { AnimatePresence, motion } from "framer-motion";

const MobileMenu = () => {
  const { 
    currentZone, 
    setCurrentZone, 
    isMobileMenuOpen, 
    setMobileMenuOpen 
  } = useGameStore();

  const handleZoneChange = (zone: string) => {
    setCurrentZone(zone);
    setMobileMenuOpen(false);
    // Scroll to top when changing zones
    window.scrollTo(0, 0);
  };

  return (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <motion.div 
          id="mobile-menu" 
          className="fixed top-12 left-0 right-0 bg-background z-40 p-4 font-pixel text-sm border-b-2 border-primary"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex flex-col space-y-4">
            <button 
              className={`py-2 border-b border-primary transition-colors ${currentZone === 'home' ? 'text-highlight' : 'text-text hover:text-highlight'}`} 
              onClick={() => handleZoneChange('home')}
            >
              HOME
            </button>
            <button 
              className={`py-2 border-b border-primary transition-colors ${currentZone === 'skills' ? 'text-highlight' : 'text-text hover:text-highlight'}`} 
              onClick={() => handleZoneChange('skills')}
            >
              SKILLS
            </button>
            <button 
              className={`py-2 border-b border-primary transition-colors ${currentZone === 'education' ? 'text-highlight' : 'text-text hover:text-highlight'}`} 
              onClick={() => handleZoneChange('education')}
            >
              EDUCATION
            </button>
            <button 
              className={`py-2 border-b border-primary transition-colors ${currentZone === 'projects' ? 'text-highlight' : 'text-text hover:text-highlight'}`} 
              onClick={() => handleZoneChange('projects')}
            >
              PROJECTS
            </button>
            <button 
              className={`py-2 border-b border-primary transition-colors ${currentZone === 'quests' ? 'text-highlight' : 'text-text hover:text-highlight'}`} 
              onClick={() => handleZoneChange('quests')}
            >
              QUESTS
            </button>
            <button 
              className={`py-2 transition-colors ${currentZone === 'contact' ? 'text-highlight' : 'text-text hover:text-highlight'}`} 
              onClick={() => handleZoneChange('contact')}
            >
              CONTACT
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MobileMenu;
