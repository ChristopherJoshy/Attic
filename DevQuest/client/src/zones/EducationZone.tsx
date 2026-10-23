import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";

// Simple SVG Icon for Scroll/Book
const ScrollIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mr-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

// Simple SVG Icon for Tome/Knowledge
const TomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mr-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

// Simple SVG Icon for Interests/Hobbies
const InterestsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mr-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const EducationZone = () => {
  const { setCurrentZone } = useGameStore();

  // GitHub Stats (Example Data)
  const githubStats = { stars: 24, commits: 271, prs: 1, issues: 1 }; 

  // Define motion variants for staggering children
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      id="education" 
      className="zone min-h-screen p-4 lg:p-8 relative bg-background"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      {/* Background elements - Texture URL removed */}
      {/* <div className="absolute inset-0 bg-[url('/textures/old-library.png')] opacity-5 mix-blend-multiply z-0"></div> */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background z-0"></div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.h1 variants={itemVariants} className="medieval-title text-center mb-4">The Royal Archives</motion.h1>
        <motion.p variants={itemVariants} className="medieval-text text-center mb-12 text-foreground/80">Knowledge collected through quests and dedicated study.</motion.p>
        
        {/* Main Content Grid */}
        <motion.div variants={containerVariants} className="grid lg:grid-cols-2 gap-8 mb-12">
          
          {/* Education Card */}
          <motion.div variants={itemVariants} className="medieval-card h-full flex flex-col">
            <div className="flex items-center mb-4">
              <ScrollIcon />
              <h2 className="font-heading text-lg md:text-xl text-primary uppercase">Education Scroll</h2>
            </div>
            <hr className="border-t border-border/50 mb-4"/>
            
            <div className="mb-6">
              <div className="font-heading text-sm text-secondary mb-1">B.Tech - Computer Science Engineering</div>
              <div className="font-medieval text-sm text-foreground mb-1">St. Joseph's College of Engineering and Technology, Palai</div>
              <div className="font-medieval text-xs text-muted-foreground mb-3">2023 - Present</div>
              {/* Simplified Progress Indicator */}
              <div className="w-full h-1 bg-muted rounded-full border border-border/50">
                 <div className="h-full bg-accent rounded-full" style={{ width: '65%' }}></div>
              </div>
              <div className="font-medieval text-xs text-right mt-1 text-accent">Year 2/4</div>
            </div>
            
            <div className="mt-auto"> {/* Push to bottom */} 
              <div className="font-heading text-sm text-secondary mb-2">Ongoing Specializations</div>
              <ul className="list-inside font-medieval text-sm space-y-1 text-foreground/90">
                <li className="flex items-center"><span className="text-accent mr-2">✧</span> C# & Advanced Web Development</li>
                <li className="flex items-center"><span className="text-accent mr-2">✧</span> AI/ML Concepts & Applications</li>
                <li className="flex items-center"><span className="text-accent mr-2">✧</span> 3D Graphics with Three.js</li>
              </ul>
            </div>
          </motion.div>
          
          {/* Competencies Card */}
          <motion.div variants={itemVariants} className="medieval-card h-full flex flex-col">
            <div className="flex items-center mb-4">
              <TomeIcon />
              <h2 className="font-heading text-lg md:text-xl text-primary uppercase">Competency Tome</h2>
            </div>
            <hr className="border-t border-border/50 mb-4"/>
            
            <div className="space-y-3">
              {[ 
                { title: "Frontend Development", desc: "React.js, HTML5, CSS3, JavaScript ES6+, responsive UI" },
                { title: "Backend Development", desc: "Node.js, Express, Firebase, scalable applications" },
                { title: "AI Integration", desc: "Google Gemini API, practical implementation" },
                { title: "3D Visualization", desc: "Three.js for interactive web graphics" },
                { title: "Prompt Engineering", desc: "Claude, GPT, Gemini for content generation" },
                { title: "Version Control", desc: "Git & GitHub for collaboration" },
              ].map(comp => (
                <div key={comp.title}>
                  <div className="font-heading text-sm text-secondary mb-1">{comp.title}</div>
                  <p className="font-medieval text-sm text-foreground/90 leading-snug">{comp.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Interests & GitHub Card */}
        <motion.div variants={itemVariants} className="grid lg:grid-cols-2 gap-8 mb-12">
          <div className="medieval-card">
            <div className="flex items-center mb-4">
              <InterestsIcon />
              <h2 className="font-heading text-lg md:text-xl text-primary uppercase">Interests & Passions</h2>
            </div>
             <hr className="border-t border-border/50 mb-4"/>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div>
                 <div className="font-heading text-sm text-secondary mb-2">Hobbies</div>
                 <ul className="list-inside font-medieval text-sm space-y-1 text-foreground/90">
                   <li className="flex items-center"><span className="text-accent mr-2">✧</span> Building Web Apps & Tools</li>
                   <li className="flex items-center"><span className="text-accent mr-2">✧</span> Exploring New Technologies</li>
                   <li className="flex items-center"><span className="text-accent mr-2">✧</span> Open-Source Contribution</li>
                 </ul>
               </div>
               <div>
                 <div className="font-heading text-sm text-secondary mb-2">Passions</div>
                 <ul className="list-inside font-medieval text-sm space-y-1 text-foreground/90">
                   <li className="flex items-center"><span className="text-accent mr-2">✧</span> Clean Code & Design</li>
                   <li className="flex items-center"><span className="text-accent mr-2">✧</span> Game Dev & Interactivity</li>
                   <li className="flex items-center"><span className="text-accent mr-2">✧</span> Practical AI/ML</li>
                 </ul>
               </div>
            </div>
          </div>
          <div className="medieval-card">
             <div className="flex items-center mb-4">
               {/* Simple GitHub Icon */} 
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mr-3 text-primary" fill="currentColor" viewBox="0 0 16 16">
                 <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
               </svg>
               <h2 className="font-heading text-lg md:text-xl text-primary uppercase">GitHub Contributions</h2>
            </div>
             <hr className="border-t border-border/50 mb-4"/>
             <div className="grid grid-cols-2 gap-4 text-center">
                {Object.entries(githubStats).map(([key, value]) => (
                  <div key={key}>
                    <div className="font-heading text-sm text-secondary capitalize">{key}</div>
                    <div className="font-medieval text-lg text-foreground font-semibold">{value}</div>
                  </div>
                ))}
             </div>
              <a href="https://github.com/ChristopherJoshy" target="_blank" rel="noopener noreferrer" className="medieval-button-secondary text-xs mt-4 inline-block w-full text-center">View GitHub Profile</a>
          </div>
        </motion.div>
        
        {/* Navigation Button */}
        <motion.div variants={itemVariants} className="flex justify-center mt-12">
          <button 
            className="medieval-button px-8 py-3 text-lg"
            onClick={() => setCurrentZone('projects')}
          >
            Enter The Forge (Projects)
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default EducationZone;
