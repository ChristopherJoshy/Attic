/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Result Component - Displays match outcomes, stats, and ELO changes.
 * Handles victory/defeat animations and play again functionality.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * Result: Main component.
 * MobileStatsRow: Helper for mobile layout rows.
 * MobilePlayerCard: Helper for mobile player profile.
 * MobileStatsGrid: Helper for mobile stats grid.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * isWin: Result status.
 * eloChange: Calculations for ELO change.
 * displayedElo: Animated ELO value.
 * springElo: Spring animation for ELO.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 * stores: Auth, Game stores.
 * hooks: useWebSocket, useSound.
 * types: MatchResult, Ranks.
 */

import { motion, useSpring, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import type { MatchResult } from '../types'
import { getRankFromElo, getRankColor } from '../types'
import { useWebSocket } from '../hooks/useWebSocket'
import { useGameStore } from '../stores/gameStore'
import { useSound } from '../hooks/useSound'

interface ResultProps {
  result: MatchResult
  onPlayAgain: () => void
  keyStats?: Record<string, { total: number; errors: number }>
}

export default function Result({ result, onPlayAgain, keyStats }: ResultProps) {
  const navigate = useNavigate()
  const { joinQueue, joinTrainingQueue, leaveQueue } = useWebSocket()
  const { playSound } = useSound()
  const isWin = result.result === 'win'
  const isTie = result.result === 'tie'
  const isTraining = result.gameMode === 'training'
  const isFriends = result.gameMode === 'friends'

  const eloChange = isTraining ? 0 : result.yourEloChange

  // Play victory/defeat sound on mount using the sound hook
  useEffect(() => {
    // Small delay to ensure browser allows audio (after user interaction in game)
    const timer = setTimeout(() => {
      if (isWin) {
        playSound('victory')
      } else if (!isTie) {
        playSound('defeat')
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [isWin, isTie, playSound])

  // Elo Animation
  const [displayedElo, setDisplayedElo] = useState(result.yourEloBefore)
  const springElo = useSpring(result.yourEloBefore, { duration: 2000, bounce: 0 })

  // Animated ELO change display
  const [displayedChange, setDisplayedChange] = useState(0)
  const [showChange, setShowChange] = useState(false)
  const springChange = useSpring(0, { duration: 1500, bounce: 0.2 })

  useEffect(() => {
    const timeout = setTimeout(() => {
      springElo.set(result.yourEloAfter)
    }, 500)

    // Start change animation after a delay
    const changeTimeout = setTimeout(() => {
      setShowChange(true)
      springChange.set(eloChange)
    }, 800)

    const unsubscribe = springElo.on('change', (latest) => {
      setDisplayedElo(Math.round(latest))
    })

    const unsubscribeChange = springChange.on('change', (latest) => {
      setDisplayedChange(Math.round(latest))
    })

    return () => {
      clearTimeout(timeout)
      clearTimeout(changeTimeout)
      unsubscribe()
      unsubscribeChange()
    }
  }, [result.yourEloAfter, eloChange, springElo, springChange])

  // Keyboard shortcut: Press 'R' to play again
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no modifiers and key is r/R
      if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'r') {
        onPlayAgain()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onPlayAgain])

  // Rank Up Check
  const rankBefore = getRankFromElo(result.yourEloBefore)
  const rankAfter = getRankFromElo(result.yourEloAfter)
  const isRankUp = rankAfter !== rankBefore && eloChange > 0

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  const { user } = useAuthStore()

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full h-full max-w-5xl mx-auto px-4 py-6 md:py-12 flex flex-col justify-center overflow-y-auto relative"
    >
      {/* Minimal edge color bleed - subtle gradient from edges */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Top edge bleed */}
        <div
          className="absolute top-0 left-0 right-0 h-[300px]"
          style={{
            background: isWin
              ? 'linear-gradient(to bottom, rgba(34, 197, 94, 0.08) 0%, transparent 100%)'
              : isTie
                ? 'linear-gradient(to bottom, rgba(100, 100, 100, 0.05) 0%, transparent 100%)'
                : 'linear-gradient(to bottom, rgba(239, 68, 68, 0.06) 0%, transparent 100%)'
          }}
        />
        {/* Left edge accent */}
        <div
          className="absolute top-0 left-0 bottom-0 w-1"
          style={{
            background: isWin
              ? 'linear-gradient(to bottom, rgba(34, 197, 94, 0.4) 0%, rgba(34, 197, 94, 0.1) 50%, transparent 100%)'
              : isTie
                ? 'linear-gradient(to bottom, rgba(100, 100, 100, 0.2) 0%, transparent 100%)'
                : 'linear-gradient(to bottom, rgba(214, 37, 37, 0.4) 0%, rgba(239, 68, 68, 0.1) 50%, transparent 100%)'
          }}
        />
      </div>

      {/* Result Header - Minimal Clean Design - No Glows */}
      <motion.div
        variants={itemVariants}
        className="text-center mb-12 relative z-10"
      >
        {/* Small status text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-[10px] font-medium tracking-[0.3em] uppercase text-white/30 mb-6"
        >
          {isTraining ? 'Training Complete' : 'Match Complete'}
        </motion.p>

        {/* Main Result Text - Pure Typography */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-6xl md:text-8xl font-thin tracking-tighter"
          style={{ color: isWin ? '#4ade80' : isTie ? '#9ca3af' : '#f87171' }}
        >
          {isWin ? 'VICTORY' : isTie ? 'DRAW' : 'DEFEAT'}
        </motion.h2>

        {/* Your Elo Change - Minimal */}
        {!isTraining && eloChange !== 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 flex items-center justify-center gap-2"
          >
            <span className="text-xs uppercase tracking-widest text-white/40">Rating Change</span>
            <span className={`font-mono text-xl ${eloChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {eloChange > 0 ? '+' : ''}{displayedChange}
            </span>
          </motion.div>
        )}

        {/* Coins Earned Display */}
        {result.coinsEarned !== undefined && result.coinsEarned > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-2 flex items-center justify-center gap-2"
          >
            <div className="w-5 h-5 rounded-full bg-yellow-400/20 flex items-center justify-center border border-yellow-400/50">
              <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
            </div>

            {result.baseCoins && result.baseCoins < result.coinsEarned ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg text-white/40 line-through tracking-wide decoration-white/40 decoration-2">
                  +{result.baseCoins}
                </span>
                <span className="font-mono text-xl text-yellow-400 tracking-wide font-bold">
                  +{result.coinsEarned} Coins
                </span>

                {(result.rankBonusCoins || 0) > 0 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.8, type: 'spring' }}
                    className="flex items-center gap-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded px-2 py-0.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-yellow-400">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    <span className="text-[10px] font-bold text-yellow-200 uppercase tracking-wider">Rank Boost</span>
                  </motion.div>
                )}

                {(result.leaderboardBonusCoins || 0) > 0 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.9, type: 'spring' }}
                    className="flex items-center gap-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded px-2 py-0.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-purple-400">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-[10px] font-bold text-purple-200 uppercase tracking-wider">Leaderboard</span>
                  </motion.div>
                )}
              </div>
            ) : (
              <span className="font-mono text-lg text-yellow-400 tracking-wide">+{result.coinsEarned} Coins</span>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Main Stats Card - Minimal Transparent */}
      <motion.div
        variants={itemVariants}
        className="w-full relative z-10 max-w-4xl mx-auto"
      >
        {/* Main card - No background, just clean layout */}
        <div className="relative">

          {/* Desktop Layout: Clean Table-like Structure */}
          <div className="hidden md:block relative z-10">
            {/* Players Header Row */}
            <div className="flex items-end justify-between mb-8 px-4">
              {/* Player (Left) */}
              <div className="flex flex-col items-start gap-3">
                <div className="relative">
                  <div className={`w-20 h-20 rounded-full border ${isWin ? 'border-emerald-500/50' : 'border-white/10'} p-1`}>
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="You" className="w-full h-full rounded-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-xl font-light text-white/60">
                        {user?.displayName?.charAt(0) || 'Y'}
                      </div>
                    )}
                  </div>
                  {isRankUp && (
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                      Rank Up
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-light text-white tracking-tight">You</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-white/40 uppercase tracking-wider">{rankAfter}</p>
                    <span className="text-xs font-mono text-white/60">{displayedElo}</span>
                  </div>
                </div>
              </div>

              {/* VS Divider */}
              <div className="flex flex-col items-center pb-4">
                <div className="h-12 w-px bg-gradient-to-b from-white/0 via-white/10 to-white/0 mb-2"></div>
                <span className="text-xs font-light text-white/20 tracking-[0.2em] uppercase">VS</span>
                <div className="h-12 w-px bg-gradient-to-b from-white/0 via-white/10 to-white/0 mt-2"></div>
              </div>

              {/* Opponent (Right) */}
              <div className="flex flex-col items-end gap-3 text-right">
                <div className="relative">
                  <div className={`w-20 h-20 rounded-full border ${!isWin && !isTie ? 'border-emerald-500/50' : 'border-white/10'} p-1`}>
                    {result.opponentPhotoURL && !result.opponentIsBot ? (
                      <img src={result.opponentPhotoURL} alt={result.opponentDisplayName} className="w-full h-full rounded-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-xl font-light text-white/60">
                        {result.opponentIsBot ? (
                          <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/60">
                            <rect x="3" y="11" width="18" height="10" rx="2" />
                            <circle cx="12" cy="5" r="2" />
                            <path d="M12 7v4" />
                            <line x1="8" y1="16" x2="8" y2="16" />
                            <line x1="16" y1="16" x2="16" y2="16" />
                          </svg>
                        ) : (
                          result.opponentDisplayName?.charAt(0) || '?'
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-light text-white tracking-tight">{result.opponentIsBot ? 'Bot' : result.opponentDisplayName}</h3>
                  <div className="flex items-center justify-end gap-2">
                    {/* Opponent Elo Change */}
                    {!isTraining && result.opponentEloChange !== 0 && (
                      <span className={`text-xs font-mono ${result.opponentEloChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {result.opponentEloChange > 0 ? '+' : ''}{result.opponentEloChange}
                      </span>
                    )}
                    <span className="text-xs font-mono text-white/60">{result.opponentElo ?? (result.opponentIsBot ? 1000 : '???')}</span>
                    <p className="text-xs text-white/40 uppercase tracking-wider">{result.opponentRank}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid - Minimal Lines */}
            <div className="border-t border-white/5 border-b border-white/5 divide-y divide-white/5">
              {/* Rows */}
              {[
                { label: 'WPM', p1: Math.round(result.yourWpm), p2: Math.round(result.opponentWpm) },
                { label: 'Accuracy', p1: Math.round(result.yourAccuracy) + '%', p2: Math.round(result.opponentAccuracy) + '%' },
                { label: 'Score', p1: Math.round(result.yourScore), p2: Math.round(result.opponentScore) }
              ].map((row, i) => (
                <div key={i} className="flex items-center py-4 px-4 hover:bg-white/[0.01] transition-colors">
                  <div className="flex-1 text-left">
                    <span className={`text-2xl font-mono font-light ${parseInt(row.p1.toString()) >= parseInt(row.p2.toString()) ? 'text-white' : 'text-white/30'}`}>
                      {row.p1}
                    </span>
                  </div>
                  <div className="w-32 text-center text-xs uppercase tracking-widest text-white/20 font-medium">
                    {row.label}
                  </div>
                  <div className="flex-1 text-right">
                    <span className={`text-2xl font-mono font-light ${parseInt(row.p2.toString()) > parseInt(row.p1.toString()) ? 'text-white' : 'text-white/30'}`}>
                      {row.p2}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Layout: Stacked Minimal */}
          <div className="block md:hidden">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* You */}
              <div className="bg-white/[0.02] rounded-lg p-4 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white/10 mb-2 overflow-hidden">
                  {user?.photoURL ? <img src={user.photoURL} alt="You" /> : <div className="w-full h-full flex items-center justify-center">Y</div>}
                </div>
                <div className="font-bold text-white mb-0.5">You</div>
                <div className="text-[10px] text-white/40 mb-2">{rankAfter}</div>
                <div className={`text-xs font-mono ${eloChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {eloChange > 0 ? '+' : ''}{displayedChange}
                </div>
              </div>

              {/* Opponent */}
              <div className="bg-white/[0.02] rounded-lg p-4 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white/10 mb-2 overflow-hidden">
                  {result.opponentPhotoURL ? <img src={result.opponentPhotoURL} alt="Opp" /> : <div className="w-full h-full flex items-center justify-center">?</div>}
                </div>
                <div className="font-bold text-white mb-0.5 truncate max-w-full">{result.opponentDisplayName}</div>
                <div className="text-[10px] text-white/40 mb-2">{result.opponentRank}</div>
                {!isTraining && (
                  <div className={`text-xs font-mono flex items-center gap-1 ${result.opponentEloChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span>{result.opponentEloChange > 0 ? '+' : ''}{result.opponentEloChange}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Stats */}
            <div className="space-y-2">
              <MobileStatsRow label="WPM" p1={Math.round(result.yourWpm)} p2={Math.round(result.opponentWpm)} />
              <MobileStatsRow label="ACC" p1={Math.round(result.yourAccuracy) + '%'} p2={Math.round(result.opponentAccuracy) + '%'} />
              <MobileStatsRow label="SCORE" p1={Math.round(result.yourScore)} p2={Math.round(result.opponentScore)} />
            </div>
          </div>

          {/* Trouble Keys - Minimal */}
          {keyStats && Object.keys(keyStats).some(k => keyStats[k].errors > 0) && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <span className="text-[10px] text-white/20 uppercase tracking-widest">Opportunities for Improvement</span>
              <div className="flex gap-2">
                {Object.entries(keyStats)
                  .filter(([_, stats]) => stats.errors > 0)
                  .sort((a, b) => b[1].errors - a[1].errors)
                  .slice(0, 4)
                  .map(([key]) => (
                    <span key={key} className="w-8 h-8 rounded border border-white/5 flex items-center justify-center text-sm font-mono text-white/50">
                      {key.toUpperCase()}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Action Buttons - Minimal Outlines */}
      <motion.div
        variants={itemVariants}
        className="flex justify-center items-center gap-4 mt-16 pb-8"
      >
        <button
          onClick={() => {
            useGameStore.getState().reset()
            navigate('/dashboard')
          }}
          className="px-6 py-2 rounded text-xs font-medium uppercase tracking-widest text-white/30 hover:text-white transition-colors hover:bg-white/5"
        >
          Dashboard
        </button>

        <button
          onClick={() => {
            useGameStore.getState().reset();
            useGameStore.getState().leaveQueue();
            leaveQueue();
            setTimeout(() => {
              if (isTraining) {
                useGameStore.getState().joinTrainingQueue();
                joinTrainingQueue();
              } else {
                useGameStore.getState().joinQueue();
                joinQueue();
              }
              navigate('/dashboard');
            }, 500);
          }}
          className="px-8 py-3 rounded border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-sm font-medium uppercase tracking-widest text-emerald-400 transition-all flex items-center gap-2"
        >
          {isTraining ? 'Train Again' : 'Play Again'}
          <span className="text-[10px] opacity-40 border border-current px-1 rounded">R</span>
        </button>
      </motion.div>
    </motion.div >
  )
}

function MobileStatsRow({ label, p1, p2 }: { label: string, p1: string | number, p2: string | number }) {
  const v1 = parseInt(p1.toString());
  const v2 = parseInt(p2.toString());
  return (
    <div className="flex items-center justify-between p-3 rounded bg-white/[0.02] border border-white/5">
      <span className={`font-mono font-bold ${v1 >= v2 ? 'text-white' : 'text-white/30'}`}>{p1}</span>
      <span className="text-[10px] uppercase tracking-widest text-white/20">{label}</span>
      <span className={`font-mono font-bold ${v2 > v1 ? 'text-white' : 'text-white/30'}`}>{p2}</span>
    </div>
  )
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

// Mobile-specific player card component
interface MobilePlayerCardProps {
  name: string
  rank: string
  isWinner: boolean
  rating?: number
  ratingChange?: number
  displayedChange?: number
  showChange?: boolean
  photoUrl?: string | null
  isYou: boolean
}

function MobilePlayerCard({ name, rank, isWinner, rating, ratingChange, displayedChange, showChange, photoUrl, isYou }: MobilePlayerCardProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Compact Avatar */}
      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 ${isWinner ? 'border-accent-correct/50' : 'border-white/10'} 
         flex items-center justify-center text-xl font-bold relative bg-bg-tertiary overflow-hidden shadow-lg shrink-0
       `}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isYou ? 'bg-accent-correct/10' : 'bg-accent-error/10'}`}>
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Winner Badge */}
        {isWinner && (
          <div className="absolute -bottom-0.5 bg-accent-correct text-black text-[7px] px-1.5 py-0.5 rounded-full font-black uppercase">
            Win
          </div>
        )}
      </div>

      {/* Name & Rank */}
      <div className="text-center">
        <h3 className="text-sm sm:text-base font-bold text-text-primary truncate max-w-[120px] sm:max-w-[150px]">
          {name}
        </h3>
        <span className="text-[10px] font-medium opacity-80" style={{ color: getRankColor(rank as any) }}>
          {rank}
        </span>
        <AnimatePresence>
          {showChange && ratingChange !== undefined && ratingChange !== 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.5, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`block text-[11px] font-mono font-bold px-1.5 py-0.5 rounded mt-1 ${ratingChange > 0
                ? 'text-accent-correct bg-accent-correct/10'
                : 'text-accent-error bg-accent-error/10'
                }`}
            >
              {ratingChange > 0 ? '+' : ''}{displayedChange ?? ratingChange}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Mobile stats grid - shows stats in a unified comparison format
interface MobileStatsGridProps {
  yourWpm: number
  yourAccuracy: number
  yourScore: number
  opponentWpm: number
  opponentAccuracy: number
  opponentScore: number
}

function MobileStatsGrid({ yourWpm, yourAccuracy, yourScore, opponentWpm, opponentAccuracy, opponentScore }: MobileStatsGridProps) {
  const stats = [
    { label: 'WPM', you: yourWpm, opp: opponentWpm, youRaw: yourWpm, oppRaw: opponentWpm },
    { label: 'ACC', you: `${yourAccuracy}%`, opp: `${opponentAccuracy}%`, youRaw: yourAccuracy, oppRaw: opponentAccuracy },
    { label: 'SCORE', you: yourScore, opp: opponentScore, youRaw: yourScore, oppRaw: opponentScore },
  ]

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {stats.map((stat) => {
        const isYouHigher = stat.youRaw >= stat.oppRaw

        return (
          <div key={stat.label} className="text-center bg-white/[0.02] rounded-lg p-2 sm:p-3 border border-white/5">
            <span className="text-[8px] sm:text-[9px] font-bold text-text-muted tracking-wide block mb-1">{stat.label}</span>

            <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono font-bold">
              <span className={isYouHigher ? 'text-accent-correct' : 'text-text-secondary opacity-80'}>
                {stat.you}
              </span>
              <span className="text-white/10">|</span>
              <span className={!isYouHigher ? 'text-accent-error' : 'text-text-muted opacity-50'}>
                {stat.opp}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
