import { cn } from "@/lib/utils";

interface ProjectOrbProps {
  title: string;
  className?: string;
  onClick: () => void;
}

const ProjectOrb = ({ title, className, onClick }: ProjectOrbProps) => {
  return (
    <div className={cn("project-orb relative cursor-pointer", className)} onClick={onClick}>
      <div className="absolute inset-0 bg-primary rounded-full opacity-20 animate-pulse-slow"></div>
      <div className="relative z-10 w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary flex items-center justify-center border-4 border-accent">
        <span className="font-pixel text-xs md:text-sm text-highlight">{title}</span>
      </div>
    </div>
  );
};

export default ProjectOrb;
