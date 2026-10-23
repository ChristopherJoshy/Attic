import React from 'react';
import { motion } from 'framer-motion';

interface Education {
  id: number;
  title: string;
  institution: string;
  period: string;
  description: string;
  skills: string[];
  icon: string;
}

const educationData: Education[] = [
  {
    id: 1,
    title: "Archmage of Web Development",
    institution: "Digital Sorcery Academy",
    period: "2020 - 2023",
    description: "Mastered the ancient scrolls of web development, from the fundamentals of HTML runes to the advanced spells of React enchantments.",
    skills: ["HTML", "CSS", "JavaScript", "React", "Node.js"],
    icon: "🧙‍♂️"
  },
  {
    id: 2,
    title: "Database Keeper",
    institution: "Mystic Data Archives",
    period: "2019 - 2020",
    description: "Learned the sacred arts of data management and the mystical practices of efficient querying.",
    skills: ["MongoDB", "PostgreSQL", "Redis", "Data Structures"],
    icon: "📚"
  },
  {
    id: 3,
    title: "Battle-Tested Engineer",
    institution: "Code Warriors Guild",
    period: "2018 - 2019",
    description: "Trained in the warrior ways of software engineering, mastering the art of clean code and efficient algorithms.",
    skills: ["Git", "Testing", "CI/CD", "Agile Methodologies"],
    icon: "⚔️"
  }
];

const Education: React.FC = () => {
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
              📚 Scholarly Pursuits 📚
            </h1>
            <div className="absolute -top-6 -left-6 w-12 h-12 border-t-2 border-l-2 border-yellow-600/50" />
            <div className="absolute -top-6 -right-6 w-12 h-12 border-t-2 border-r-2 border-yellow-600/50" />
            <div className="absolute -bottom-6 -left-6 w-12 h-12 border-b-2 border-l-2 border-yellow-600/50" />
            <div className="absolute -bottom-6 -right-6 w-12 h-12 border-b-2 border-r-2 border-yellow-600/50" />
          </div>
          <p className="medieval-text text-xl md:text-2xl text-yellow-400/90 mt-4">
            ~ Chronicles of Knowledge and Mastery ~
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto space-y-12">
          {educationData.map((edu, index) => (
            <motion.div
              key={edu.id}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="medieval-card p-8 relative transform hover:scale-[1.02] transition-all duration-300"
            >
              <div className="absolute -inset-[2px] bg-gradient-to-r from-yellow-900/50 via-yellow-600/50 to-yellow-900/50 rounded-lg" />
              <div className="absolute inset-0 bg-stone-900 rounded-lg" />
              <div className="relative">
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2">
                  <span className="text-5xl filter drop-shadow-glow">{edu.icon}</span>
                </div>

                <div className="pt-8 mb-6">
                  <h3 className="medieval-text text-2xl mb-4 text-center text-yellow-400/90">
                    {edu.title}
                  </h3>
                  <div className="flex flex-col md:flex-row justify-center items-center space-y-2 md:space-y-0 md:space-x-6 text-center">
                    <span className="medieval-text text-lg text-gray-300/90 flex items-center">
                      <span className="text-xl mr-2">🏰</span> {edu.institution}
                    </span>
                    <span className="medieval-text text-sm text-yellow-600/70 md:border-l md:border-yellow-900/30 md:pl-6 flex items-center">
                      <span className="text-xl mr-2">📅</span> {edu.period}
                    </span>
                  </div>
                </div>

                <div className="relative p-6 mb-6 border-2 border-yellow-900/30 rounded-lg bg-stone-800/30">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-stone-900 px-4">
                    <span className="medieval-text text-yellow-400/90">~ Achievements ~</span>
                  </div>
                  <p className="medieval-text text-gray-300/90 leading-relaxed text-center">
                    {edu.description}
                  </p>
                </div>

                <div className="border-t border-yellow-900/30 pt-6">
                  <div className="text-center mb-4">
                    <h4 className="medieval-text text-lg text-yellow-400/90 inline-flex items-center">
                      <span className="text-2xl mr-2">⚔️</span> Mastered Skills
                    </h4>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {edu.skills.map((skill, skillIndex) => (
                      <span
                        key={skillIndex}
                        className="medieval-text text-sm px-4 py-2 bg-yellow-900/20 text-yellow-400/90 rounded-full border border-yellow-900/30 hover:scale-110 transition-transform"
                      >
                        ✧ {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Education; 