import { useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { skills } from "@/data/skills";

// Define SkillCategory type based on usage if not exported
type SkillCategory = "languages" | "frameworks" | "tools" | "ai/ml"; 

// Reusable Skill Card Component
const SkillCard = ({ skill }: { skill: typeof skills[0] }) => {
  // Generate a random mastery percentage between 51 and 100
  const progress = Math.floor(Math.random() * 50) + 51; 

  return (
    <motion.div
      className="medieval-card flex flex-col items-center text-center h-full transition-shadow hover:shadow-xl p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -5 }}
    >
      <img 
        src={skill.icon} 
        alt={`${skill.name} icon`} 
        className="h-12 w-12 mb-3 object-contain"
        onError={(e) => (e.currentTarget.src = '/icons/placeholder.svg')}
      />
      <h3 className="font-heading text-base font-semibold text-primary mb-1 uppercase">{skill.name}</h3>
      <p className="font-medieval text-xs text-muted-foreground mb-3 h-10 overflow-hidden">
        {skill.experience}
      </p>
      
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border shadow-inner mb-1 mt-auto">
        <div 
          className="h-full bg-gradient-to-r from-accent/70 to-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <span className="font-medieval text-xs text-accent">Mastery: {progress}%</span>
    </motion.div>
  );
};

const SkillsZone = () => {
  const { setCurrentZone } = useGameStore();
  const [activeCategory, setActiveCategory] = useState<SkillCategory | "all">("all");

  const categories: { id: SkillCategory | "all"; label: string }[] = [
    { id: "all", label: "All Runes" },
    { id: "languages", label: "Ancient Tongues" },
    { id: "frameworks", label: "Forged Frameworks" },
    { id: "tools", label: "Artisan Tools" },
    { id: "ai/ml", label: "Arcane Arts (AI)" },
  ];

  const filteredSkills = activeCategory === "all" 
    ? skills 
    : skills.filter(skill => skill.category === activeCategory);

  return (
    <motion.div 
      id="skills" 
      className="zone min-h-screen p-4 lg:p-8 relative bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background elements - Texture URL removed */}
      {/* <div className="absolute inset-0 bg-[url('/textures/stone-dark.png')] opacity-5 z-0"></div> */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background z-0"></div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <h1 className="medieval-title text-center mb-4">Training Grounds</h1>
        <p className="medieval-text text-center mb-10 text-foreground/80">Hone your skills and prepare for the journey ahead.</p>
        
        {/* Skills categories Buttons */}
        <div className="mb-10">
          <div className="flex flex-wrap justify-center gap-3 md:gap-4">
            {categories.map(category => (
              <button
                key={category.id}
                className={`medieval-button text-xs md:text-sm px-4 py-1.5 ${activeCategory === category.id 
                  ? 'medieval-button-secondary'
                  : 'opacity-80 hover:opacity-100'}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Skills grid */}
        <motion.div 
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.05 }}
        >
          {filteredSkills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </motion.div>
        
        {/* Navigation Button */}
        <div className="flex justify-center mt-12">
          <button 
            className="medieval-button px-8 py-3 text-lg"
            onClick={() => setCurrentZone('education')}
          >
            Proceed to the Royal Archives
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default SkillsZone;
