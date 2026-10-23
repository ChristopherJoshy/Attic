/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * UserStats Component - Displays the user's main statistics on the Dashboard.
 * Includes rank card, history charts, and quick stats grid.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * UserStats: Main component.
 * StatBox: Sub-component for individual stat cards with optional charts.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * stats: Computed user statistics.
 * rank: Current rank derived from ELO.
 * winRate: Calculated win/loss percentage.
 * wpmHistory: Historical WPM data for charts.
 * eloHistory: Historical ELO data for charts.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 * types: Rank types.
 * config: API functions.
 * stores: Auth store.
 * components: Sub-components like MatchHistoryModal, SparklineChart.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { UserStats as UserStatsType } from '../types'
import { getRankFromElo } from '../types'
import { getUserMatches } from '../config/api'
import { useAuthStore } from '../stores/authStore'
import RankBadge from './icons/RankBadge'
import RanksModal from './RanksModal'
import MatchHistoryModal from './MatchHistoryModal'
import EnhancedProfileModal from './EnhancedProfileModal'
import SparklineChart from './SparklineChart'
import InventoryModal from './InventoryModal'
import ShopModal from './ShopModal'
import EarnCoinsModal from './EarnCoinsModal'
import DailyRewardModal from './DailyRewardModal'
import { useInventoryStore } from '../stores/inventoryStore'

interface UserStatsProps {
  stats: UserStatsType | null
  onOpenFriends?: () => void
  onlineFriendsCount?: number
  offlineFriendsCount?: number
  hasUnclaimedQuests?: boolean
  hasPendingRequests?: boolean
  hasUnclaimedRankReward?: boolean
}

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 100 }
  }
}

