import React from 'react';
import { motion } from 'framer-motion';

const Footer: React.FC = () => {
  return (
    <motion.footer 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative bg-stone-900 border-t-2 border-yellow-900/30"
    >
      <div className="absolute inset-0 bg-[url('/textures/stone.png')] opacity-20" />
      
      <div className="container mx-auto px-4 py-12 relative">
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-12"
        >
          <motion.div 
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="space-y-4"
          >
            <h3 className="medieval-text text-xl text-yellow-400/90 mb-4 flex items-center">
              <motion.span 
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-2xl mr-2"
              >
                🗺️
              </motion.span> 
              Navigation
            </h3>
            <ul className="space-y-2">
              {['Home', 'Quests', 'Skills', 'Education', 'Contact'].map((item, index) => (
                <motion.li 
                  key={item}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <a
                    href={`#${item.toLowerCase()}`}
                    className="medieval-text text-gray-300/90 hover:text-yellow-400/90 transition-colors flex items-center"
                  >
                    <motion.span 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-yellow-600/50 mr-2"
                    >
                      ✧
                    </motion.span> 
                    {item}
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="space-y-4"
          >
            <h3 className="medieval-text text-xl text-yellow-400/90 mb-4 flex items-center">
              <motion.span 
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="text-2xl mr-2"
              >
                🤝
              </motion.span> 
              Connect
            </h3>
            <ul className="space-y-2">
              {[
                { name: 'GitHub', icon: '⚒️' },
                { name: 'LinkedIn', icon: '📜' },
                { name: 'Twitter', icon: '📯' },
                { name: 'Discord', icon: '🗣️' }
              ].map((item, index) => (
                <motion.li 
                  key={item.name}
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ x: 10 }}
                >
                  <a
                    href="#"
                    className="medieval-text text-gray-300/90 hover:text-yellow-400/90 transition-colors flex items-center"
                  >
                    <motion.span 
                      whileHover={{ scale: 1.2, rotate: 20 }}
                      className="mr-2"
                    >
                      {item.icon}
                    </motion.span> 
                    {item.name}
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="space-y-4"
          >
            <h3 className="medieval-text text-xl text-yellow-400/90 mb-4 flex items-center">
              <motion.span 
                animate={{ 
                  y: [0, -5, 0],
                  rotateZ: [0, -10, 10, -10, 0]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-2xl mr-2"
              >
                📬
              </motion.span> 
              Royal Newsletter
            </h3>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="medieval-text text-gray-300/90 mb-4"
            >
              Subscribe to receive tales of my latest quests and adventures
            </motion.p>
            <motion.form 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex space-x-2"
            >
              <motion.input
                whileFocus={{ scale: 1.02 }}
                type="email"
                placeholder="Enter thy email..."
                className="flex-1 bg-stone-800/50 border-2 border-yellow-900/50 rounded-lg px-4 py-2 text-yellow-50 medieval-text focus:border-yellow-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 transition-all"
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                className="medieval-button px-4 py-2"
              >
                Join
              </motion.button>
            </motion.form>
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 pt-8 border-t border-yellow-900/30 text-center"
        >
          <motion.p 
            animate={{ 
              textShadow: ["0 0 8px #ffd700", "0 0 0px #ffd700"]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="medieval-text text-gray-300/90"
          >
            © {new Date().getFullYear()} | Crafted with 
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="inline-block mx-1"
            >
              🔮
            </motion.span> 
            by Your Name
          </motion.p>
          <div className="flex justify-center space-x-4 mt-4">
            {["⚔️", "🛡️", "🏰"].map((emoji, index) => (
              <motion.div
                key={emoji}
                animate={{
                  y: [0, -5, 0],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.3,
                }}
              >
                {emoji}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
};

export default Footer; 