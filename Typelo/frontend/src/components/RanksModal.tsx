/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * RanksModal Component - Displays the different rank tiers and their ELO ranges.
 * Highlights the current user's rank.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * RanksModal: Main component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * ranks: Array of available ranks.
 * rankConfig: Configuration for rank colors and ELO ranges.
 * currentRank: Users current rank to highlight.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * framer-motion: Animations.
 * types: Rank types.
 * components: RankBadge.
 */

import { motion, AnimatePresence } from 'framer-motion'
import type { Rank } from '../types'
import RankBadge, { rankConfig } from './icons/RankBadge'

interface RanksModalProps {
  isOpen: boolean
  onClose: () => void
  currentRank: Rank
}

const ranks: Rank[] = ['Unranked', 'Bronze', 'Gold', 'Platinum', 'Ranker']

export default function RanksModal({ isOpen, onClose, currentRank }: RanksModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-bg-secondary/95 border border-white/10 backdrop-blur-xl rounded-2xl w-full max-w-md overflow-hidden"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-tight">Rank Tiers</h2>
                  <button
                    onClick={onClose}
                    className="text-text-muted hover:text-text-primary transition-colors p-1"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Climb the ranks by winning matches
                </p>
              </div>

              {/* Ranks List */}
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {ranks.map((rank, index) => {
                  const config = rankConfig[rank]
                  const isCurrent = rank === currentRank

                  return (
                    <motion.div
                      key={rank}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      className={`relative flex items-center gap-4 p-4 rounded-xl transition-all border ${isCurrent
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/10'
                        }`}
                    >
                      {/* Current indicator */}
                      {isCurrent && (
                        <motion.div
                          className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full"
                          style={{ backgroundColor: config.primaryColor }}
                          layoutId="currentRank"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}

                      {/* Badge */}
                      <RankBadge
                        rank={rank}
                        size={48}
                        animate={isCurrent}
                      />

                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-semibold"
                            style={{ color: config.primaryColor }}
                          >
                            {rank}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase tracking-wider bg-accent-primary/20 px-2 py-0.5 rounded-full text-accent-primary font-bold border border-accent-primary/20">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-text-muted font-mono">
                          {config.eloRange} ELO
                        </p>
                      </div>

                      {/* Tier number */}
                      <div className="text-right">
                        <span className={`text-2xl font-bold ${isCurrent ? 'text-white/30' : 'text-white/10'}`}>
                          {index + 1}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                <p className="text-xs text-text-muted text-center">
                  Win matches to gain ELO and rank up. Unranked players cannot lose ELO.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
