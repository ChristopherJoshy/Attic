import React from 'react';
import { motion } from 'framer-motion';

interface Quest {
  id: number;
  title: string;
  description: string;
  difficulty: 'Novice' | 'Apprentice' | 'Expert' | 'Master';
  reward: string;
  status: 'Available' | 'In Progress' | 'Completed';
  icon: string;
}

const quests: Quest[] = [
  {
    id: 1,
    title: "The Frontend Fortress",
    description: "Master the ancient arts of HTML, CSS, and JavaScript to build impenetrable user interfaces.",
    difficulty: 'Novice',
    reward: "Frontend Fundamentals Mastery",
    status: 'Available',
    icon: '🏰'
  },
  {
    id: 2,
    title: "React Realm Defense",
    description: "Defend the realm using React's mighty components and hooks to create dynamic experiences.",
    difficulty: 'Apprentice',
    reward: "React Mastery Badge",
    status: 'In Progress',
    icon: '⚔️'
  },
  {
    id: 3,
    title: "Backend Battlegrounds",
    description: "Venture into the depths of backend development with Node.js and Express.",
    difficulty: 'Expert',
    reward: "Backend Warrior Title",
    status: 'Available',
    icon: '🛡️'
  },
  {
    id: 4,
    title: "Database Dragon's Lair",
    description: "Face the mighty database dragon and master the arts of data management.",
    difficulty: 'Master',
    reward: "Database Sage Crown",
    status: 'Available',
    icon: '🐉'
  }
];

const difficultyColors = {
  Novice: 'text-emerald-400 border-emerald-400/30',
  Apprentice: 'text-blue-400 border-blue-400/30',
  Expert: 'text-purple-400 border-purple-400/30',
  Master: 'text-red-400 border-red-400/30'
};

const statusStyles = {
  Available: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
};

const Quests: React.FC = () => {
  return (
    <div className="min-h-screen bg-[url('/textures/stone.png')] relative overflow-hidden py-12">
      <div className="absolute inset-0 bg-gradient-to-b from-stone-900/95 to-stone-950/95" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl animate-torch" />
        <div className="absolute top-20 right-10 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl animate-torch-delayed" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="relative inline-block">
            <h1 className="medieval-title text-5xl md:text-7xl mb-6">
              ⚔️ Quest Board ⚔️
            </h1>
            <div className="absolute -top-6 -left-6 w-12 h-12 border-t-2 border-l-2 border-yellow-600/50" />
            <div className="absolute -top-6 -right-6 w-12 h-12 border-t-2 border-r-2 border-yellow-600/50" />
            <div className="absolute -bottom-6 -left-6 w-12 h-12 border-b-2 border-l-2 border-yellow-600/50" />
            <div className="absolute -bottom-6 -right-6 w-12 h-12 border-b-2 border-r-2 border-yellow-600/50" />
          </div>
          <p className="medieval-text text-xl md:text-2xl text-yellow-400/90 mt-4">
            ~ Choose Your Path to Glory ~
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {quests.map((quest, index) => (
            <motion.div
              key={quest.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="medieval-card p-8 relative group transform hover:scale-[1.02] transition-all duration-300"
            >
              <div className="absolute -inset-[2px] bg-gradient-to-r from-yellow-900/50 via-yellow-600/50 to-yellow-900/50 rounded-lg" />
              <div className="absolute inset-0 bg-stone-900 rounded-lg" />
              <div className="relative">
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2">
                  <span className="text-5xl filter drop-shadow-glow">{quest.icon}</span>
                </div>

                <div className="pt-8 mb-4">
                  <h3 className="medieval-text text-2xl mb-4 text-center text-yellow-400/90">{quest.title}</h3>
                  <div className="flex items-center justify-center space-x-4 mb-4">
                    <span className={`medieval-text text-sm px-3 py-1 rounded-full border ${difficultyColors[quest.difficulty]} bg-stone-900/50`}>
                      {quest.difficulty}
                    </span>
                    <span className={`medieval-text text-sm px-3 py-1 rounded-full border ${statusStyles[quest.status]}`}>
                      {quest.status}
                    </span>
                  </div>
                </div>

                <p className="medieval-text text-gray-300/90 mb-6 leading-relaxed text-center">
                  {quest.description}
                </p>

                <div className="flex flex-col items-center space-y-4 mt-6 pt-6 border-t border-yellow-900/30">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">🏆</span>
                    <span className="medieval-text text-yellow-400/90">{quest.reward}</span>
                  </div>
                  <button className="medieval-button w-full py-3 text-lg group-hover:scale-105 transition-transform">
                    Accept Quest
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Quests; 