export default function UserStats({
  stats,
  onOpenFriends,
  onlineFriendsCount = 0,
  offlineFriendsCount = 0,
  hasUnclaimedQuests = false,
  hasPendingRequests = false,
  hasUnclaimedRankReward = false
}: UserStatsProps) {
  const [showRanksModal, setShowRanksModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  const [showShop, setShowShop] = useState(false)
  const [showEarnCoins, setShowEarnCoins] = useState(false)
  const [showDailyReward, setShowDailyReward] = useState(false)
  const [wpmHistory, setWpmHistory] = useState<number[]>([])
  const [eloHistory, setEloHistory] = useState<number[]>([])
  const { idToken } = useAuthStore()
  const { coins, fetchInventory } = useInventoryStore()

  useEffect(() => {
    if (stats && idToken) {
      getUserMatches(idToken, 20).then(matches => {
        // Sort chronological
        const sorted = [...matches].reverse()
        setWpmHistory(sorted.map(m => m.wpm))
        setEloHistory(sorted.map(m => m.elo_after))
      }).catch(err => console.error('Failed to load history stats', err))

      // Fetch inventory for coins display
      fetchInventory(idToken)
    }
  }, [stats, idToken, fetchInventory])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-white/20 border-t-accent-focus rounded-full animate-spin" />
      </div>
    )
  }

  const rank = getRankFromElo(stats.currentElo)
  const winRate = stats.totalMatches > 0
    ? Math.round((stats.wins / stats.totalMatches) * 100)
    : 0

  return (
    <>
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-3 sm:gap-4 lg:gap-5"
      >
        {/* Rank Badge - Clickable */}
        <motion.div
          variants={item}
          whileHover={{ y: -2, scale: 1.01 }}
          className="flex items-center gap-6 p-5 rounded-2xl bg-white/[0.02] backdrop-blur-sm 
                     border border-white/10 hover:border-white/20 hover:bg-white/[0.05]
                     hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                     transition-all duration-300 cursor-pointer group relative overflow-hidden"
          onClick={() => setShowRanksModal(true)}
        >
          {/* Gradient accent */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-rose-500/5 via-transparent to-purple-500/5" />
          <RankBadge
            rank={rank}
            size={96}
            animate
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight group-hover:text-white transition-colors">
                  {rank}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-text-secondary uppercase tracking-wider">
                  Rank
                </span>
              </div>
            </div>
            <p className="text-sm font-mono text-accent-focus mt-1">{stats.currentElo} ELO</p>
            {/* Rank Progress Bar */}
            {(() => {
              const rankThresholds = [
                { rank: 'Unranked', min: 0, max: 1000 },
                { rank: 'Bronze', min: 1000, max: 2000 },
                { rank: 'Gold', min: 2000, max: 3000 },
                { rank: 'Platinum', min: 3000, max: 10000 },
                { rank: 'Ranker', min: 10000, max: 10000 },
              ]
              const currentThreshold = rankThresholds.find(t => t.rank === rank) || rankThresholds[0]
              const isMaxRank = currentThreshold.rank === 'Ranker'
              const progressMin = currentThreshold.min
              const progressMax = currentThreshold.max
              const progressPercent = isMaxRank ? 100 : Math.min(100, Math.max(0, ((stats.currentElo - progressMin) / (progressMax - progressMin)) * 100))

              return (
                <div className="mt-3">
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${progressPercent}%`,
                        background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308)',
                      }}
                    />
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <span className="text-xs font-mono text-white/40">
                      {isMaxRank ? (
                        <span className="text-yellow-400">MAX RANK</span>
                      ) : (
                        <>
                          <span className="text-white/60">{stats.currentElo}</span>
                          <span className="text-white/30">/</span>
                          <span className="text-white/40">{progressMax}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            variants={item}
            label="Avg WPM"
            value={Math.round(stats.avgWpm)}
            chartData={wpmHistory}
            color="#ec4899"
          />
          <StatBox variants={item} label="Best WPM" value={stats.bestWpm} color="#a855f7" />
          <StatBox variants={item} label="Accuracy" value={`${Math.round(stats.avgAccuracy)}%`} color="#22c55e" />
          <StatBox variants={item} label="Win Rate" value={`${winRate}%`} color="#3b82f6" />
        </div>

        {/* Profile Button */}
        <motion.button
          variants={item}
          onClick={() => setShowProfileModal(true)}
          whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
          whileTap={{ scale: 0.98 }}
          className="relative flex items-center justify-between p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/20 group transition-all hover:border-orange-500/40"
        >
          {hasUnclaimedRankReward && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse z-10 box-content border-2 border-[#1a1a1a]" />
          )}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center group-hover:from-orange-500/30 group-hover:to-red-500/30 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400 group-hover:text-orange-300 transition-colors">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-text-primary">
                My Profile
              </p>
              <p className="text-xs text-orange-400/70 mt-0.5">
                View stats, history & more
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-mono text-accent-correct">{stats.wins}W</span>
              <span className="text-xs font-mono text-text-muted mx-1">/</span>
              <span className="text-xs font-mono text-accent-error">{stats.losses}L</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400/50 group-hover:translate-x-1 transition-transform">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </motion.button>

        {/* Peak Elo */}
        {stats.peakElo > stats.currentElo && (
          <motion.div variants={item} className="px-4 py-3 rounded-lg border border-white/20 flex items-center justify-between bg-white/[0.02]">
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">
              Peak Performance
            </span>
            <span className="text-sm font-mono text-text-secondary">{stats.peakElo} ELO</span>
          </motion.div>
        )}

        {/* Friends Tab */}
        {onOpenFriends && (
          <motion.button
            variants={item}
            onClick={onOpenFriends}
            whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
            whileTap={{ scale: 0.99 }}
            className="relative px-4 py-3 rounded-lg border border-white/20 flex items-center justify-between hover:border-white/30 transition-all cursor-pointer group bg-white/[0.02]"
          >
            {hasPendingRequests && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse z-10 box-content border-2 border-[#1a1a1a]" />
            )}
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium group-hover:text-text-secondary transition-colors">
              Friends
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-mono text-emerald-400">{onlineFriendsCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
                <span className="text-sm font-mono text-text-secondary">{offlineFriendsCount}</span>
              </div>
            </div>
          </motion.button>
        )}

        {/* Inventory Button */}
        <motion.button
          variants={item}
          onClick={() => setShowInventory(true)}
          whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
          whileTap={{ scale: 0.99 }}
          className="px-4 py-3 rounded-lg border border-white/20 flex items-center justify-between hover:border-purple-500/30 transition-all cursor-pointer group bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium group-hover:text-purple-400 transition-colors">
              Inventory
            </span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:translate-x-1 transition-transform">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </motion.button>

        {/* Shop Button */}
        <motion.button
          variants={item}
          onClick={() => setShowShop(true)}
          whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
          whileTap={{ scale: 0.99 }}
          className="px-4 py-3 rounded-lg border border-white/20 flex items-center justify-between hover:border-yellow-500/30 transition-all cursor-pointer group bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium group-hover:text-yellow-400 transition-colors">
              Shop
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-yellow-400">{coins}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:translate-x-1 transition-transform">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </motion.button>

        {/* Earn Coins Button */}
        <motion.button
          variants={item}
          onClick={() => setShowEarnCoins(true)}
          whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
          whileTap={{ scale: 0.99 }}
          className="relative px-4 py-3 rounded-lg border border-white/20 flex items-center justify-between hover:border-emerald-500/30 transition-all cursor-pointer group bg-white/[0.02]"
        >
          {hasUnclaimedQuests && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse z-10 box-content border-2 border-[#1a1a1a]" />
          )}
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium group-hover:text-emerald-400 transition-colors">
              Earn Coins
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-emerald-400 uppercase">Free</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:translate-x-1 transition-transform">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </motion.button>

        {/* Daily Rewards Button */}
        <motion.button
          variants={item}
          onClick={() => setShowDailyReward(true)}
          whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
          whileTap={{ scale: 0.99 }}
          className="px-4 py-3 rounded-lg border border-white/20 flex items-center justify-between hover:border-amber-500/30 transition-all cursor-pointer group bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium group-hover:text-amber-400 transition-colors">
              Daily Rewards
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:translate-x-1 transition-transform">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </motion.button>
      </motion.div>

      {/* Modals */}
      <RanksModal
        isOpen={showRanksModal}
        onClose={() => setShowRanksModal(false)}
        currentRank={rank}
      />
      <MatchHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
      <EnhancedProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
      <InventoryModal
        isOpen={showInventory}
        onClose={() => setShowInventory(false)}
      />
      <ShopModal
        isOpen={showShop}
        onClose={() => setShowShop(false)}
      />
      <EarnCoinsModal
        isOpen={showEarnCoins}
        onClose={() => setShowEarnCoins(false)}
      />
      <DailyRewardModal
        isOpen={showDailyReward}
        onClose={() => setShowDailyReward(false)}
      />
    </>
  )
}

function StatBox({ label, value, variants, chartData, color = '#ffffff' }: { label: string; value: string | number; variants?: any; chartData?: number[]; color?: string }) {
  return (
    <motion.div
      variants={variants}
      whileHover={{ y: -3, scale: 1.02 }}
      className="p-4 bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/10 
                 hover:border-white/20 hover:bg-white/[0.05] 
                 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                 transition-all duration-300 group relative overflow-hidden"
    >
      {/* Gradient overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(135deg, ${color}08 0%, transparent 50%)`,
        }}
      />

      <div className="relative z-10">
        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2 font-medium group-hover:text-text-secondary transition-colors">
          {label}
        </p>
        <p
          className="text-2xl font-mono font-bold tracking-tighter text-text-primary group-hover:text-white transition-colors"
          style={{
            textShadow: `0 0 20px ${color}20`
          }}
        >
          {value}
        </p>
      </div>

      {/* Background Chart */}
      {chartData && chartData.length > 2 && (
        <div className="absolute bottom-0 left-0 right-0 h-12 opacity-40 group-hover:opacity-60 transition-opacity">
          <SparklineChart data={chartData} color={color} height={48} showArea={true} />
        </div>
      )}
    </motion.div>
  )
}
