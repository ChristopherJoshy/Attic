import { useState } from "react";
import { Link } from "wouter";
import { SectionHeading } from "@/components/ui/section-heading";
import { ActivityCard } from "@/components/ui/activity-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import activitiesRaw from "@/data/activities.json?raw";
import { z } from "zod";
import { activitySchema, type Activity } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Handshake, FilePlus2 } from "lucide-react";

let parsedActivities: unknown = [];
try {
  parsedActivities = JSON.parse(activitiesRaw);
} catch (e) {
  console.error("activities.json is not valid JSON:", e);
}
const activitiesParse = z.array(activitySchema).safeParse(parsedActivities);
const activities: Activity[] = activitiesParse.success ? activitiesParse.data : [];
if (!activitiesParse.success) {
  console.error("Invalid activities.json data:", activitiesParse.error?.message);
}

type FilterType = "all" | "upcoming" | "past";

export default function Activities() {
  const [filter, setFilter] = useState<FilterType>("all");
  const { ref: filtersRef, isIntersecting: filtersVisible } = useIntersectionObserver();
  const { ref: activitiesRef, isIntersecting: activitiesVisible } = useIntersectionObserver();

  const filteredActivities = activities.filter(activity => 
    filter === "all" || activity.status === filter
  );

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "All Events" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past Events" },
  ];

  return (
    <div className="py-16 sm:py-20 px-3 sm:px-4 pt-28 sm:pt-32" data-testid="activities-page">
      <div className="container mx-auto">
        <SectionHeading
          title="Our Activities"
          subtitle="Transforming communities through innovative technology initiatives"
        />

        {/* Filter Controls */}
        <div 
          ref={filtersRef}
          className={`flex flex-wrap justify-center gap-2.5 sm:gap-3 md:gap-4 mb-8 sm:mb-12 transition-all duration-1000 ${
            filtersVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          data-testid="activity-filters"
        >
          {filterButtons.map((button) => (
            <Button
              key={button.key}
              onClick={() => setFilter(button.key)}
        size="sm"
              className={
                filter === button.key
          ? "btn-cosmic rounded-full shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
          : "btn-glass rounded-full shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
              }
        aria-pressed={filter === button.key}
              data-testid={`filter-${button.key}`}
            >
              {button.label}
            </Button>
          ))}
        </div>

        {/* Activities Grid */}
        <div 
          ref={activitiesRef}
          className={`grid md:grid-cols-2 gap-6 sm:gap-8 transition-all duration-1000 ${
            activitiesVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          data-testid="activities-grid"
        >
          {filteredActivities.map((activity, index) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
      className={`transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
              style={{ animationDelay: `${index * 100}ms` }}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredActivities.length === 0 && (
          <div className="text-center py-12" data-testid="empty-state">
            <div className="w-24 h-24 cosmic-gradient rounded-full flex items-center justify-center mx-auto mb-6 opacity-50">
              <span className="text-3xl">📅</span>
            </div>
            <h3 className="text-2xl font-poppins font-semibold mb-4 text-foreground">
              No activities found
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              There are no activities matching your current filter. Try selecting a different filter or check back later for updates.
            </p>
          </div>
        )}

  {/* View More Section removed as requested */}

        {/* Call to Action */}
        <div className="mt-12 sm:mt-16 text-center">
          <div className="glass-morphism rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto accent-border-top accent-border-bottom">
            <h3 className="text-2xl font-poppins font-semibold mb-4 text-primary">Get Involved</h3>
            <p className="text-muted-foreground mb-5 sm:mb-6 text-sm sm:text-base">
              Want to participate in our upcoming activities or propose a new initiative? 
              We welcome volunteers and collaborators who share our vision.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/contact?subject=volunteer"
                className={cn(buttonVariants({ size: "sm", className: "btn-cosmic" }))}
                data-testid="volunteer-button"
                aria-label="Become a Volunteer"
              >
                <Handshake className="mr-2" />
                Become a Volunteer
              </Link>
              <Link
                href="/contact?subject=project"
                className={cn(buttonVariants({ size: "sm", variant: "outline", className: "btn-glass" }))}
                data-testid="propose-project"
                aria-label="Propose a Project"
              >
                <FilePlus2 className="mr-2" />
                Propose a Project
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
