import { SectionHeading } from "@/components/ui/section-heading";
import { AchievementCard } from "@/components/ui/achievement-card";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Calendar } from "lucide-react";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import achievementsRaw from "@/data/achievements.json?raw";
import { z } from "zod";
import { achievementSchema, type Achievement } from "@shared/schema";
import { Link } from "wouter";

let parsedAchievements: unknown = [];
try {
  parsedAchievements = JSON.parse(achievementsRaw);
} catch (e) {
  console.error("achievements.json is not valid JSON:", e);
}
const achievementsParse = z.array(achievementSchema).safeParse(parsedAchievements);
const achievements: Achievement[] = achievementsParse.success ? achievementsParse.data : [];
if (!achievementsParse.success) {
  console.error("Invalid achievements.json data:", achievementsParse.error?.message);
}

export default function Achievements() {
  const { ref: timelineRef, isIntersecting: timelineVisible } = useIntersectionObserver();
  const { ref: cardsRef, isIntersecting: cardsVisible } = useIntersectionObserver();

  return (
    <div className="py-20 px-4 pt-32" data-testid="achievements-page">
      <div className="container mx-auto">
        <SectionHeading
          title="Our Achievements"
          subtitle="Milestones in our journey of technological innovation for social impact"
        />

        {/* Timeline Layout for Desktop */}
        <div 
          ref={timelineRef}
          className={`hidden md:block relative transition-all duration-1000 ${
            timelineVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          data-testid="achievements-timeline"
        >
          {/* Central Timeline Line */}
          <div className="absolute left-1/2 transform -translate-x-0.5 w-1 h-full" style={{background: "linear-gradient(to bottom, #111 0%, #6366F1 33%, #EC4899 66%, #22C55E 100%)", opacity: 0.25}}></div>

          <div className="space-y-16">
            {achievements.map((achievement, index) => {
              const isLeft = index % 2 === 0;
              
              return (
                <div 
                  key={achievement.id} 
                  className="flex items-center"
                  data-testid={`achievement-timeline-${achievement.id}`}
                >
                  {isLeft ? (
                    <>
                      <div className="w-1/2 pr-8 text-right">
                        <Card className="glass-morphism card-cosmic">
                          <CardContent className="p-8">
                            <div className="inline-block px-3 py-1 cosmic-gradient text-white rounded-full text-sm font-medium mb-4">
                              {achievement.year}
                            </div>
                            <h3 className="text-2xl font-poppins font-semibold mb-4 text-foreground">
                              {achievement.title}
                            </h3>
                            <p className="text-muted-foreground">
                              {achievement.description}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="w-6 h-6 cosmic-gradient rounded-full relative z-10 flex-shrink-0"></div>
                      <div className="w-1/2 pl-8"></div>
                    </>
                  ) : (
                    <>
                      <div className="w-1/2 pr-8"></div>
                      <div className="w-6 h-6 cosmic-gradient rounded-full relative z-10 flex-shrink-0"></div>
                      <div className="w-1/2 pl-8">
                        <Card className="glass-morphism card-cosmic">
                          <CardContent className="p-8">
                            <div className="inline-block px-3 py-1 cosmic-gradient text-white rounded-full text-sm font-medium mb-4">
                              {achievement.year}
                            </div>
                            <h3 className="text-2xl font-poppins font-semibold mb-4 text-foreground">
                              {achievement.title}
                            </h3>
                            <p className="text-muted-foreground">
                              {achievement.description}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Card Layout for Mobile */}
        <div 
          ref={cardsRef}
          className={`md:hidden space-y-8 transition-all duration-1000 ${
            cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          data-testid="achievements-cards"
        >
          {achievements.map((achievement, index) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              className={`transition-all duration-500`}
              style={{ animationDelay: `${index * 100}ms` }}
            />
          ))}
        </div>

        {/* Achievement Statistics */}
        <div className="mt-16 grid md:grid-cols-3 gap-8" data-testid="achievement-stats">
          <Card className="glass-morphism card-cosmic text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 cosmic-gradient rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-primary mb-2">4+</div>
              <div className="text-muted-foreground">Major Recognitions</div>
            </CardContent>
          </Card>

          <Card className="glass-morphism card-cosmic text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-magenta-500 to-kasavu rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-magenta-400 mb-2">3</div>
              <div className="text-muted-foreground">Years of Excellence</div>
            </CardContent>
          </Card>

          <Card className="glass-morphism card-cosmic text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-kasavu to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
              </div>
              <div className="text-3xl font-bold text-kasavu mb-2">200+</div>
              <div className="text-muted-foreground">Global SIGHT Network</div>
            </CardContent>
          </Card>
        </div>

        {/* Future Goals */}
        <div className="mt-16 text-center">
          <Card className="glass-morphism card-cosmic max-w-2xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-2xl font-poppins font-semibold mb-4 text-primary">Looking Ahead</h3>
              <p className="text-muted-foreground mb-6">
                Our achievements are just the beginning. We continue to strive for greater impact, 
                expanding our reach and deepening our commitment to humanitarian technology.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/activities" className="btn-cosmic inline-flex items-center justify-center ink-link" data-testid="view-current-projects">
                  View Current Projects
                </Link>
                <Link href="/contact" className="btn-glass inline-flex items-center justify-center ink-link" data-testid="partner-with-us">
                  Partner With Us
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
