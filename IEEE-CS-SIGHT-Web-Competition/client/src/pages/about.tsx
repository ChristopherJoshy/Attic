import { SectionHeading } from "@/components/ui/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";

export default function About() {
  const { ref: contentRef, isIntersecting: contentVisible } = useIntersectionObserver();
  const { ref: valuesRef, isIntersecting: valuesVisible } = useIntersectionObserver();

  return (
    <div className="py-20 px-4 pt-32" data-testid="about-page">
      <div className="container mx-auto">
        <SectionHeading
          title="About IEEE SIGHT"
          subtitle="Bridging technology and humanity for sustainable impact"
        />

        <div 
          ref={contentRef}
          className={`grid md:grid-cols-2 gap-12 items-center mb-16 transition-all duration-1000 ${
            contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          data-testid="about-content"
        >
          <div className="space-y-6">
            <Card className="glass-morphism card-cosmic">
              <CardContent className="p-8">
                <h3 className="text-2xl font-poppins font-semibold mb-4 text-primary">Our Local Chapter</h3>
                <p className="text-muted-foreground leading-relaxed" data-testid="local-chapter-description">
                  IEEE SIGHT at the College of Engineering Karunagappally represents a dedicated community of engineering students and faculty committed to leveraging technology for social good. As part of IEEE Student Branch CEK, we focus on developing innovative solutions that address the unique challenges faced by communities across Kerala, from rural connectivity issues to sustainable energy access.
                </p>
              </CardContent>
            </Card>
            
            <Card className="glass-morphism card-cosmic">
              <CardContent className="p-8">
                <h3 className="text-2xl font-poppins font-semibold mb-4 text-magenta-400">IEEE SIGHT Global</h3>
                <p className="text-muted-foreground leading-relaxed" data-testid="global-sight-description">
                  IEEE SIGHT (Special Interest Group on Humanitarian Technology) is a global network of IEEE volunteers dedicated to applying technology for the benefit of humanity. With over 200 SIGHT groups worldwide, we collaborate on projects that provide sustainable solutions to challenges faced by underserved communities, focusing on education, healthcare, economic development, and infrastructure.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
              alt="IEEE SIGHT team collaboration" 
              className="rounded-2xl shadow-2xl w-full h-auto bw-image"
              data-testid="about-image"
            />
            
            {/* Floating elements */}
            <div className="absolute -top-6 -left-6 w-12 h-12 bg-gradient-to-br from-primary to-transparent rounded-full opacity-60 animate-float"></div>
            <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-gradient-to-br from-magenta-500 to-transparent rounded-full opacity-60 animate-float" style={{ animationDelay: "1s" }}></div>
          </div>
        </div>

        {/* Mission, Vision, Values */}
        <div 
          ref={valuesRef}
          className={`grid md:grid-cols-3 gap-8 transition-all duration-1000 ${
            valuesVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          data-testid="values-section"
        >
          <Card className="glass-morphism card-cosmic text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 cosmic-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-poppins font-semibold mb-4 text-primary">Mission</h3>
              <p className="text-muted-foreground" data-testid="mission-description">
                To leverage engineering expertise and innovation to create sustainable technological solutions that improve the quality of life for underserved communities.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-morphism card-cosmic text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-magenta-500 to-kasavu rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-poppins font-semibold mb-4 text-magenta-400">Vision</h3>
              <p className="text-muted-foreground" data-testid="vision-description">
                A world where technology serves as a bridge to equality, ensuring every community has access to the tools and knowledge needed for sustainable development.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-morphism card-cosmic text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-kasavu to-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-poppins font-semibold mb-4 text-kasavu">Values</h3>
              <p className="text-muted-foreground" data-testid="values-description">
                Innovation, Collaboration, Sustainability, Inclusivity, and Ethical Technology Development guide every project we undertake.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
