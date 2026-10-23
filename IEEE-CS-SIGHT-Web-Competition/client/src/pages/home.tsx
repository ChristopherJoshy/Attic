import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { Leaf } from "lucide-react";

const statistics = [
  { value: "250+", label: "Lives Impacted", color: "text-primary" },
  { value: "15+", label: "Projects Completed", color: "text-magenta-400" },
  { value: "8+", label: "Community Partners", color: "text-kasavu" },
  { value: "3", label: "Years Active", color: "text-cyan-400" },
];

export default function Home() {
  const { ref: heroRef, isIntersecting: heroVisible } = useIntersectionObserver();
  const { ref: statsRef, isIntersecting: statsVisible } = useIntersectionObserver();

  return (
    <div id="main-content" className="relative">
      {/* Hero Section */}
      <section 
        ref={heroRef}
        className="min-h-screen flex items-center justify-center px-4 pt-20"
        data-testid="hero-section"
      >
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            {/* Hero Badge */}
            <div 
              className={`inline-flex items-center px-4 py-2 rounded-full glass-morphism mb-8 transition-all duration-1000 ${
                heroVisible ? "animate-float opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              data-testid="hero-badge"
            >
              <span className="w-2 h-2 bg-kasavu rounded-full mr-2 animate-pulse"></span>
              <span className="text-sm font-medium text-muted-foreground">IEEE Student Branch CEK</span>
            </div>

            {/* Main Heading */}
            <h1 
              className={`text-5xl md:text-7xl font-poppins font-bold mb-6 ieee-glow leading-tight transition-all duration-1000 delay-300 ${
                heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              data-testid="hero-title"
            >
              Empowering{" "}
              <span className="cosmic-gradient-text">
                Communities
              </span>
              <br />
              Through Technology
            </h1>

            {/* Subtitle */}
            <p 
              className={`text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed transition-all duration-1000 delay-500 ${
                heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              data-testid="hero-subtitle"
            >
              IEEE SIGHT at CEK bridges the digital divide by developing sustainable solutions 
              for underserved communities across Kerala and beyond.
            </p>

            {/* CTA Buttons */}
            <div 
              className={`flex flex-col sm:flex-row gap-4 justify-center mb-16 transition-all duration-1000 delay-700 ${
                heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              data-testid="hero-cta"
            >
              <Link href="/activities">
                <Button className="btn-cosmic" data-testid="cta-explore">
                  Explore Our Work
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" className="btn-glass" data-testid="cta-join">
                  Join Our Mission
                </Button>
              </Link>
            </div>

            {/* Statistics */}
            <div 
              ref={statsRef}
              className={`grid grid-cols-2 md:grid-cols-4 gap-6 transition-all duration-1000 ${
                statsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              data-testid="hero-stats"
            >
              {statistics.map((stat, index) => (
                <Card 
                  key={index} 
                  className="glass-morphism text-center card-cosmic"
                  style={{ animationDelay: `${index * 100}ms` }}
                  data-testid={`stat-card-${index}`}
                >
                  <CardContent className="p-6">
                    <div className={`text-3xl font-bold ${stat.color} mb-2`} data-testid={`stat-value-${index}`}>
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground" data-testid={`stat-label-${index}`}>
                      {stat.label}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission Overview */}
      <section className="py-20 px-4" data-testid="mission-section">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-poppins font-bold mb-6 ieee-glow">
              Our Mission
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              To leverage engineering expertise and innovation to create sustainable technological 
              solutions that improve the quality of life for underserved communities across Kerala and beyond.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="glass-morphism card-cosmic">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 cosmic-gradient rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🚀</span>
                  </div>
                  <h3 className="text-xl font-poppins font-semibold mb-3 text-primary">Innovation</h3>
                  <p className="text-muted-foreground">
                    Developing cutting-edge solutions for real-world challenges
                  </p>
                </CardContent>
              </Card>
              
              <Card className="glass-morphism card-cosmic">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-magenta-500 to-kasavu rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🤝</span>
                  </div>
                  <h3 className="text-xl font-poppins font-semibold mb-3 text-magenta-400">Collaboration</h3>
                  <p className="text-muted-foreground">
                    Working with communities to understand and address their needs
                  </p>
                </CardContent>
              </Card>
              
      <Card className="glass-morphism card-cosmic">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-kasavu to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <Leaf className="w-7 h-7 text-white" aria-label="Sustainability" />
                  </div>
                  <h3 className="text-xl font-poppins font-semibold mb-3 text-kasavu">Sustainability</h3>
                  <p className="text-muted-foreground">
                    Creating long-term impact through environmentally conscious solutions
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
