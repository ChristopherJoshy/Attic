import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { projects } from "@/data/projects";

const ProjectsZone = () => {
  const { setCurrentZone } = useGameStore();
  const [selectedProject, setSelectedProject] = useState<typeof projects[0] | null>(null);

  const showProject = (project: typeof projects[0]) => {
    setSelectedProject(project);
    const detailsElement = document.getElementById('project-details-modal');
    detailsElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const hideProject = () => {
    setSelectedProject(null);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }
  };

  return (
    <motion.div 
      id="projects" 
      className="zone min-h-screen p-4 lg:p-8 relative bg-background"
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      variants={containerVariants}
    >
      {/* Background elements - Texture URL removed */}
      {/* <div className="absolute inset-0 bg-[url('/textures/forge-bg.png')] opacity-10 mix-blend-overlay z-0"></div> */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background z-0"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.h1 variants={itemVariants} className="medieval-title text-center mb-4">The Forge of Creation</motion.h1>
        <motion.p variants={itemVariants} className="medieval-text text-center mb-12 text-foreground/80 max-w-2xl mx-auto">
          Welcome, adventurer, to the Forge! Here lie artifacts crafted with code, creativity, and arcane problem-solving.
        </motion.p>
        
        <motion.div 
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-16"
        >
          {projects.map((project) => (
            <motion.div 
              key={project.id} 
              variants={itemVariants} 
              className="medieval-card h-full flex flex-col cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              onClick={() => showProject(project)}
            >
              <img src={project.image} alt={`${project.shortTitle} preview`} className="w-full h-40 object-cover rounded-sm mb-4 border border-border"/>
              <h3 className="font-heading text-lg text-primary mb-2 uppercase">{project.shortTitle}</h3>
              <p className="font-medieval text-sm text-foreground/80 mb-4 flex-grow">{project.description.substring(0, 100)}{project.description.length > 100 ? '...' : ''}</p>
              <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-border/30">
                {project.technologies.slice(0, 4).map((tech) => (
                  <span 
                    key={tech} 
                    className="text-xs font-medieval px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/50"
                  >
                    {tech}
                  </span>
                ))}
                {project.technologies.length > 4 && (
                   <span className="text-xs font-medieval px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">+more</span>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
        
        <AnimatePresence>
          {selectedProject && (
            <motion.div
              id="project-details-modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={hideProject}
            >
              <div 
                className="medieval-card max-w-3xl w-full relative shadow-2xl border-2 border-accent" 
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  className="absolute top-3 right-3 text-secondary hover:text-destructive transition-colors text-2xl font-bold z-10"
                  onClick={hideProject}
                  aria-label="Close project details"
                >
                  &times;
                </button>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                     <img 
                       src={selectedProject.image} 
                       alt={`${selectedProject.title} Screenshot`} 
                       className="w-full rounded border border-border mb-4 shadow-md"
                     />
                     <div className="flex flex-wrap gap-2 mb-4">
                       {selectedProject.technologies.map((tech) => (
                         <span key={tech} className="text-xs font-medieval px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">{tech}</span>
                       ))}
                     </div>
                     <div className="flex gap-3">
                       <a href={selectedProject.githubUrl} target="_blank" rel="noopener noreferrer" className="medieval-button flex-1 text-center text-sm">View Code</a>
                       {selectedProject.demoUrl && (
                         <a href={selectedProject.demoUrl} target="_blank" rel="noopener noreferrer" className="medieval-button-secondary flex-1 text-center text-sm">Live Demo</a>
                       )}
                     </div>
                  </div>
                  
                  <div>
                     <h2 className="font-heading text-xl text-primary mb-3 uppercase border-b border-border/50 pb-2">{selectedProject.title}</h2>
                     <div className="font-medieval text-sm text-foreground/90 mb-4 leading-relaxed">
                       {selectedProject.description}
                     </div>
                     
                     <h4 className="font-heading text-sm text-secondary mb-2 uppercase">Key Features:</h4>
                     <ul className="font-medieval text-sm space-y-1 mb-4 list-inside text-foreground/90">
                       {selectedProject.features.map((feature, index) => (
                         <li key={index}><span className="text-accent mr-1.5">✧</span>{feature}</li>
                       ))}
                     </ul>
                     
                     <h4 className="font-heading text-sm text-secondary mb-1 uppercase">Development Period:</h4>
                     <p className="font-medieval text-sm text-foreground/90">{selectedProject.period}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.div variants={itemVariants} className="flex justify-center mt-16">
          <button 
            className="medieval-button px-8 py-3 text-lg"
            onClick={() => setCurrentZone('contact')}
          >
             Send a Raven (Contact)
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ProjectsZone;
