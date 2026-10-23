/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * EnhancedProfileModal Component - Premium gaming-style user profile display.
 * Features background images, avatar borders, level progress, stat cards, 
 * tabbed match history, and performance graphs.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * EnhancedProfileModal: Main component rendering the full profile modal.
 * StatCard: Renders individual stat cards with icons and values.
 * HistoryRow: Renders a single match history row.
 * formatDate: Formats dates to relative time strings.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * activeTab: Currently selected tab (matches/stats/graphs).
 * matches: Array of match history entries.
 * loading: Loading state for data fetches.
 * page: Current pagination page.
 * wpmHistory: Historical WPM data for graphs.
 * eloHistory: Historical ELO data for graphs.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 * stores: Auth, Inventory stores.
 * config: API functions.
 * types: Rank utilities.
 * components: SparklineChart for graphs.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { API_ENDPOINTS, getUserMatches } from '../config/api'
import { getRankColor, getRankFromElo, getProfileBackgroundInfo, getProfileBorderInfo, getProfileEffectInfo } from '../types'
import SparklineChart from './SparklineChart'
import RankBadge from './icons/RankBadge'
import AvatarDecoration, { EFFECT_TO_DECORATION, BORDER_TO_DECORATION } from './AvatarDecoration'

interface MatchHistoryEntry {
    match_id: string
    opponent_name: string
    opponent_photo_url: string | null
    opponent_is_bot: boolean
    your_wpm: number
    opponent_wpm: number
    your_accuracy: number
    your_score: number
    elo_change: number
    result: 'win' | 'loss' | 'tie'
    played_at: string
}

interface EnhancedProfileModalProps {
    isOpen: boolean
    onClose: () => void
    backgroundImage?: string
    avatarBorder?: string
}

type TabType = 'matches' | 'stats' | 'graphs' | 'rewards'

