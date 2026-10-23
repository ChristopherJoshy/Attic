/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Leaderboard Component - Displays the global leaderboard and user rankings.
 * Can act as a full page or a widget. Handles fetching leaderboard data, user rank, and real-time updates.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * Leaderboard: Main component.
 * fetchLeaderboard: Retrieves the top players and current user's rank.
 * handleRefresh: Manually refreshes the data.
 * LeaderboardRow: Sub-component for rendering a single row.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * entries: List of top players.
 * userRank: Current user's specific rank data.
 * loading: Loading state.
 * refreshing: Refreshing state.
 * isExpanded: State for mobile collapsible view.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 * stores: Auth, Online stores.
 * config/api: Leaderboard API functions.
 * types: Shared types.
 */

import { useEffect, useState, useCallback, forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LeaderboardEntry, Rank } from '../types'
import { getLeaderboard, getUserRank } from '../config/api'
import { useAuthStore } from '../stores/authStore'
import { useOnlineStore } from '../stores/onlineStore'
import UserProfileModal from './UserProfileModal'
import { getProfileBorderInfo, getProfileEffectInfo, getProfileBackgroundInfo } from '../types'
import AvatarDecoration, { EFFECT_TO_DECORATION, BORDER_TO_DECORATION } from './AvatarDecoration'

