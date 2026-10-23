import { useEffect, useState } from "react";

interface Particle {
  id: number;
  size: number;
  top: number;
  left: number;
  delay: number;
}

export function CosmicBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    
    if (prefersReducedMotion) {
      return;
    }

    // Generate particles
    const newParticles: Particle[] = [];
    for (let i = 0; i < 5; i++) {
      newParticles.push({
        id: i,
        size: Math.random() * 12 + 4, // 4-16px
        top: Math.random() * 100,
        left: Math.random() * 100,
        delay: Math.random() * 4,
      });
    }
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="cosmic-particle hidden md:block"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            top: `${particle.top}%`,
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
