import { cn } from "@/lib/utils";

interface XPBarProps {
  level: number;
  className?: string;
}

const XPBar = ({ level, className }: XPBarProps) => {
  return (
    <div className={cn("xp-bar", className)}>
      <div className="xp-fill" style={{ width: `${level}%` }}></div>
    </div>
  );
};

export default XPBar;
