import { useEffect } from 'react';

const CursorTrail = () => {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const trail = document.createElement('div');
      trail.className = 'cursor-trail';
      trail.style.left = `${e.clientX}px`;
      trail.style.top = `${e.clientY}px`;
      document.body.appendChild(trail);
      
      setTimeout(() => {
        if (trail && trail.parentNode === document.body) {
          document.body.removeChild(trail);
        }
      }, 800);
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      
      // Clean up any remaining trail elements
      const trails = document.querySelectorAll('.cursor-trail');
      trails.forEach(trail => {
        if (trail.parentNode === document.body) {
          document.body.removeChild(trail);
        }
      });
    };
  }, []);

  return null;
};

export default CursorTrail; 