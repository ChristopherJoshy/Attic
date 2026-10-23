/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Layout Component - Global layout wrapper for the application.
 * Provides the main background structure, animations, and the global online user counter.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * Layout: Main component.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React types.
 * framer-motion: Page transitions.
 * components: OnlineCounter.
 */

import { ReactNode, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import OnlineCounter from './OnlineCounter'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const refCode = params.get('ref')
    if (refCode) {
      localStorage.setItem('referral_code', refCode)
    }
  }, [])

  return (
    <div className="min-h-screen w-full bg-bg-primary text-text-primary relative selection:bg-white/10">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/80" />
      </div>

      <AnimatePresence mode="wait">
        <motion.main
          aria-label="Main content"
          initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full relative z-10 min-h-screen"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <OnlineCounter />
    </div>
  )
}
