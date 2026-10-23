import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const ErrorPage: React.FC = () => {
  const castleVariants = {
    hover: {
      scale: 1.1,
      rotate: [0, -5, 5, -5, 0],
      transition: {
        duration: 0.3
      }
    }
  };

  const textVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.2
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 relative overflow-hidden"
    >
      <motion.div
        initial="initial"
        animate="animate"
        className="text-center p-8 relative z-10"
      >
        <motion.div
          variants={castleVariants}
          whileHover="hover"
          className="text-6xl mb-4 cursor-pointer"
        >
          🏰
        </motion.div>
        
        <motion.div variants={textVariants}>
          <motion.h1 
            className="medieval-title text-4xl mb-4"
            animate={{
              textShadow: [
                "0 0 8px #ffd700",
                "0 0 16px #ffd700",
                "0 0 8px #ffd700"
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            Alas! A Quest Gone Awry
          </motion.h1>
          
          <motion.p 
            variants={textVariants}
            className="medieval-text text-xl mb-6"
          >
            The path you seek leads to uncharted territories.
            <br />
            Perhaps we should return to familiar grounds.
          </motion.p>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to="/"
              className="medieval-button inline-block px-6 py-3 text-lg relative group"
            >
              <motion.span
                className="absolute -left-4 opacity-0 group-hover:opacity-100"
                animate={{ x: [-10, 0], opacity: [0, 1] }}
                transition={{ duration: 0.3 }}
              >
                ⚔️
              </motion.span>
              Return to the Castle
              <motion.span
                className="absolute -right-4 opacity-0 group-hover:opacity-100"
                animate={{ x: [10, 0], opacity: [0, 1] }}
                transition={{ duration: 0.3 }}
              >
                🛡️
              </motion.span>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Background Decorations */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-yellow-400/20 text-4xl"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.5,
          }}
        >
          {['⚔️', '🛡️', '📜', '🗝️', '👑'][i]}
        </motion.div>
      ))}
    </motion.div>
  );
};

export default ErrorPage; 