export default function EnhancedProfileModal({
    isOpen,
    onClose,
    backgroundImage,
    avatarBorder
}: EnhancedProfileModalProps) {
    const { user, stats, idToken } = useAuthStore()
    const {
        coins,
        equippedBorder,
        equippedBackground,
        equippedProfileEffect,
        unlockedBackgrounds,
        unlockedProfileEffects,
        unlockedBorders,
        fetchProfileInventory
    } = useInventoryStore()
    const [activeTab, setActiveTab] = useState<TabType>('matches')
    const [matches, setMatches] = useState<MatchHistoryEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const [totalMatches, setTotalMatches] = useState(0)
    const [wpmHistory, setWpmHistory] = useState<number[]>([])
    const [eloHistory, setEloHistory] = useState<number[]>([])

    const bgInfo = equippedBackground ? getProfileBackgroundInfo(equippedBackground) : null
    const borderInfo = equippedBorder ? getProfileBorderInfo(equippedBorder) : null
    const effectInfo = equippedProfileEffect ? getProfileEffectInfo(equippedProfileEffect) : null

    const limit = 10

    const fetchMatches = useCallback(async () => {
        if (!idToken) return

        setLoading(true)
        try {
            const response = await fetch(`${API_ENDPOINTS.userMatches}?page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            })

            if (response.ok) {
                const data = await response.json()
                setMatches(data.matches)
                setTotalMatches(data.total_matches)
            }
        } catch (error) {
            console.error('Failed to fetch match history:', error)
        } finally {
            setLoading(false)
        }
    }, [idToken, page])

    const fetchHistoryData = useCallback(async () => {
        if (!idToken) return
        try {
            const matchData = await getUserMatches(idToken, 20)
            const sorted = [...matchData].reverse()
            setWpmHistory(sorted.map(m => m.wpm))
            setEloHistory(sorted.map(m => m.elo_after))
        } catch (err) {
            console.error('Failed to load history stats', err)
        }
    }, [idToken])

    useEffect(() => {
        if (isOpen && idToken) {
            fetchMatches()
            fetchHistoryData()
            fetchProfileInventory(idToken)
        }
    }, [isOpen, idToken, fetchMatches, fetchHistoryData, fetchProfileInventory])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    const formatDate = (dateString: string) => {
        const utcDateString = dateString.endsWith('Z') || dateString.includes('+')
            ? dateString
            : dateString + 'Z'

        const date = new Date(utcDateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const formatFullDate = (dateString: string) => {
        const utcDateString = dateString.endsWith('Z') || dateString.includes('+')
            ? dateString
            : dateString + 'Z'
        const date = new Date(utcDateString)
        return date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '.') + ' - ' + date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    }

    const totalPages = Math.ceil(totalMatches / limit)
    const winRate = stats && stats.totalMatches > 0
        ? Math.round((stats.wins / stats.totalMatches) * 100)
        : 0
    const rank = stats ? getRankFromElo(stats.currentElo) : 'Unranked'
    const currentElo = stats?.currentElo || 1000
    const nextRankElo = currentElo < 1000 ? 1000 : currentElo < 2000 ? 2000 : currentElo < 3000 ? 3000 : 10000
    const prevRankElo = currentElo < 1000 ? 0 : currentElo < 2000 ? 1000 : currentElo < 3000 ? 2000 : 3000
    const eloProgress = ((currentElo - prevRankElo) / (nextRankElo - prevRankElo)) * 100

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/85 backdrop-blur-lg z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        className="fixed inset-0 flex items-center justify-center z-50 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl"
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Effect glow border around entire card - Premium Discord-style */}
                            {effectInfo && (() => {
                                const getAnimationStyle = (anim: string) => {
                                    const animationMap: Record<string, string> = {
                                        'glow': 'profile-border-glow 2.5s ease-in-out infinite',
                                        'pulse': 'profile-border-pulse 2s ease-in-out infinite',
                                        'sparkle': 'profile-border-sparkle 3s linear infinite',
                                        'shimmer': 'profile-border-sparkle 2.5s ease-in-out infinite',
                                        'fade': 'profile-border-glow 3s ease-in-out infinite',
                                        'wave': 'profile-border-aurora 4s ease-in-out infinite',
                                        'float': 'profile-border-aurora 3s ease-in-out infinite',
                                        'blink': 'profile-border-electric 2s linear infinite',
                                        'rotate': 'profile-border-galaxy 8s linear infinite',
                                        'scale': 'profile-border-pulse 2.5s ease-in-out infinite',
                                        'bounce': 'profile-border-pulse 1.5s ease-in-out infinite',
                                        'sway': 'profile-border-aurora 3.5s ease-in-out infinite',
                                        'particles': 'profile-border-sparkle 2s ease-in-out infinite',
                                        'rings': 'profile-border-plasma 3s ease-in-out infinite',
                                        'lightning': 'profile-border-electric 1.5s linear infinite',
                                        'fire': 'profile-border-fire 2s ease-in-out infinite',
                                        'firestorm': 'profile-border-fire 1.5s ease-in-out infinite',
                                        'crystals': 'profile-border-crystal 3s ease-in-out infinite',
                                        'smoke': 'profile-border-glow 4s ease-in-out infinite',
                                        'glitch': 'profile-border-electric 0.8s linear infinite',
                                        'matrix': 'profile-border-neon 2s ease-in-out infinite',
                                        'neon': 'profile-border-neon 3s ease-in-out infinite',
                                        'pixels': 'profile-border-electric 1.2s linear infinite',
                                        'plasma': 'profile-border-plasma 3s ease-in-out infinite',
                                        'warp': 'profile-border-rift 4s ease-in-out infinite',
                                        'sphere': 'profile-border-pulse 2.5s ease-in-out infinite',
                                        'aurora': 'profile-border-aurora 4s ease-in-out infinite',
                                        'shatter': 'profile-border-crystal 2s ease-in-out infinite',
                                        'thunder': 'profile-border-electric 1s linear infinite',
                                        'shadow': 'profile-border-void 3s ease-in-out infinite',
                                        'supernova': 'profile-border-supernova 4s ease-in-out infinite',
                                        'void': 'profile-border-void 3s ease-in-out infinite',
                                        'galaxy': 'profile-border-galaxy 6s linear infinite',
                                        'phoenix': 'profile-border-phoenix 3s ease-in-out infinite',
                                        'divine': 'profile-border-halo 4s linear infinite',
                                        'cosmic': 'profile-border-galaxy 5s linear infinite',
                                        'reality': 'profile-border-rift 3s ease-in-out infinite',
                                        'timewarp': 'profile-border-quantum 2s linear infinite',
                                        'singularity': 'profile-border-void 4s ease-in-out infinite',
                                        'transcendence': 'profile-border-halo 5s linear infinite',
                                        'halo': 'profile-border-halo 4s linear infinite',
                                        'rift': 'profile-border-rift 3s ease-in-out infinite',
                                        'quantum': 'profile-border-quantum 2.5s linear infinite',
                                        'dragon': 'profile-border-dragon 2.5s ease-in-out infinite',
                                        'crystal': 'profile-border-crystal 3s ease-in-out infinite',
                                        'ice': 'profile-border-ice 3s ease-in-out infinite',
                                        'electric': 'profile-border-electric 1.5s linear infinite',
                                        'rainbow': 'profile-border-rainbow 4s linear infinite'
                                    };
                                    return animationMap[anim] || 'profile-border-glow 2.5s ease-in-out infinite';
                                };

                                const isRainbow = effectInfo.color === 'rainbow';
                                const gradientBg = isRainbow
                                    ? 'linear-gradient(135deg, #ff0080, #ff8c00, #40e0d0, #8b5cf6, #ff0080)'
                                    : `linear-gradient(135deg, ${effectInfo.color}, ${effectInfo.color}90, ${effectInfo.color}60, ${effectInfo.color}90, ${effectInfo.color})`;

                                return (
                                    <div
                                        className="absolute -inset-[6px] rounded-2xl"
                                        style={{
                                            background: gradientBg,
                                            backgroundSize: isRainbow ? '300% 300%' : undefined,
                                            animation: getAnimationStyle(effectInfo.animation),
                                            opacity: 1
                                        }}
                                    />
                                );
                            })()}
                            <div className="relative"></div>
                            {equippedProfileEffect && (
                                <div className="absolute inset-0 pointer-events-none z-20">
                                    <AvatarDecoration
                                        decorationType={EFFECT_TO_DECORATION[equippedProfileEffect] || 'default'}
                                        animate={true}
                                        className="w-full h-full"
                                    />
                                </div>
                            )}
                            <div
                                className="relative rounded-2xl overflow-hidden"
                                style={{
                                    background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                                    border: effectInfo
                                        ? `2px solid ${effectInfo.color}70`
                                        : '1px solid rgba(255,255,255,0.08)',
                                    boxShadow: effectInfo
                                        ? `0 0 30px ${effectInfo.color}50, inset 0 1px 1px ${effectInfo.color}30`
                                        : undefined
                                }}
                            >
                                {/* Equipped Background with blur */}
                                {bgInfo && (
                                    <>
                                        <div
                                            className="absolute inset-0 bg-cover bg-center"
                                            style={{ backgroundImage: `url(${bgInfo.path})` }}
                                        />
                                        <div className="absolute inset-0 backdrop-blur-[0.5px] bg-black/30" />
                                    </>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0d0d]/80 to-[#0d0d0d]" />

                                {/* Effect color overlay inside card - Enhanced */}
                                {effectInfo && (() => {
                                    const isRainbow = effectInfo.color === 'rainbow';
                                    const colorVal = isRainbow ? '#ec4899' : effectInfo.color;
                                    const getInnerAnimation = (anim: string) => {
                                        if (['pulse', 'scale', 'bounce', 'sphere'].includes(anim)) {
                                            return 'profile-inner-pulse 3s ease-in-out infinite';
                                        }
                                        if (['sparkle', 'shimmer', 'particles', 'crystals', 'pixels', 'shatter'].includes(anim)) {
                                            return 'profile-inner-sparkle 2.5s ease-in-out infinite';
                                        }
                                        return 'profile-inner-glow 3s ease-in-out infinite';
                                    };
                                    return (
                                        <>
                                            <div
                                                className="absolute inset-0 pointer-events-none"
                                                style={{
                                                    background: `radial-gradient(ellipse at top, ${colorVal}30 0%, transparent 50%), radial-gradient(ellipse at bottom, ${colorVal}25 0%, transparent 60%)`,
                                                    animation: getInnerAnimation(effectInfo.animation)
                                                }}
                                            />
                                            {/* (Moved AvatarDecoration outside) */}
                                        </>
                                    );
                                })()}

                                <div className="relative z-10 overflow-y-auto max-h-[90vh] custom-scrollbar">
                                    <button
                                        onClick={onClose}
                                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-gray-400 flex items-center justify-center transition-colors z-20 shadow-lg"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                    </button>

                                    <div className="px-8 pt-6 pb-4">
                                        <div className="flex items-center gap-2 text-white/40 text-sm">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            <span>Welcome, {user?.displayName}</span>
                                        </div>
                                    </div>

                                    <div className="px-8 pb-6">
                                        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                                            <div className="flex flex-col items-center lg:items-start">
                                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                                    <div className="relative">
                                                        {/* Avatar container with proper spacing for border decoration */}
                                                        <div className="relative p-4">
                                                            {/* Border decoration - wraps around avatar */}
                                                            {borderInfo && equippedBorder && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <AvatarDecoration
                                                                        decorationType={BORDER_TO_DECORATION[equippedBorder] || 'default'}
                                                                        size={168}
                                                                        animate={true}
                                                                    />
                                                                </div>
                                                            )}
                                                            {/* Actual avatar */}
                                                            <div
                                                                className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden shadow-lg"
                                                                style={{
                                                                    boxShadow: effectInfo?.color
                                                                        ? `0 0 30px ${effectInfo.color}60, 0 4px 20px rgba(0,0,0,0.3)`
                                                                        : borderInfo?.color
                                                                            ? `0 4px 20px ${borderInfo.color}40`
                                                                            : '0 4px 20px rgba(249, 115, 22, 0.2)'
                                                                }}
                                                            >
                                                                {user?.photoURL ? (
                                                                    <img
                                                                        src={user.photoURL}
                                                                        alt={user.displayName}
                                                                        className="w-full h-full object-cover"
                                                                        crossOrigin="anonymous"
                                                                        referrerPolicy="no-referrer"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-2xl sm:text-4xl font-bold text-white/60 bg-gradient-to-br from-orange-500/20 to-red-500/20">
                                                                        {user?.displayName?.charAt(0) || '?'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <h2 className="text-lg sm:text-xl font-bold text-white mt-4 tracking-wide text-center lg:text-left">{user?.displayName}</h2>
                                                <p className="text-base sm:text-lg font-mono text-emerald-400 mt-1">{coins} Coins</p>
                                            </div>

                                            <div className="flex-1 space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <span
                                                        className="px-3 py-1 rounded text-sm font-bold"
                                                        style={{
                                                            backgroundColor: `${getRankColor(rank)}20`,
                                                            color: getRankColor(rank)
                                                        }}
                                                    >
                                                        {rank}
                                                    </span>
                                                    <span className="text-white/50 text-sm font-mono">{currentElo} / {nextRankElo}</span>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-xs text-white/40">
                                                        <span>Next rank</span>
                                                        <span>{rank === 'Ranker' ? 'MAX' : `${nextRankElo - currentElo} ELO to go`}</span>
                                                    </div>
                                                    <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="absolute inset-y-0 left-0 rounded-full"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(eloProgress, 100)}%` }}
                                                            transition={{ duration: 1, ease: 'easeOut' }}
                                                            style={{
                                                                background: 'linear-gradient(90deg, #f97316, #ea580c, #dc2626)',
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                                                    <StatCard
                                                        icon={
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                                                                <circle cx="12" cy="12" r="10" />
                                                                <path d="M12 6v6l4 2" />
                                                            </svg>
                                                        }
                                                        value={stats?.totalMatches || 0}
                                                        label="Total Games"
                                                    />
                                                    <StatCard
                                                        icon={
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                                                                <path d="M20 6L9 17l-5-5" />
                                                            </svg>
                                                        }
                                                        value={stats?.wins || 0}
                                                        label="Wins"
                                                    />
                                                    <StatCard
                                                        icon={
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-orange-400">
                                                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                                            </svg>
                                                        }
                                                        value={`${Math.round(stats?.avgWpm || 0)} WPM`}
                                                        label="Avg Speed"
                                                    />
                                                    <StatCard
                                                        icon={
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                                                                <circle cx="12" cy="12" r="10" />
                                                                <path d="M8 12l2 2 4-4" />
                                                            </svg>
                                                        }
                                                        value={`${stats && stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0}%`}
                                                        label="Win Rate"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-white/5">
                                        <div className="flex items-center gap-1 px-8 pt-4">
                                            {(['matches', 'stats', 'graphs', 'rewards'] as TabType[]).map((tab) => (
                                                (tab !== 'rewards' || true) && (
                                                    <button
                                                        key={tab}
                                                        onClick={() => setActiveTab(tab)}
                                                        className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab
                                                            ? 'bg-white/[0.05] text-white border-b-2 border-orange-500'
                                                            : 'text-white/40 hover:text-white/60'
                                                            }`}
                                                    >
                                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                                    </button>
                                                )
                                            ))}
                                        </div>

                                        <div className="px-8 py-4 min-h-[300px]">
                                            {activeTab === 'matches' && (
                                                <div className="space-y-1">
                                                    <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs text-white/30 uppercase tracking-wider border-b border-white/5">
                                                        <span>Date & Time</span>
                                                        <span>Opponent</span>
                                                        <span className="text-center">WPM</span>
                                                        <span className="text-center">ELO Change</span>
                                                        <span className="text-right">Status</span>
                                                    </div>

                                                    {loading ? (
                                                        <div className="space-y-2 py-4">
                                                            {[...Array(5)].map((_, i) => (
                                                                <div key={i} className="h-12 bg-white/[0.02] rounded animate-pulse" />
                                                            ))}
                                                        </div>
                                                    ) : matches.length === 0 ? (
                                                        <div className="py-12 text-center text-white/30">
                                                            No matches yet
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {matches.map((match) => (
                                                                <HistoryRow
                                                                    key={match.match_id}
                                                                    match={match}
                                                                    formatDate={formatFullDate}
                                                                />
                                                            ))}
                                                        </>
                                                    )}

                                                    {totalPages > 1 && (
                                                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                            <button
                                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                                disabled={page === 1}
                                                                className="text-xs text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            >
                                                                Previous
                                                            </button>
                                                            <span className="text-xs text-white/30">
                                                                Page {page} of {totalPages}
                                                            </span>
                                                            <button
                                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                                disabled={page === totalPages}
                                                                className="text-xs text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                                                        <span className="text-xs text-white/30">Total matches</span>
                                                        <span className="text-sm font-mono text-white">{totalMatches}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'stats' && (
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Win Rate</p>
                                                        <p className="text-2xl font-mono font-bold text-emerald-400">{winRate}%</p>
                                                    </div>
                                                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Best WPM</p>
                                                        <p className="text-2xl font-mono font-bold text-white">{stats?.bestWpm || 0}</p>
                                                    </div>
                                                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Accuracy</p>
                                                        <p className="text-2xl font-mono font-bold text-white">{Math.round(stats?.avgAccuracy || 0)}%</p>
                                                    </div>
                                                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Peak ELO</p>
                                                        <p className="text-2xl font-mono font-bold text-white">{stats?.peakElo || 1000}</p>
                                                    </div>
                                                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Wins</p>
                                                        <p className="text-2xl font-mono font-bold text-emerald-400">{stats?.wins || 0}</p>
                                                    </div>
                                                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Losses</p>
                                                        <p className="text-2xl font-mono font-bold text-red-400">{stats?.losses || 0}</p>
                                                    </div>
                                                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Current ELO</p>
                                                        <p className="text-2xl font-mono font-bold text-white">{stats?.currentElo || 1000}</p>
                                                    </div>
                                                    <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                                                        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Rank</p>
                                                        <p className="text-2xl font-bold" style={{ color: getRankColor(rank) }}>{rank}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'graphs' && (
                                                <div className="space-y-6">
                                                    <div className="bg-white/[0.02] rounded-xl p-6 border border-white/5">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h3 className="text-sm font-medium text-white/60">ELO History</h3>
                                                            <span className="text-xs text-white/30">Last 20 matches</span>
                                                        </div>
                                                        {eloHistory.length > 2 ? (
                                                            <SparklineChart
                                                                data={eloHistory}
                                                                color="#f97316"
                                                                height={140}
                                                                showArea={true}
                                                                showDots={false}
                                                                showGrid={true}
                                                                showLabels={true}
                                                            />
                                                        ) : (
                                                            <p className="text-white/30 text-sm py-8 text-center">Not enough data yet</p>
                                                        )}
                                                    </div>
                                                    <div className="bg-white/[0.02] rounded-xl p-6 border border-white/5">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h3 className="text-sm font-medium text-white/60">WPM History</h3>
                                                            <span className="text-xs text-white/30">Last 20 matches</span>
                                                        </div>
                                                        {wpmHistory.length > 2 ? (
                                                            <SparklineChart
                                                                data={wpmHistory}
                                                                color="#22c55e"
                                                                height={140}
                                                                showArea={true}
                                                                showDots={false}
                                                                showGrid={true}
                                                                showLabels={true}
                                                            />
                                                        ) : (
                                                            <p className="text-white/30 text-sm py-8 text-center">Not enough data yet</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'rewards' && (
                                                <div className="space-y-6">
                                                    {/* Current Rank Section */}
                                                    <div className="bg-white/[0.02] rounded-xl p-6 border border-white/5 relative overflow-hidden group">
                                                        {/* Background Preview */}
                                                        {rank !== 'Unranked' && (
                                                            <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-700">
                                                                <img
                                                                    src={`/Profile-bg/rank_${rank.toLowerCase()}.png`}
                                                                    className="w-full h-full object-cover"
                                                                    alt={`${rank} Background`}
                                                                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/90 to-transparent" />
                                                            </div>
                                                        )}

                                                        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-start">
                                                            <div className="w-24 h-24 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center p-4">
                                                                <RankBadge rank={rank} size={64} animate={true} />
                                                            </div>
                                                            <div className="flex-1 text-center md:text-left">
                                                                <h3 className="text-xl font-bold text-white mb-2">Current Rank Rewards</h3>
                                                                <p className="text-white/40 text-sm mb-4">Rewards active for <span style={{ color: getRankColor(rank) }}>{rank}</span> division.</p>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                                                            </div>
                                                                            <div className="text-left">
                                                                                <p className="text-sm text-emerald-400 font-bold">
                                                                                    {rank === 'Unranked' ? '0%' : rank === 'Bronze' ? '+20%' : rank === 'Gold' ? '+40%' : rank === 'Platinum' ? '+80%' : '+160%'} Boost
                                                                                </p>
                                                                                <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider">Coin Multiplier</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                                                                        <div className="flex items-center gap-3 justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center text-purple-400">
                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 16l6-6 3 3 6-6M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                                                </div>
                                                                                <div className="text-left">
                                                                                    <p className="text-sm text-purple-400 font-bold">{rank} Background</p>
                                                                                    <p className="text-[10px] text-purple-400/60 uppercase tracking-wider">Exclusive Theme</p>
                                                                                </div>
                                                                            </div>
                                                                            {rank !== 'Unranked' && (
                                                                                <button
                                                                                    onClick={async () => {
                                                                                        if (unlockedBackgrounds.includes(`rank_${rank.toLowerCase()}`)) {
                                                                                            // Equip if owned
                                                                                            await useInventoryStore.getState().equipBackground(`rank_${rank.toLowerCase()}`, idToken!)
                                                                                        } else {
                                                                                            // Claim if not
                                                                                            const res = await useInventoryStore.getState().claimRankReward(idToken!)
                                                                                            if (res.success) {
                                                                                                // Auto equip after claim
                                                                                                await useInventoryStore.getState().equipBackground(`rank_${rank.toLowerCase()}`, idToken!)
                                                                                            }
                                                                                        }
                                                                                    }}
                                                                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${unlockedBackgrounds.includes(`rank_${rank.toLowerCase()}`)
                                                                                        ? equippedBackground === `rank_${rank.toLowerCase()}`
                                                                                            ? 'bg-purple-500/20 text-purple-300 cursor-default'
                                                                                            : 'bg-purple-500 hover:bg-purple-400 text-white'
                                                                                        : 'bg-white/10 hover:bg-white/20 text-white animate-pulse'
                                                                                        }`}
                                                                                    disabled={unlockedBackgrounds.includes(`rank_${rank.toLowerCase()}`) && equippedBackground === `rank_${rank.toLowerCase()}`}
                                                                                >
                                                                                    {unlockedBackgrounds.includes(`rank_${rank.toLowerCase()}`)
                                                                                        ? equippedBackground === `rank_${rank.toLowerCase()}`
                                                                                            ? 'Equipped'
                                                                                            : 'Equip'
                                                                                        : 'Claim'}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Next Rank Preview */}
                                                    {rank !== 'Ranker' && (
                                                        <div className="bg-white/[0.02] rounded-xl p-6 border border-white/5 border-dashed opacity-60 hover:opacity-100 transition-opacity">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15l-2 5l9-9l-9 9l2-5" /></svg>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm text-white/40 uppercase tracking-wider font-bold">Next Rank Unlocks</p>
                                                                    <p className="text-white font-medium">
                                                                        Reach <span className="text-white font-bold">
                                                                            {rank === 'Unranked' ? 'Bronze' : rank === 'Bronze' ? 'Gold' : rank === 'Gold' ? 'Platinum' : 'Ranker'}
                                                                        </span> to unlock <span className="text-emerald-400">
                                                                            {rank === 'Unranked' ? '+20%' : rank === 'Bronze' ? '+40%' : rank === 'Gold' ? '+80%' : '+160%'} Boost
                                                                        </span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
    return (
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 flex items-center gap-3 hover:bg-white/[0.05] transition-colors">
            <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center">
                {icon}
            </div>
            <div>
                <p className="text-lg font-mono font-bold text-white">{value}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
            </div>
        </div>
    );
}

function HistoryRow({ match, formatDate }: { match: MatchHistoryEntry; formatDate: (d: string) => string }) {
    const isWin = match.result === 'win';
    const isLoss = match.result === 'loss';

    return (
        <div className="grid grid-cols-5 gap-4 items-center px-4 py-3 rounded-lg hover:bg-white/[0.02] transition-colors">
            <span className="text-xs text-orange-400/80 font-mono">{formatDate(match.played_at)}</span>
            <span className="text-sm text-white font-medium truncate">
                {match.opponent_is_bot ? 'Bot' : match.opponent_name}
            </span>
            <span className="text-sm text-orange-400 font-mono text-center">{Math.round(match.your_wpm)}</span>
            <span className={`text-sm font-mono text-center ${match.elo_change > 0 ? 'text-emerald-400' : match.elo_change < 0 ? 'text-red-400' : 'text-white/30'}`}>
                {match.elo_change > 0 ? '+' : ''}{match.elo_change}
            </span>
            <div className="flex items-center justify-end gap-2">
                {isWin ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                        Victory
                    </span>
                ) : isLoss ? (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                        Defeat
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-xs text-white/40">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                        </svg>
                        Tie
                    </span>
                )}
            </div>
        </div>
    );
}
