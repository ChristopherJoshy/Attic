import { Card, CardContent } from "@/components/ui/card";
import { Award, Calendar } from "lucide-react";
import type { Achievement } from "@shared/schema";

interface AchievementCardProps {
  achievement: Achievement;
  className?: string;
  style?: React.CSSProperties;
}

export function AchievementCard({ achievement, className = "", style }: AchievementCardProps) {
  return (
    <Card 
      className={`glass-morphism transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${className}`}
      style={style}
      data-testid={`achievement-card-${achievement.id}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span 
            className="px-3 py-1 cosmic-gradient text-white rounded-full text-sm font-medium"
            data-testid={`achievement-year-${achievement.id}`}
          >
            {achievement.year}
          </span>
          <Award className="w-6 h-6 text-kasavu" />
        </div>
        <h3 className="text-xl font-poppins font-semibold mb-3 text-foreground" data-testid={`achievement-title-${achievement.id}`}>
          {achievement.title}
        </h3>
        <p className="text-muted-foreground" data-testid={`achievement-description-${achievement.id}`}>
          {achievement.description}
        </p>
      </CardContent>
    </Card>
  );
}
