import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SpaceWars from '../components/SpaceWars';

interface Soldier {
  id: number;
  x: number;
  y: number;
  direction: number;
}

const Home: React.FC = () => {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [showGame, setShowGame] = useState(false);
  const [killCount, setKillCount] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    const spawnInterval = setInterval(() => {
      if (!showGame && soldiers.length < 5) {
        const newSoldier: Soldier = {
          id: Date.now(),
          x: Math.random() * (window.innerWidth - 50),
          y: Math.random() * (window.innerHeight - 50),
          direction: Math.random() * Math.PI * 2
        };
        setSoldiers(prev => [...prev, newSoldier]);
      }
    }, 3000);

    return () => clearInterval(spawnInterval);
  }, [soldiers, showGame]);

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setSoldiers(prev => prev.map(soldier => {
        const speed = 2;
        let newX = soldier.x + Math.cos(soldier.direction) * speed;
        let newY = soldier.y + Math.sin(soldier.direction) * speed;
        let newDirection = soldier.direction;

        if (newX < 0 || newX > window.innerWidth - 50) {
          newDirection = Math.PI - newDirection;
          newX = soldier.x;
        }
        if (newY < 0 || newY > window.innerHeight - 50) {
          newDirection = -newDirection;
          newY = soldier.y;
        }

        return {
          ...soldier,
          x: newX,
          y: newY,
          direction: newDirection
        };
      }));
    }, 50);

    return () => clearInterval(moveInterval);
  }, []);

  const handleSoldierClick = (id: number) => {
    setSoldiers(prev => prev.filter(s => s.id !== id));
    setKillCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 10) {
        setShowGame(true);
        setShowInstructions(false);
      }
      return newCount;
    });
  };

  const handleGameEnd = () => {
    setShowGame(false);
    setKillCount(0);
    setShowInstructions(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl animate-torch" />
        <div className="absolute top-20 right-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl animate-torch-delayed" />
        <div className="absolute inset-0 bg-[url('/textures/parchment.png')] opacity-5" />
      </div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="medieval-title text-5xl md:text-7xl mb-6">Medieval Quest</h1>
          <p className="medieval-text text-xl md:text-2xl text-yellow-400/90">
            A Journey Through Ancient Realms
          </p>
        </motion.div>

        {showInstructions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="medieval-card max-w-3xl mx-auto p-8 mb-12"
          >
            <div className="flex flex-col items-center space-y-6">
              <h2 className="medieval-text text-2xl md:text-3xl mb-4">
                Welcome, Brave Adventurer!
              </h2>
              <p className="medieval-text text-lg md:text-xl text-center mb-6 leading-relaxed">
                Defeat the wandering soldiers by clicking on them. Once you've vanquished 10 foes, 
                you'll unlock the legendary SpaceWars challenge!
              </p>
              <div className="flex items-center space-x-4">
                <span className="medieval-text text-xl">
                  Soldiers Defeated: 
                </span>
                <span className="medieval-text text-2xl text-yellow-400">
                  {killCount}/10
                </span>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {!showGame && soldiers.map(soldier => (
            <motion.div
              key={soldier.id}
              className="absolute cursor-pointer transform hover:scale-110 transition-transform"
              style={{
                left: soldier.x,
                top: soldier.y,
                transform: `rotate(${soldier.direction}rad)`
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              onClick={() => handleSoldierClick(soldier.id)}
            >
              <div className="relative">
                <span className="text-4xl">⚔️</span>
                <motion.div
                  className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-red-500/70 rounded"
                  initial={{ width: 32 }}
                  animate={{ width: 0 }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {showGame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="medieval-card p-6"
          >
            <SpaceWars onGameEnd={handleGameEnd} />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Home; 