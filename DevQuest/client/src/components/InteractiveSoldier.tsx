import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SoldierProps {
  id: number;
  onDeath: (id: number) => void;
  messages: string[];
}

const InteractiveSoldier: React.FC<SoldierProps> = ({ id, onDeath, messages }) => {
  const [position, setPosition] = useState({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight });
  const [direction, setDirection] = useState(1); // 1 for right, -1 for left
  const [isDead, setIsDead] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const walkInterval = setInterval(() => {
      if (!isDead) {
        setPosition(prev => {
          const newX = prev.x + (direction * 2);
          const maxWidth = containerRef.current?.offsetWidth || window.innerWidth;
          
          if (newX > maxWidth - 50) {
            setDirection(-1);
            return { ...prev, x: maxWidth - 50 };
          } else if (newX < 0) {
            setDirection(1);
            return { ...prev, x: 0 };
          }
          
          return { ...prev, x: newX };
        });
      }
    }, 50);

    return () => clearInterval(walkInterval);
  }, [direction, isDead]);

  const handleClick = (e: React.MouseEvent) => {
    if (e.button === 0 && !isDead) { // Left click
      setIsDead(true);
      onDeath(id);
    } else if (!isDead) {
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      setCurrentMessage(randomMessage);
      setShowMessage(true);
      setTimeout(() => setShowMessage(false), 3000);
    }
  };

  return (
    <motion.div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        userSelect: 'none',
        cursor: 'pointer',
      }}
      onMouseDown={handleClick}
    >
      <AnimatePresence>
        {!isDead ? (
          <motion.div
            initial={{ scale: 1 }}
            animate={{ 
              scale: [1, 1.1, 1],
              rotateY: direction > 0 ? 0 : 180
            }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="medieval-text"
            style={{ fontSize: '2rem' }}
          >
            ⚔️
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.2, opacity: 0 }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.5 }}
            className="medieval-text"
            style={{ fontSize: '2rem' }}
          >
            💀
          </motion.div>
        )}
        {showMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: -20 }}
            exit={{ opacity: 0 }}
            className="medieval-text dialog-box"
            style={{
              position: 'absolute',
              top: -50,
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              zIndex: 100
            }}
          >
            {currentMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default InteractiveSoldier; 