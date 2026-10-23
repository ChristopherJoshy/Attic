import { cn } from "@/lib/utils";

interface PortalProps {
  title: string;
  icon: string;
  href: string;
  className?: string;
  onClick?: () => void;
}

const Portal = ({ title, icon, href, className, onClick }: PortalProps) => {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className={cn("portal flex flex-col items-center justify-center", className)}
      onClick={onClick}
    >
      <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary border-4 border-highlight flex items-center justify-center mb-3">
        <img src={icon} alt={title} className="w-10 h-10 pixelated" />
      </div>
      <div className="font-pixel text-xs text-center">{title}</div>
    </a>
  );
};

export default Portal;
