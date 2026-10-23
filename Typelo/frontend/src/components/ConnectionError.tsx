/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * ConnectionError Component - Full-screen error state when backend is unreachable.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * ConnectionError: Main component.
 * handleRetry: Manual retry action.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * retryCount: Number of failed retry attempts.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * framer-motion: Animations.
 * stores/connectionStore: Connection state.
 */

import { motion } from 'framer-motion'
import { useConnectionStore } from '../stores/connectionStore'

export default function ConnectionError() {
  const { retryCount, checkConnection } = useConnectionStore()

  const handleRetry = async () => {
    await checkConnection()
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-primary overflow-hidden">
      {/* Background pulse effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-radial from-accent-error/5 via-transparent to-transparent"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md text-center px-8">
        {/* Disconnected icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="relative"
        >
          {/* Outer ring with pulse */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-accent-error/30"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />

          {/* Icon container */}
          <div className="w-24 h-24 rounded-full border-2 border-accent-error/50 flex items-center justify-center bg-bg-secondary">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-accent-error"
            >
              {/* Server/plug disconnected icon */}
              <path d="M5 12h14" strokeLinecap="round" />
              <path d="M5 12l-2-2" strokeLinecap="round" />
              <path d="M5 12l-2 2" strokeLinecap="round" />
              <path d="M19 12l2-2" strokeLinecap="round" />
              <path d="M19 12l2 2" strokeLinecap="round" />
              <motion.path
                d="M12 5v3M12 16v3"
                strokeLinecap="round"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </svg>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-2"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Connection Lost
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            Unable to reach the server. Please check your connection or try again.
          </p>
        </motion.div>

        {/* Status info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-1 text-xs text-text-muted font-mono"
        >
          <span>STATUS: DISCONNECTED</span>
          {retryCount > 0 && (
            <span>RETRY ATTEMPTS: {retryCount}</span>
          )}
        </motion.div>

        {/* Retry button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRetry}
          className="relative px-8 py-3 bg-transparent border border-white/20 text-text-primary 
                     text-sm font-medium tracking-wide uppercase
                     transition-all duration-300 hover:border-white/40 hover:bg-white/5
                     focus:outline-none focus:ring-1 focus:ring-white/30"
        >
          <span className="relative z-10">Retry Connection</span>
        </motion.button>


      </div>

      {/* Decorative grid lines */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="h-full w-full" style={{
          backgroundImage: `
            linear-gradient(to right, white 1px, transparent 1px),
            linear-gradient(to bottom, white 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />
      </div>
    </div>
  )
}
