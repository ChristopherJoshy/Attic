import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import type { Activity } from "@shared/schema";

interface ActivityCardProps {
  activity: Activity;
  className?: string;
  style?: React.CSSProperties;
}

export function ActivityCard({ activity, className = "", style }: ActivityCardProps) {
  return (
    <Card 
      className={`glass-morphism overflow-hidden group active:scale-[0.99] transition-all duration-300 ${className}`}
      style={style}
      data-testid={`activity-card-${activity.id}`}
    >
      <div className="relative overflow-hidden">
        <img
          src={activity.image}
          alt={activity.title}
          className="w-full h-40 sm:h-48 object-cover group-hover:scale-105 transition-transform duration-500 bw-image"
          loading="lazy"
          decoding="async"
          data-testid={`activity-image-${activity.id}`}
        />
      </div>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <Badge 
            variant={activity.status === "upcoming" ? "default" : "secondary"}
            className={activity.status === "upcoming" ? "badge-upcoming" : "badge-past"}
            data-testid={`activity-status-${activity.id}`}
          >
            {activity.status === "past" ? "Past" : "Upcoming"}
          </Badge>
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span data-testid={`activity-date-${activity.id}`}>{activity.date}</span>
          </div>
        </div>
        <h3 className="text-lg sm:text-xl font-poppins font-semibold mb-2 sm:mb-3 text-foreground" data-testid={`activity-title-${activity.id}`}>
          {activity.title}
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4" data-testid={`activity-description-${activity.id}`}>
          {activity.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {activity.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-muted/50 text-muted-foreground rounded text-[11px] sm:text-xs"
              data-testid={`activity-tag-${activity.id}-${index}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
