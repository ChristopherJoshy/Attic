/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Dashboard Component - Main navigation hub.
 * Displays user stats, matchmaking controls, leaderboards, and live feed.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * Dashboard: Main component.
 * handlePlay: Initiates matchmaking flow.
 * handleCancelQueue: Cancels active queue.
 * formatQueueTime: Formats elapsed time for UI.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * containerVariants: Animation variants for layout.
 * itemVariants: Animation variants for children.
 * activeMatches: Live matches data.
 * selectedMode: Current game mode selection.
 * cooldown: Anti-spam cooldown timer.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: UI animations.
 * hooks: Auth, WebSocket.
 * stores: Game, Auth, Online.
 * components: Sub-components (UserStats, Leaderboard, etc).
 */

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, Variants, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useWebSocket } from '../hooks/useWebSocket'
import { useGameStore } from '../stores/gameStore'
import { useAuthStore } from '../stores/authStore'
import { GameMode, PROFILE_BACKGROUNDS } from '../types'
import UserStats from './UserStats'
import Leaderboard from './Leaderboard'
import ProfileModal from './ProfileModal'
import FriendsModal from './FriendsModal'
import LiveMatchFeed from './LiveMatchFeed'
import DailyRewardModal from './DailyRewardModal'
import UpdateModal from './UpdateModal'
import { getFriends, getDailyStatus } from '../config/api'
import { useOnlineStore } from '../stores/onlineStore'
import { useInventoryStore } from '../stores/inventoryStore'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 10 }
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, stats, signOut, refreshStats } = useAuth()
  const { joinQueue, joinTrainingQueue, joinFriendsQueue, leaveQueue, isConnected } = useWebSocket()
  const { status, queueElapsed, matchInfo, gameMode } = useGameStore()
  const { equippedBackground, fetchProfileInventory } = useInventoryStore()

  const [isConnecting, setIsConnecting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [selectedMode, setSelectedMode] = useState<GameMode>('ranked')
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false)

  useEffect(() => {
    if (user && useAuthStore.getState().idToken) {
      fetchProfileInventory(useAuthStore.getState().idToken!)
    }
  }, [user, fetchProfileInventory])

  const [showProfile, setShowProfile] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [friendsCount, setFriendsCount] = useState({ online: 0, offline: 0 })
  const [showClickEffect, setShowClickEffect] = useState(false)
  const [showReferralBonus, setShowReferralBonus] = useState(false)
  const [showDailyReward, setShowDailyReward] = useState(false)
  const [hasUnclaimedQuests, setHasUnclaimedQuests] = useState(false)
  const [hasPendingRequests, setHasPendingRequests] = useState(false)
  const [hasUnclaimedRankReward, setHasUnclaimedRankReward] = useState(false)
  const [isAfkMode, setIsAfkMode] = useState(false)
  const [afkCoinsEarned, setAfkCoinsEarned] = useState(0)
  const [lastAfkReward, setLastAfkReward] = useState<number | null>(null)
  const [invitedCount, setInvitedCount] = useState(0)
  const afkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { users: onlineUsers } = useOnlineStore()
  const { addAfkCoins } = useInventoryStore()

  // Notification Check Logic
  const checkNotifications = async () => {
    const { idToken } = useAuthStore.getState()
    if (!user || !idToken) return

    try {
      // 0. Fetch invited count for AFK mode
      const { getQuests, getFriendRequests, getUserProfile } = await import('../config/api')
      try {
        const profile = await getUserProfile(idToken)
        setInvitedCount(profile.invited_count || 0)
      } catch (e) {
        console.error('Failed to fetch profile for invite count:', e)
      }

      // 1. Check Quests
      const quests = await getQuests(idToken)
      const hasClaimable = [...quests.daily_quests, ...quests.weekly_quests].some(q => q.is_complete && !q.claimed)
      setHasUnclaimedQuests(hasClaimable)

      // 2. Check Friend Requests
      const requests = await getFriendRequests(idToken)
      setHasPendingRequests(requests.length > 0)

      // 3. Check Rank Rewards
      const currentRank = stats?.rank || 'Unranked'
      if (currentRank !== 'Unranked') {
        const bgId = `rank_${currentRank.toLowerCase()}`
        const inventory = useInventoryStore.getState()
        // Only check if they actually have items (avoid false positives on empty inventory load)
        if (inventory.unlockedBackgrounds && inventory.unlockedBackgrounds.length > 0) {
          setHasUnclaimedRankReward(!inventory.unlockedBackgrounds.includes(bgId))
        }
      }
    } catch (e) {
      // Suppress network errors for background notifications to keep console clean
      if (e instanceof TypeError && e.message === 'NetworkError when attempting to fetch resource.') {
        return
      }
      console.warn("Failed to check notifications (background check)", e)
    }
  }

  useEffect(() => {
    if (user) {
      checkNotifications()
      // Poll every 30s? Or just once on mount/user change is fine for now to avoid spam.
      const interval = setInterval(checkNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [user, stats]) // Re-check when stats (rank) changes

  useEffect(() => {
    if (status === 'idle') {
      setCooldown(5)
    }
  }, [status])

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  // Check for referral bonus popup (only shows once)
  useEffect(() => {
    const shouldShowBonus = localStorage.getItem('show_referral_bonus_popup')
    if (shouldShowBonus === 'true') {
      setShowReferralBonus(true)
      localStorage.removeItem('show_referral_bonus_popup')
    }
  }, [])

  // Check for daily reward availability
  useEffect(() => {
    const checkDailyReward = async () => {
      const token = useAuthStore.getState().idToken
      if (!token) return
      try {
        const status = await getDailyStatus(token)
        if (status.can_claim) {
          // Small delay before showing to avoid UI flash
          setTimeout(() => setShowDailyReward(true), 1500)
        }
      } catch (e) {
        console.error('Failed to check daily status', e)
      }
    }
    checkDailyReward()
  }, [])

  // Fetch friends and count online/offline
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const token = useAuthStore.getState().idToken
        if (!token) return
        const friends = await getFriends(token)
        const onlineUserIds = new Set(onlineUsers.map(u => u.userId))
        const online = friends.filter(f => onlineUserIds.has(f.uid)).length
        const offline = friends.length - online
        setFriendsCount({ online, offline })
      } catch (e) {
        console.error('Failed to fetch friends count', e)
      }
    }
    fetchFriends()
  }, [onlineUsers])

  // AFK Mode - Earn 1000 coins every 30 minutes (requires 2+ referrals)
  useEffect(() => {
    if (isAfkMode) {
      afkIntervalRef.current = setInterval(async () => {
        const reward = 500  // Reduced for challenging economy (was 1000)
        // Get token freshly
        const token = useAuthStore.getState().idToken
        if (token) {
          await addAfkCoins(reward, token)
          // Only update UI states after attempt (optimistic update handled in store)
          setAfkCoinsEarned(prev => prev + reward)
          setLastAfkReward(reward)
          // Clear the last reward display after 3 seconds
          setTimeout(() => setLastAfkReward(null), 3000)
        }
      }, 1800000) // Every 30 minutes
    } else {
      if (afkIntervalRef.current) {
        clearInterval(afkIntervalRef.current)
        afkIntervalRef.current = null
      }
    }
    return () => {
      if (afkIntervalRef.current) {
        clearInterval(afkIntervalRef.current)
      }
    }
  }, [isAfkMode, addAfkCoins])

  useEffect(() => {
    if (matchInfo) {
      if (status === 'finished') {
        // Immediate redirect for recovered games (race condition fix)
        navigate(`/game/${matchInfo.matchId}`)
      } else {
        setTimeout(() => {
          navigate(`/game/${matchInfo.matchId}`)
        }, 1500)
      }
    }
  }, [matchInfo, status, navigate])

  // Click outside handler for user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePlay = () => {
    if (cooldown > 0 || isConnecting || !isConnected) return

    if (status === 'queue' || status === 'waiting') {
      handleCancelQueue()
    } else if (status === 'idle') {
      // Trigger click effect
      setShowClickEffect(true)
      setTimeout(() => setShowClickEffect(false), 800)

      setIsConnecting(true)
      refreshStats() // Refresh stats before playing

      if (selectedMode === 'training') {
        joinTrainingQueue()
        useGameStore.getState().joinTrainingQueue()
      } else if (selectedMode === 'friends') {
        joinFriendsQueue()
        useGameStore.getState().joinFriendsQueue()
      } else {
        joinQueue()
        useGameStore.getState().joinQueue()
      }

      setTimeout(() => setIsConnecting(false), 500)
    }
  }

  // Optimistic Queue Timer: Increment locally to prevent "stuck at 0" feel
  // The backend sends sync updates which will correct any drift (processed in WebSocketContext)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (status === 'queue') {
      interval = setInterval(() => {
        const { queueElapsed, updateQueueElapsed } = useGameStore.getState();
        updateQueueElapsed(queueElapsed + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'Enter' && status === 'idle' && cooldown === 0) {
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+Enter: Force Training Mode
          setSelectedMode('training')
          // Need to call these directly since state update is async/batched
          joinTrainingQueue()
          useGameStore.getState().joinTrainingQueue()
        } else {
          // Enter: Play selected mode
          handlePlay()
        }
      }

      if (e.key === 'Escape' && (status === 'queue' || status === 'waiting')) {
        handleCancelQueue()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, cooldown, selectedMode, joinQueue, joinTrainingQueue, joinFriendsQueue])

  const handleCancelQueue = () => {
    leaveQueue()
    useGameStore.getState().leaveQueue()
  }

  const formatQueueTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full flex flex-col bg-transparent relative min-h-screen overflow-hidden"
    >
      {/* Ambient Background Gradient Orbs or Custom BG */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {equippedBackground && PROFILE_BACKGROUNDS[equippedBackground as keyof typeof PROFILE_BACKGROUNDS] ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
          >
            {/* Background Image */}
            <img
              src={PROFILE_BACKGROUNDS[equippedBackground as keyof typeof PROFILE_BACKGROUNDS].path}
              alt="Dashboard Background"
              className="w-full h-full object-cover blur-[3px] scale-105"
            />
            {/* Dark Overlay for readability */}
            <div className="absolute inset-0 bg-black/60" />

            {/* Subtle animated gradient overlay to keep it alive */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20"
              animate={{ opacity: [0.5, 0.7, 0.5] }}
              transition={{ duration: 5, repeat: Infinity }}
            />
          </motion.div>
        ) : (
          <>
            <motion.div
              className="absolute -top-40 -right-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.15, 0.1],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.08, 0.12, 0.08],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />
            <motion.div
              className="absolute -bottom-20 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.06, 0.1, 0.06],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
            />
          </>
        )}
      </div>

      {/* Header */}
      <motion.header
        variants={itemVariants}
        className="flex items-center justify-between px-6 sm:px-12 py-6 relative z-20"
      >
        {/* App Logo and Name */}
        <motion.div
          className="flex items-center gap-3"
          whileHover={{ scale: 1.02 }}
        >
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">typelo</h1>
        </motion.div>

        <div className="flex items-center gap-6">
          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/10 transition-colors cursor-pointer"
            >
              <div className="relative">
                {user?.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-6 h-6 rounded-full"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                  />
                )}
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-bg-primary" />
              </div>
              <span className="text-sm font-medium text-text-secondary hidden sm:inline hover:text-white transition-colors">{user?.displayName}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`text-white/30 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Dropdown Menu - Inline with z-50 */}
            {showUserMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden z-50"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 1)'
                }}
              >
                <div style={{ backgroundColor: '#1a1a1a' }}>
                  <button
                    onClick={() => {
                      setShowProfile(true)
                      setShowUserMenu(false)
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/20 transition-colors relative"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    </svg>
                    <span className="text-sm text-white">Profile</span>
                    {hasUnclaimedRankReward && (
                      <span className="absolute right-4 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowFriends(true)
                      setShowUserMenu(false)
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/20 transition-colors relative"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white">
                      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <path d="M20 8v6M23 11h-6" />
                    </svg>
                    <span className="text-sm text-white">Friends</span>
                    {hasPendingRequests && (
                      <span className="absolute right-4 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    )}
                  </button>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1a1a1a' }}>
                  <button
                    onClick={() => {
                      signOut()
                      setShowUserMenu(false)
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/20 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span className="text-sm text-red-400">Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row px-6 sm:px-12 pb-24 lg:pb-12 gap-12 relative">
        {/* Left Panel - User Stats */}
        <motion.aside variants={itemVariants} className="w-full lg:w-80 flex flex-col justify-center">
          <UserStats
            stats={stats}
            onOpenFriends={() => setShowFriends(true)}
            onlineFriendsCount={friendsCount.online}
            offlineFriendsCount={friendsCount.offline}
            hasUnclaimedQuests={hasUnclaimedQuests}
            hasPendingRequests={hasPendingRequests}
            hasUnclaimedRankReward={hasUnclaimedRankReward}
          />
        </motion.aside>

        {/* Center - Match Action */}
        <motion.main variants={itemVariants} className="flex-1 flex items-center justify-center min-h-[300px] lg:min-h-0">
          <div className="flex flex-col items-center gap-12">
            {status === 'idle' && (
              <div className="flex flex-col items-center gap-8 lg:gap-10 w-full relative pt-8 lg:pt-16">
                {/* Play Button Container */}
                <div className="relative group">
                  {/* Click Burst Effect - Expanding Rings */}
                  <AnimatePresence>
                    {showClickEffect && (
                      <>
                        {/* Ring 1 - Fast expand */}
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.8 }}
                          animate={{ scale: 2.5, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={`absolute inset-0 rounded-full border-2 pointer-events-none
                                      ${selectedMode === 'training' ? 'border-emerald-400' : selectedMode === 'friends' ? 'border-purple-400' : 'border-rose-400'}`}
                        />
                        {/* Ring 2 - Medium expand */}
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.6 }}
                          animate={{ scale: 2, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
                          className={`absolute inset-0 rounded-full border pointer-events-none
                                      ${selectedMode === 'training' ? 'border-emerald-500' : selectedMode === 'friends' ? 'border-purple-500' : 'border-rose-500'}`}
                        />
                        {/* Ring 3 - Slow expand with glow */}
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0.4 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                          className={`absolute inset-0 rounded-full pointer-events-none blur-sm
                                      ${selectedMode === 'training' ? 'bg-emerald-500/30' : selectedMode === 'friends' ? 'bg-purple-500/30' : 'bg-rose-500/30'}`}
                        />
                        {/* Center flash */}
                        <motion.div
                          initial={{ scale: 1, opacity: 0.8 }}
                          animate={{ scale: 1.3, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className={`absolute inset-0 rounded-full pointer-events-none
                                      ${selectedMode === 'training' ? 'bg-emerald-400/40' : selectedMode === 'friends' ? 'bg-purple-400/40' : 'bg-rose-400/40'}`}
                        />
                        {/* Particle bursts */}
                        {[...Array(8)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{
                              x: 0,
                              y: 0,
                              scale: 1,
                              opacity: 1
                            }}
                            animate={{
                              x: Math.cos((i * 45) * Math.PI / 180) * 120,
                              y: Math.sin((i * 45) * Math.PI / 180) * 120,
                              scale: 0,
                              opacity: 0
                            }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={`absolute left-1/2 top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full pointer-events-none
                                        ${selectedMode === 'training' ? 'bg-emerald-400' : selectedMode === 'friends' ? 'bg-purple-400' : 'bg-rose-400'}`}
                          />
                        ))}
                      </>
                    )}
                  </AnimatePresence>

                  {/* Pulsing Glow Effect */}
                  <motion.div
                    className={`absolute -inset-4 rounded-full opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500
                                ${selectedMode === 'training' ? 'bg-emerald-500/20' : selectedMode === 'friends' ? 'bg-purple-500/20' : 'bg-rose-500/20'}`}
                    animate={{
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />

                  {/* Animated Outer Ring */}
                  <motion.div
                    className={`absolute -inset-1 rounded-full border-2 opacity-30 group-hover:opacity-60 transition-opacity
                                ${selectedMode === 'training' ? 'border-emerald-500' : selectedMode === 'friends' ? 'border-purple-500' : 'border-rose-500'}`}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    style={{
                      background: `conic-gradient(from 0deg, transparent, ${selectedMode === 'training' ? 'rgba(16, 185, 129, 0.3)' : selectedMode === 'friends' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(244, 63, 94, 0.3)'}, transparent)`,
                    }}
                  />

                  <motion.button
                    onClick={handlePlay}
                    disabled={isConnecting || cooldown > 0 || !isConnected}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={`relative w-56 h-56 sm:w-64 sm:h-64 rounded-full border-2 
                               flex flex-col items-center justify-center gap-2 overflow-hidden
                               transition-all duration-300 backdrop-blur-sm
                               ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}
                               ${selectedMode === 'training'
                        ? 'bg-emerald-950/30 border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-[0_0_60px_rgba(16,185,129,0.3)]'
                        : selectedMode === 'friends'
                          ? 'bg-purple-950/30 border-purple-500/30 hover:border-purple-400/60 hover:shadow-[0_0_60px_rgba(168,85,247,0.3)]'
                          : 'bg-rose-950/30 border-rose-500/30 hover:border-rose-400/60 hover:shadow-[0_0_60px_rgba(244,63,94,0.3)]'}`}
                  >
                    {/* Inner rings with animation */}
                    <motion.div
                      className={`absolute inset-4 rounded-full border ${selectedMode === 'training' ? 'border-emerald-500/20' : selectedMode === 'friends' ? 'border-purple-500/20' : 'border-rose-500/20'}`}
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className={`absolute inset-8 rounded-full border ${selectedMode === 'training' ? 'border-emerald-500/10' : selectedMode === 'friends' ? 'border-purple-500/10' : 'border-rose-500/10'}`}
                      animate={{ scale: [1, 0.98, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    />

                    {/* Radial gradient overlay */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                                    ${selectedMode === 'training'
                        ? 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,transparent_70%)]'
                        : selectedMode === 'friends'
                          ? 'bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15)_0%,transparent_70%)]'
                          : 'bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.15)_0%,transparent_70%)]'}`}
                    />

                    {/* Content */}
                    <motion.span
                      className={`font-bold tracking-tight relative z-10
                                  ${!isConnected ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl'}
                                  ${selectedMode === 'training' ? 'text-emerald-400' : selectedMode === 'friends' ? 'text-purple-400' : 'text-rose-400'}`}
                      animate={{
                        textShadow: [
                          `0 0 20px ${selectedMode === 'training' ? 'rgba(16,185,129,0.5)' : selectedMode === 'friends' ? 'rgba(168,85,247,0.5)' : 'rgba(244,63,94,0.5)'}`,
                          `0 0 40px ${selectedMode === 'training' ? 'rgba(16,185,129,0.3)' : selectedMode === 'friends' ? 'rgba(168,85,247,0.3)' : 'rgba(244,63,94,0.3)'}`,
                          `0 0 20px ${selectedMode === 'training' ? 'rgba(16,185,129,0.5)' : selectedMode === 'friends' ? 'rgba(168,85,247,0.5)' : 'rgba(244,63,94,0.5)'}`,
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {!isConnected ? 'CONNECTING...' : 'PLAY'}
                    </motion.span>
                    <span className={`text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.4em] relative z-10 font-medium
                                    ${selectedMode === 'training' ? 'text-emerald-400/60' : selectedMode === 'friends' ? 'text-purple-400/60' : 'text-rose-400/60'}`}>
                      {!isConnected ? '...' : selectedMode}
                    </span>
                  </motion.button>
                </div>

                {/* Mode Selector - Sleek Pill Design */}
                <div className="relative z-30">
                  <motion.button
                    onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                    className="flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10 
                               hover:bg-white/10 hover:border-white/20 transition-all group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedMode === 'training' ? 'bg-emerald-500' : selectedMode === 'friends' ? 'bg-purple-500' : 'bg-rose-500'}`} />
                    <span className="text-xs font-bold tracking-widest uppercase text-text-secondary group-hover:text-white transition-colors">
                      {selectedMode === 'training' ? 'Training Mode' : selectedMode === 'friends' ? 'Friends Mode' : 'Ranked Mode'}
                    </span>
                    <motion.div
                      animate={{ rotate: isModeMenuOpen ? 180 : 0 }}
                      className="text-text-muted"
                    >
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  </motion.button>

                  <AnimatePresence>
                    {isModeMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 
                                   bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden shadow-2xl py-1"
                      >
                        <button
                          onClick={() => { setSelectedMode('ranked'); setIsModeMenuOpen(false) }}
                          className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-rose-500/10 transition-colors text-left
                                     ${selectedMode === 'ranked' ? 'bg-rose-500/5' : ''}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${selectedMode === 'ranked' ? 'bg-rose-500' : 'bg-rose-500/20'}`} />
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold tracking-wider uppercase ${selectedMode === 'ranked' ? 'text-rose-400' : 'text-text-muted'}`}>
                              Ranked
                            </span>
                            <span className="text-[9px] text-text-muted opacity-60"> Competitive ELO</span>
                          </div>
                        </button>

                        <div className="h-px w-full bg-white/5" />

                        <button
                          onClick={() => { setSelectedMode('training'); setIsModeMenuOpen(false) }}
                          className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-emerald-500/10 transition-colors text-left
                                     ${selectedMode === 'training' ? 'bg-emerald-500/5' : ''}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${selectedMode === 'training' ? 'bg-emerald-500' : 'bg-emerald-500/20'}`} />
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold tracking-wider uppercase ${selectedMode === 'training' ? 'text-emerald-400' : 'text-text-muted'}`}>
                              Training
                            </span>
                            <span className="text-[9px] text-text-muted opacity-60"> No ELO • Practice</span>
                          </div>
                        </button>

                        <div className="h-px w-full bg-white/5" />

                        <button
                          onClick={() => { setSelectedMode('friends'); setIsModeMenuOpen(false) }}
                          className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-purple-500/10 transition-colors text-left
                                     ${selectedMode === 'friends' ? 'bg-purple-500/5' : ''}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${selectedMode === 'friends' ? 'bg-purple-500' : 'bg-purple-500/20'}`} />
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold tracking-wider uppercase ${selectedMode === 'friends' ? 'text-purple-400' : 'text-text-muted'}`}>
                              Friends
                            </span>
                            <span className="text-[9px] text-text-muted opacity-60"> Casual • No ELO</span>
                          </div>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* AFK Mode Button */}
                <div className="relative group">
                  <motion.button
                    onClick={() => invitedCount >= 2 && setIsAfkMode(!isAfkMode)}
                    whileHover={{ scale: invitedCount >= 2 ? 1.02 : 1 }}
                    whileTap={{ scale: invitedCount >= 2 ? 0.98 : 1 }}
                    className={`relative px-6 py-3 rounded-full border transition-all overflow-hidden
                               ${invitedCount < 2
                        ? 'bg-white/5 border-white/10 text-text-secondary/50 cursor-not-allowed'
                        : isAfkMode
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:border-white/20'}`}
                    disabled={invitedCount < 2}
                  >
                    {/* Animated glow when active */}
                    {isAfkMode && invitedCount >= 2 && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                    <div className="relative flex items-center gap-3">
                      {/* Lock Icon if locked, Moon Icon if unlocked */}
                      {invitedCount < 2 ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isAfkMode ? 'text-amber-400' : ''}>
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      )}
                      <span className="text-xs font-bold tracking-widest uppercase">
                        {invitedCount < 2 ? 'AFK Locked' : isAfkMode ? 'AFK Mode ON' : 'AFK Mode'}
                      </span>
                      {isAfkMode && invitedCount >= 2 && (
                        <span className="text-[10px] bg-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                          +{afkCoinsEarned}
                        </span>
                      )}
                    </div>
                  </motion.button>
                  {/* Tooltip when locked */}
                  {invitedCount < 2 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 rounded-lg text-xs text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
                      Invite {2 - invitedCount} more friend{2 - invitedCount > 1 ? 's' : ''} to unlock
                    </div>
                  )}
                </div>

                {/* Last AFK Reward Popup */}
                <AnimatePresence>
                  {lastAfkReward !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.8 }}
                      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full shadow-2xl"
                    >
                      <span className="text-black font-bold text-lg">+{lastAfkReward} coins!</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Cooldown Timer - Centered below mode selector */}
                {cooldown > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="h-1 w-24 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: cooldown, ease: "linear" }}
                        className="h-full bg-accent-error"
                      />
                    </div>
                    <span className="text-xs text-text-muted font-mono">Cooldown {cooldown}s</span>
                  </motion.div>
                )}
              </div>
            )}

            {(status === 'queue' || (status === 'waiting' && !matchInfo)) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex flex-col items-center gap-8 sm:gap-12"
              >
                {/* Radar Container */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 flex items-center justify-center">
                  {/* Outer ring - static */}
                  <div className={`absolute inset-0 rounded-full border-2 ${gameMode === 'training' ? 'border-emerald-500/20' :
                    gameMode === 'friends' ? 'border-purple-500/20' : 'border-rose-500/20'
                    }`} />

                  {/* Middle ring */}
                  <div className={`absolute inset-[15%] rounded-full border ${gameMode === 'training' ? 'border-emerald-500/15' :
                    gameMode === 'friends' ? 'border-purple-500/15' : 'border-rose-500/15'
                    }`} />

                  {/* Inner ring */}
                  <div className={`absolute inset-[30%] rounded-full border ${gameMode === 'training' ? 'border-emerald-500/10' :
                    gameMode === 'friends' ? 'border-purple-500/10' : 'border-rose-500/10'
                    }`} />

                  {/* Core ring */}
                  <div className={`absolute inset-[45%] rounded-full border ${gameMode === 'training' ? 'border-emerald-500/5' :
                    gameMode === 'friends' ? 'border-purple-500/5' : 'border-rose-500/5'
                    }`} />

                  {/* Radar Sweep Line */}
                  <motion.div
                    className="absolute inset-0"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <div
                      className={`absolute top-1/2 left-1/2 w-1/2 h-0.5 origin-left ${gameMode === 'training' ? 'bg-gradient-to-r from-emerald-500 to-transparent' :
                        gameMode === 'friends' ? 'bg-gradient-to-r from-purple-500 to-transparent' :
                          'bg-gradient-to-r from-rose-500 to-transparent'
                        }`}
                      style={{ transform: 'translateY(-50%)' }}
                    />
                    {/* Sweep glow trail */}
                    <div
                      className={`absolute top-1/2 left-1/2 w-1/2 h-12 origin-left opacity-20 ${gameMode === 'training' ? 'bg-gradient-to-r from-emerald-500 to-transparent' :
                        gameMode === 'friends' ? 'bg-gradient-to-r from-purple-500 to-transparent' :
                          'bg-gradient-to-r from-rose-500 to-transparent'
                        }`}
                      style={{ transform: 'translateY(-50%) rotate(-15deg)', filter: 'blur(8px)' }}
                    />
                  </motion.div>

                  {/* Floating User Bubbles - Simulated queue users */}
                  {onlineUsers.slice(0, 6).map((onlineUser, i) => {
                    const angle = (i * 60 + queueElapsed * 5) % 360
                    const radius = 35 + (i % 3) * 12 // 35%, 47%, 59% from center
                    const funnyRobotUrl = `https://robohash.org/${onlineUser.displayName || 'bot' + i}?set=set4&size=100x100`
                    return (
                      <motion.div
                        key={onlineUser.userId || i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                          opacity: [0.4, 0.8, 0.4],
                          scale: [0.8, 1, 0.8],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          delay: i * 0.3,
                          ease: "easeInOut"
                        }}
                        className="absolute w-8 h-8 sm:w-10 sm:h-10"
                        style={{
                          left: `${50 + radius * Math.cos(angle * Math.PI / 180)}%`,
                          top: `${50 + radius * Math.sin(angle * Math.PI / 180)}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <img
                          src={onlineUser.photoUrl || funnyRobotUrl}
                          alt=""
                          className={`w-full h-full rounded-full border-2 object-cover bg-black ${gameMode === 'training' ? 'border-emerald-500/50' :
                            gameMode === 'friends' ? 'border-purple-500/50' : 'border-rose-500/50'
                            }`}
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.onerror = null
                            target.src = funnyRobotUrl
                          }}
                        />
                        {/* Pulse ring around bubble */}
                        <motion.div
                          className={`absolute -inset-1 rounded-full border ${gameMode === 'training' ? 'border-emerald-400' :
                            gameMode === 'friends' ? 'border-purple-400' : 'border-rose-400'
                            }`}
                          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        />
                      </motion.div>
                    )
                  })}

                  {/* Center Timer Display */}
                  <div className={`relative z-10 flex flex-col items-center p-4 sm:p-6 rounded-2xl backdrop-blur-sm ${gameMode === 'training' ? 'bg-emerald-950/50 border border-emerald-500/30' :
                    gameMode === 'friends' ? 'bg-purple-950/50 border border-purple-500/30' :
                      'bg-rose-950/50 border border-rose-500/30'
                    }`}>
                    <span className={`text-3xl sm:text-4xl lg:text-5xl font-mono font-bold tabular-nums ${gameMode === 'training' ? 'text-emerald-400' :
                      gameMode === 'friends' ? 'text-purple-400' : 'text-rose-400'
                      }`}>
                      {formatQueueTime(queueElapsed)}
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <motion.span
                        className={`w-2 h-2 rounded-full ${gameMode === 'training' ? 'bg-emerald-500' :
                          gameMode === 'friends' ? 'bg-purple-500' : 'bg-rose-500'
                          }`}
                        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <span className="text-[10px] sm:text-xs uppercase tracking-widest text-text-muted font-medium">
                        {gameMode === 'training' ? 'Training' : gameMode === 'friends' ? 'Finding Friends' : 'Scanning'}
                      </span>
                    </div>
                  </div>

                  {/* Radar ping effect */}
                  <motion.div
                    className={`absolute inset-0 rounded-full border-2 ${gameMode === 'training' ? 'border-emerald-500' :
                      gameMode === 'friends' ? 'border-purple-500' : 'border-rose-500'
                      }`}
                    animate={{ scale: [0.5, 1.2], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  />
                </div>

                {/* Cancel Button */}
                <motion.button
                  onClick={handleCancelQueue}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`px-8 py-3 rounded-full border bg-black/50 backdrop-blur-sm
                             text-xs sm:text-sm uppercase tracking-widest 
                             transition-all duration-300 ${gameMode === 'training'
                      ? 'border-emerald-500/30 text-emerald-400/70 hover:border-emerald-400 hover:text-emerald-400'
                      : gameMode === 'friends'
                        ? 'border-purple-500/30 text-purple-400/70 hover:border-purple-400 hover:text-purple-400'
                        : 'border-rose-500/30 text-rose-400/70 hover:border-rose-400 hover:text-rose-400'
                    }`}
                >
                  Cancel Search
                </motion.button>
              </motion.div>
            )}

            {matchInfo && (
              <>
                {/* Full-screen color spread effect */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 4, opacity: 0.08 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="fixed inset-0 pointer-events-none z-40"
                  style={{
                    background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)',
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center gap-6 relative z-50"
                >
                  <div className="relative w-64 h-64 flex items-center justify-center">
                    {/* Clean circular container */}
                    <motion.div
                      className="absolute inset-0 border-2 border-accent-correct/30 rounded-full"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                    <div className="w-48 h-48 rounded-full border-2 border-accent-correct bg-bg-secondary flex items-center justify-center relative overflow-hidden">
                      <div className="flex flex-col items-center z-10">
                        <motion.span
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="text-5xl font-bold text-accent-correct tracking-tighter"
                        >
                          MATCH
                        </motion.span>
                        <motion.span
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="text-xs uppercase tracking-[0.5em] text-white/70"
                        >
                          FOUND
                        </motion.span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Match Notification - Desktop Only - Compact Stylish Box */}
                {/* CASE 1: Match Found (Pre-Game) */}
                {matchInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 120, damping: 15 }}
                    className="hidden lg:block fixed bottom-8 left-1/2 -translate-x-1/2 z-[60]"
                  >
                    <div className="relative px-6 py-4 bg-[#0A0A0A]/60 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl">
                      {/* Content */}
                      <div className="flex items-center gap-6">
                        {/* Player */}
                        <div className="flex items-center gap-3">
                          <img
                            src={user?.photoURL || ''}
                            alt=""
                            className="w-10 h-10 rounded-full border border-white/10"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white">{user?.displayName}</span>
                            <span className="text-[10px] uppercase tracking-wider text-white/50">You</span>
                          </div>
                        </div>

                        {/* VS Badge with Mode */}
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-black tracking-widest text-white/30">VS</span>
                          <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full
                                          ${gameMode === 'training' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {gameMode}
                          </span>
                        </div>

                        {/* Opponent */}
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-semibold text-white">{matchInfo.opponentDisplayName}</span>
                            <span className="text-[10px] uppercase tracking-wider text-white/50">
                              {matchInfo.opponentIsBot ? 'Bot' : 'Opponent'}
                            </span>
                          </div>
                          <img
                            src={matchInfo.opponentPhotoURL || ''}
                            alt=""
                            className="w-10 h-10 rounded-full border border-white/10"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* CASE 2: Match Result (Post-Game) */}
                {/* Only show if we have a result AND we are back in idle state (dashboard) */}
                {!matchInfo && useGameStore.getState().result && (
                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="hidden lg:block fixed bottom-8 left-1/2 -translate-x-1/2 z-[60]"
                  >
                    <div className="relative px-8 py-5 bg-[#0A0A0A]/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Winner</span>
                          <span className={`text-xl font-bold tracking-tight ${useGameStore.getState().result?.result === 'win' ? 'text-accent-correct' :
                            useGameStore.getState().result?.result === 'loss' ? 'text-accent-error' : 'text-white'
                            }`}>
                            {useGameStore.getState().result?.result === 'win' ? user?.displayName :
                              useGameStore.getState().result?.result === 'loss' ? useGameStore.getState().result?.opponentDisplayName : 'Tie'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </motion.main>

        {/* Right Panel - Leaderboard */}
        <motion.aside variants={itemVariants} className="w-full lg:w-80 flex flex-col justify-center">
          <Leaderboard />
        </motion.aside>
      </div>

      {/* Profile Modal */}
      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />

      {/* Friends Modal */}
      <FriendsModal isOpen={showFriends} onClose={() => setShowFriends(false)} />

      {/* Live Match Feed - Shows active matches and results */}
      <LiveMatchFeed />

      {/* Referral Bonus Popup */}
      <AnimatePresence>
        {showReferralBonus && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
              onClick={() => setShowReferralBonus(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none"
            >
              <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] rounded-3xl border border-white/10 p-8 max-w-sm mx-4 text-center shadow-2xl pointer-events-auto relative overflow-hidden">
                {/* Celebration particles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{
                        x: '50%',
                        y: '50%',
                        scale: 0,
                        opacity: 1
                      }}
                      animate={{
                        x: `${Math.random() * 100}%`,
                        y: `${Math.random() * 100}%`,
                        scale: Math.random() * 0.5 + 0.5,
                        opacity: 0
                      }}
                      transition={{
                        duration: 1.5 + Math.random(),
                        delay: Math.random() * 0.5,
                        ease: 'easeOut'
                      }}
                      className={`absolute w-2 h-2 rounded-full ${['bg-yellow-400', 'bg-amber-500', 'bg-orange-400', 'bg-rose-400', 'bg-emerald-400'][i % 5]
                        }`}
                    />
                  ))}
                </div>

                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-radial from-yellow-500/20 via-transparent to-transparent pointer-events-none" />

                {/* Content */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', delay: 0.2, damping: 10 }}
                  className="relative mb-6"
                >
                  {/* Coin icon with glow */}
                  <div className="relative inline-block">
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 20px rgba(251, 191, 36, 0.4)',
                          '0 0 40px rgba(251, 191, 36, 0.6)',
                          '0 0 20px rgba(251, 191, 36, 0.4)'
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 flex items-center justify-center"
                    >
                      <span className="text-4xl font-bold text-white drop-shadow-lg">5</span>
                    </motion.div>
                    {/* Sparkle */}
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full"
                      style={{ filter: 'blur(1px)' }}
                    />
                  </div>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold text-white mb-2"
                >
                  Congratulations!
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-white/60 mb-6"
                >
                  You earned <span className="text-yellow-400 font-bold">5 bonus coins</span> for joining via invite link!
                </motion.p>

                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowReferralBonus(false)}
                  className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-full hover:from-yellow-400 hover:to-amber-400 transition-all shadow-lg"
                >
                  Awesome!
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Daily Reward Modal */}
      <DailyRewardModal
        isOpen={showDailyReward}
        onClose={() => setShowDailyReward(false)}
      />

      {/* Update Modal - Auto shows once per version */}
      <UpdateModal />
    </motion.div >
  )
}