interface UserRankInfo {
  position: number
  peak_elo: number
  rank: string
  percentile: number
  is_on_leaderboard: boolean
  potential_position: number | null
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 }
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userRank, setUserRank] = useState<UserRankInfo | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isExpanded, setIsExpanded] = useState(false) // Mobile collapse state
  const [selectedPlayer, setSelectedPlayer] = useState<{
    userId: string
    userName: string
    userPhoto: string | null
    userElo: number
    userRank: string
  } | null>(null)
  const { user, idToken } = useAuthStore()
  const { users: onlineUsers } = useOnlineStore()

  const fetchLeaderboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      const data = await getLeaderboard(10)

      const transformedEntries: LeaderboardEntry[] = data.entries.map((entry) => ({
        position: entry.position,
        user: {
          uid: entry.user.uid,
          displayName: entry.user.display_name,
          photoURL: entry.user.photo_url,
          currentElo: entry.user.current_elo,
          peakElo: entry.user.peak_elo,
          rank: entry.user.rank as Rank,
          bestWpm: entry.user.best_wpm,
          equippedBorder: entry.user.equipped_border || null,
          equippedProfileEffect: entry.user.equipped_profile_effect || null,
          equippedBackground: entry.user.equipped_background || null,
        },
      }))

      setEntries(transformedEntries)
      setLastUpdated(new Date())

      const isUserInTop = user && transformedEntries.some(e => e.user.uid === user.uid)

      if (user && !isUserInTop && idToken) {
        try {
          const rankData = await getUserRank(user.uid, idToken)
          setUserRank(rankData)
        } catch (err) {
          console.error('Failed to fetch user rank:', err)
        }
      } else {
        setUserRank(null)
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err)
      setError('Failed to load leaderboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, idToken])

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(() => fetchLeaderboard(true), 60000)
    return () => clearInterval(interval)
  }, [fetchLeaderboard])

  const handleRefresh = () => {
    if (!refreshing) {
      fetchLeaderboard(true)
    }
  }

  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white/[0.02] rounded-2xl border border-white/5 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
    )
  }

  if (error && entries.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white/[0.02] rounded-2xl border border-white/5 p-6 items-center justify-center gap-4">
        <p className="text-sm text-text-muted">{error}</p>
        <button
          onClick={handleRefresh}
          className="text-xs text-accent-focus hover:text-white transition-colors underline underline-offset-4"
        >
          Retry Connection
        </button>
      </div>
    )
  }

  // Get current user's position (either from entries or userRank)
  const currentUserPosition = entries.find(e => e.user.uid === user?.uid)?.position || userRank?.position || null

  return (
    <>
      {/* Mobile Collapsed View - Shows user position, tap to expand */}
      <div className="lg:hidden">
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 rounded-lg border border-white/20 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-all"
        >
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-focus">
              <path d="M6 9l6 6 6-6" transform="rotate(180 12 12)" />
              <path d="M12 3v18" transform="scale(0.8)" />
            </svg>
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">
              Leaderboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            {currentUserPosition && (
              <span className="text-sm font-mono text-accent-focus">#{currentUserPosition}</span>
            )}
            <motion.svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-text-muted"
              animate={{ rotate: isExpanded ? 180 : 0 }}
            >
              <path d="M6 9l6 6 6-6" />
            </motion.svg>
          </div>
        </motion.button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-2"
            >
              <div className="flex flex-col rounded-2xl border border-white/20 overflow-hidden">
                {/* Mobile Leaderboard Content */}
                <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                  <motion.div
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col"
                  >
                    {entries.map((entry, index) => (
                      <LeaderboardRow
                        key={entry.user.uid}
                        entry={entry}
                        index={index}
                        isCurrentUser={user?.uid === entry.user.uid}
                        isOnline={onlineUsers.some(u => u.userId === entry.user.uid)}
                        onClick={() => setSelectedPlayer({
                          userId: entry.user.uid,
                          userName: entry.user.displayName,
                          userPhoto: entry.user.photoURL,
                          userElo: entry.user.currentElo,
                          userRank: entry.user.rank
                        })}
                      />
                    ))}
                  </motion.div>

                  {/* User Rank - Mobile */}
                  {userRank && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <div className="bg-white/[0.03] rounded-lg p-3 border border-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center font-mono font-bold text-xs text-white">
                              #{userRank.position}
                            </div>
                            <div>
                              <p className="text-xs text-white font-bold">Your Position</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-text-muted">{userRank.rank}</span>
                                <span className="text-[10px] text-text-muted">•</span>
                                <span className="text-[10px] text-text-muted">{userRank.peak_elo} Peak</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-accent-focus">Top {userRank.percentile.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop Full Leaderboard */}
      <div className="hidden lg:flex flex-col h-full rounded-2xl overflow-hidden relative">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-focus">
              <path d="M6 9l6 6 6-6" transform="rotate(180 12 12)" />
              <path d="M12 3v18" transform="scale(0.8)" />
            </svg>
            <span className="text-xs uppercase tracking-widest font-bold text-text-secondary">Global Top 10</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 group disabled:opacity-50"
          >
            <span className="text-[10px] text-text-muted group-hover:text-text-secondary transition-colors hidden sm:inline">
              {lastUpdated && 'Updated just now'}
            </span>
            <motion.div
              animate={refreshing ? { rotate: 360 } : {}}
              transition={refreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
              className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:text-white transition-colors">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </motion.div>
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-text-secondary mb-1">No legends yet</p>
            <p className="text-xs text-text-muted">Be the first to claim the throne</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col p-2"
            >
              <AnimatePresence mode="popLayout">
                {entries.map((entry, index) => (
                  <LeaderboardRow
                    key={entry.user.uid}
                    entry={entry}
                    index={index}
                    isCurrentUser={user?.uid === entry.user.uid}
                    isOnline={onlineUsers.some(u => u.userId === entry.user.uid)}
                    onClick={() => setSelectedPlayer({
                      userId: entry.user.uid,
                      userName: entry.user.displayName,
                      userPhoto: entry.user.photoURL,
                      userElo: entry.user.currentElo,
                      userRank: entry.user.rank
                    })}
                  />
                ))}
              </AnimatePresence>

              {/* User Rank appended directly after list */}
              {userRank && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center font-mono font-bold text-xs text-white">
                          #{userRank.position}
                        </div>
                        <div>
                          <p className="text-xs text-white font-bold">Your Position</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-text-muted">{userRank.rank}</span>
                            <span className="text-[10px] text-text-muted">•</span>
                            <span className="text-[10px] text-text-muted">{userRank.peak_elo} Peak</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-accent-focus">Top {userRank.percentile.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>

      {/* Player Profile Modal */}
      {selectedPlayer && (
        <UserProfileModal
          isOpen={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          userId={selectedPlayer.userId}
          userName={selectedPlayer.userName}
          userPhoto={selectedPlayer.userPhoto}
          userElo={selectedPlayer.userElo}
          userRank={selectedPlayer.userRank}
        />
      )}
    </>
  )
}

const LeaderboardRow = forwardRef<HTMLDivElement, { entry: LeaderboardEntry; index: number; isCurrentUser?: boolean; isOnline?: boolean; onClick?: () => void }>(
  function LeaderboardRow({ entry, index, isCurrentUser, isOnline, onClick }, ref) {
    const { position, user } = entry
    const effectInfo = user.equippedProfileEffect ? getProfileEffectInfo(user.equippedProfileEffect) : null
    const bgInfo = user.equippedBackground ? getProfileBackgroundInfo(user.equippedBackground) : null

    return (
      <motion.div
        ref={ref}
        variants={itemVariants}
        layout
        onClick={onClick}
        className="relative mb-1"
      >
        {/* Inner effect color overlay */}
        <div
          className={`group relative flex items-center gap-4 p-3 rounded-lg transition-colors cursor-pointer overflow-hidden ${isCurrentUser ? 'bg-accent-focus/10 border border-accent-focus/20' : 'hover:bg-white/[0.04]'}`}
          style={{
            border: effectInfo ? `1px solid ${effectInfo.color}40` : undefined,
            boxShadow: effectInfo ? `0 0 8px ${effectInfo.color}30` : undefined,
          }}
        >
          {/* Background Image with Blur */}
          {bgInfo && (
            <div
              className="absolute inset-0 bg-cover bg-center pointer-events-none transition-opacity duration-300"
              style={{
                backgroundImage: `url(${bgInfo.path})`,
                filter: 'blur(4px)',
                transform: 'scale(1.1)', // Prevent blur edges
                opacity: 0.7
              }}
            />

          )}

          {/* Readability Overlay - Only when background is present */}
          {bgInfo && (
            <div className="absolute inset-0 bg-black/60 pointer-events-none rounded-lg ring-1 ring-white/10" />
          )}

          {/* Inner effect gradient */}
          {(effectInfo) && (
            <>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${effectInfo.color}35 0%, ${effectInfo.color}10 30%, transparent 50%, ${effectInfo.color}10 70%, ${effectInfo.color}35 100%)`,
                  animation: effectInfo?.animation === 'pulse'
                    ? 'profile-inner-pulse 3s ease-in-out infinite'
                    : effectInfo.animation === 'glow'
                      ? 'profile-inner-glow 3s ease-in-out infinite'
                      : undefined
                }}
              />
              {/* Full Frame Effect */}
              {user.equippedProfileEffect && (
                <AvatarDecoration
                  decorationType={EFFECT_TO_DECORATION[user.equippedProfileEffect] || 'default'}
                  size="100%"
                  animate={true}
                  className="z-0"
                />
              )}
            </>
          )}

          {/* Selection Indicator */}
          {isCurrentUser && (
            <motion.div
              layoutId="active-indicator"
              className="absolute left-0 top-3 bottom-3 w-0.5 bg-accent-focus rounded-r"
            />
          )}

          {/* Position */}
          <div className={`w-6 text-center font-mono text-sm ${index < 3 ? 'text-white font-bold' : (bgInfo ? 'text-white/80 drop-shadow-sm font-semibold' : 'text-text-muted')}`}>
            {index < 3 ? (
              <span className={`inline-block w-4 h-4 rounded-full border ${index === 0 ? 'border-yellow-400 text-yellow-400 bg-yellow-400/10' :
                index === 1 ? 'border-gray-400 text-gray-400 bg-gray-400/10' :
                  'border-amber-600 text-amber-600 bg-amber-600/10'
                } flex items-center justify-center text-[10px]`}>
                {index + 1}
              </span>
            ) : position}
          </div>

          {/* Avatar with Discord-style decorations */}
          <div className="relative">
            {(() => {
              const borderInfo = user.equippedBorder ? getProfileBorderInfo(user.equippedBorder) : null
              const borderDecoType = user.equippedBorder ? BORDER_TO_DECORATION[user.equippedBorder] : null
              return (
                <div className="relative p-1">
                  {/* Border decoration - wraps around avatar */}
                  {borderDecoType && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <AvatarDecoration
                        decorationType={borderDecoType}
                        size={60}
                        animate={true}
                      />
                    </div>
                  )}
                  {/* Actual avatar - innermost */}
                  <div
                    className="w-8 h-8 rounded-full overflow-hidden bg-white/10 transition-all relative"
                    style={{
                      boxShadow: effectInfo?.color
                        ? `0 0 12px ${effectInfo.color}60`
                        : borderInfo?.color
                          ? `0 2px 10px ${borderInfo.color}40`
                          : undefined
                    }}
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent">
                        <span className="text-xs font-bold text-white/50">
                          {user.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            {/* Status Dot - only shown when user is online */}
            {isOnline && (
              <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-bg-primary rounded-full flex items-center justify-center z-10">
                <div className="w-1.5 h-1.5 bg-accent-correct rounded-full animate-pulse" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center justify-between">
              <span className={`text-sm truncate font-medium drop-shadow-md ${isCurrentUser || bgInfo ? 'text-white' : 'text-text-secondary group-hover:text-primary transition-colors'}`}>
                {user.displayName}
              </span>
              <span className="text-xs font-mono font-bold text-white/80 drop-shadow-md">
                {user.currentElo}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className={`text-[10px] uppercase tracking-wider font-semibold ${bgInfo ? 'text-white/90 drop-shadow-sm' : 'text-text-muted'}`}>{user.rank}</span>
              <span className={`text-[10px] font-mono font-medium ${bgInfo ? 'text-white/90 drop-shadow-sm' : 'text-text-muted'}`}>{user.bestWpm} WPM</span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }
)
