import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import MainLayout from "@/components/MainLayout";
import HomeZone from "@/zones/HomeZone";
import SkillsZone from "@/zones/SkillsZone";
import EducationZone from "@/zones/EducationZone";
import ProjectsZone from "@/zones/ProjectsZone";
import TestimonialsZone from "@/zones/TestimonialsZone";
import QuestsZone from "@/zones/QuestsZone";
import ContactZone from "@/zones/ContactZone";
import { useGameStore } from "@/store/gameStore";
import { ThemeProvider } from "@/components/ThemeProvider";

function App() {
  const { currentZone } = useGameStore();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <MainLayout>
            <AnimatePresence mode="wait">
              {currentZone === 'home' && <HomeZone key="home" />}
              {currentZone === 'skills' && <SkillsZone key="skills" />}
              {currentZone === 'education' && <EducationZone key="education" />}
              {currentZone === 'projects' && <ProjectsZone key="projects" />}
              {currentZone === 'testimonials' && <TestimonialsZone key="testimonials" />}
              {currentZone === 'quests' && <QuestsZone key="quests" />}
              {currentZone === 'contact' && <ContactZone key="contact" />}
            </AnimatePresence>
          </MainLayout>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
