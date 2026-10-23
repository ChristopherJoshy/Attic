import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";

const HomeZone = () => {
  const { setCurrentZone } = useGameStore();

  return (
    <motion.section
      id="home"
      className="zone min-h-screen flex flex-col items-center justify-center p-4 relative bg-background overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card to-background opacity-50 z-0"></div>
      {/* <div className="absolute inset-0 bg-[url('/textures/parchment-light.png')] opacity-10 mix-blend-multiply z-0"></div> */}

      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl mx-auto text-center py-16">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8"
        >
          <h1 className="medieval-title text-4xl md:text-6xl mb-4">Christopher Joshy</h1>
          <h2 className="medieval-subtitle mb-4 font-heading text-primary">Full-Stack Developer & Game Dev Enthusiast</h2>
          <p className="medieval-text text-lg md:text-xl mb-8 text-foreground/90 max-w-xl mx-auto">
            Forging modern web experiences and interactive adventures with a passion for clean code, AI integration, and engaging design. Seeking new quests and collaborations.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-10">
            <a
              href="mailto:christopherjoshy4@gmail.com"
              className="flex items-center justify-center gap-2 px-6 py-3 text-lg"
              style={{
                background: 'linear-gradient(to bottom, #8b4513 0%, #5c2c0e 100%)',
                border: '2px solid #ffd700',
                color: '#ffd700',
                borderRadius: '4px',
                fontFamily: "'Cinzel', serif",
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                transition: 'all 0.3s ease'
              }}
            >
              <span role="img" aria-label="Raven" className="text-xl">🦅</span>
              <span>Send a Raven (Email)</span>
            </a>
            <a
              href="/assets/christopher_joshy_resume.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 text-lg"
              style={{
                background: 'linear-gradient(to bottom, #8b4513 0%, #5c2c0e 100%)',
                border: '2px solid #ffd700',
                color: '#ffd700',
                borderRadius: '4px',
                fontFamily: "'Cinzel', serif",
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                transition: 'all 0.3s ease'
              }}
            >
              <span role="img" aria-label="Scroll" className="text-xl">📜</span>
              <span>View Scroll (Resume)</span>
            </a>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 mb-10">
            <div className="flex items-center justify-center gap-6 mb-4">
              <a href="https://www.linkedin.com/in/christopher-joshy-272a77290/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
                 className="medieval-text hover:text-primary transition-colors text-2xl" title="LinkedIn">
                <span role="img" aria-label="Scroll">📜</span>
              </a>
              <a href="https://github.com/ChristopherJoshy" target="_blank" rel="noopener noreferrer" aria-label="GitHub"
                 className="medieval-text hover:text-primary transition-colors text-2xl" title="GitHub">
                <span role="img" aria-label="Hammer and Pick">⚒️</span>
              </a>
              <a href="https://instagram.com/calculatederror" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                 className="medieval-text hover:text-primary transition-colors text-2xl" title="Instagram">
                <span role="img" aria-label="Castle">🏰</span>
              </a>
            </div>
            <motion.button
              className="flex items-center justify-center gap-2 px-8 py-3 text-lg"
              style={{
                background: 'linear-gradient(to bottom, #8b4513 0%, #5c2c0e 100%)',
                border: '2px solid #ffd700',
                color: '#ffd700',
                borderRadius: '4px',
                fontFamily: "'Cinzel', serif",
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                transition: 'all 0.3s ease'
              }}
              whileHover={{ scale: 1.05, boxShadow: "3px 3px 8px rgba(0,0,0,0.4)" }}
              whileTap={{ scale: 0.98, boxShadow: "1px 1px 3px rgba(0,0,0,0.3)" }}
              onClick={() => setCurrentZone('skills')}
              transition={{ duration: 0.15 }}
            >
              <span role="img" aria-label="Sword" className="text-xl">⚔️</span>
              <span>Explore My Skills</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default HomeZone;
