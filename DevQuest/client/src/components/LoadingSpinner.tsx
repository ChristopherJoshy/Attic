import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-center min-h-[200px]"
    >
      <div className="relative">
        <motion.div
          className="absolute inset-0"
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: {
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            },
            scale: {
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }
          }}
        >
          <div className="w-16 h-16 border-4 border-yellow-600/30 border-t-yellow-400 rounded-full" />
        </motion.div>
        
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
            rotate: [0, 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="text-4xl relative z-10"
        >
          ⚔️
        </motion.div>

        <motion.div
          className="absolute -top-8 left-1/2 transform -translate-x-1/2"
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <motion.span
            animate={{
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-yellow-400 text-xl"
          >
            ✨
          </motion.span>
        </motion.div>

        <motion.div
          className="absolute -bottom-8 left-1/2 transform -translate-x-1/2"
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <span className="medieval-text text-yellow-400/90">Loading...</span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LoadingSpinner; 