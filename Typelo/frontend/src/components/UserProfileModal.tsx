/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * UserProfileModal Component - Displays another user's detailed public profile.
 * Enhanced gaming-style design with full stats, level progress, and friend request.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * UserProfileModal: Main component.
 * fetchProfile: Gets public profile data from API.
 * handleSendRequest: Sends a friend request to the user.
 * StatCard: Sub-component for stat display.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * profile: Public profile data.
 * loading: Loading state.
 * sending: Request sending state.
 * sent: Request sent success state.
 * error: Error message.
 * activeTab: Currently selected tab.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 * stores: Auth store.
 * config: API functions.
 * types: Rank utilities.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { sendFriendRequest, getUserPublicProfile, PublicProfile } from '../config/api'
import { getRankColor, Rank, getRankFromElo, getProfileBackgroundInfo, getProfileBorderInfo, getProfileEffectInfo } from '../types'
import AvatarDecoration, { EFFECT_TO_DECORATION, BORDER_TO_DECORATION } from './AvatarDecoration'

interface UserProfileModalProps {
    isOpen: boolean
    onClose: () => void
    userId: string
    userName: string
    userPhoto: string | null
    userElo: number
    userRank: string
}

type TabType = 'stats' | 'overview'

export default function UserProfileModal({
    isOpen,
    onClose,
    userId,
    userName,
    userPhoto,
    userElo,
    userRank,
}: UserProfileModalProps) {
    const { idToken, user: currentUser } = useAuthStore()
    const [profile, setProfile] = useState<PublicProfile | null>(null)
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<TabType>('overview')

    const fetchProfile = async () => {
        if (!idToken) return

        setLoading(true)
        setError(null)

        try {
            const data = await getUserPublicProfile(userId, idToken)
            setProfile(data)
        } catch (err) {
            console.error('Failed to fetch profile:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen && idToken) {
            setSent(false)
            setError(null)
            setActiveTab('overview')
            fetchProfile()
        }
    }, [isOpen, idToken, userId])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    const handleSendRequest = async () => {
        if (!idToken || sending || sent) return

        setSending(true)
        setError(null)

        try {
            await sendFriendRequest(userId, idToken)
            setSent(true)
        } catch (err: unknown) {
            console.error('Failed to send request:', err)
            const apiError = err as { message?: string }
            setError(apiError.message || 'Failed to send request')
        } finally {
            setSending(false)
        }
    }

    const winRate = profile && profile.total_matches > 0
        ? Math.round((profile.wins / profile.total_matches) * 100)
        : 0
    const rank = getRankFromElo(userElo)
    const isOwnProfile = currentUser?.uid === userId
    const currentElo = userElo
    const nextRankElo = currentElo < 1000 ? 1000 : currentElo < 2000 ? 2000 : currentElo < 3000 ? 3000 : 10000
    const prevRankElo = currentElo < 1000 ? 0 : currentElo < 2000 ? 1000 : currentElo < 3000 ? 2000 : 3000
    const eloProgress = ((currentElo - prevRankElo) / (nextRankElo - prevRankElo)) * 100

    // Profile customization
    const bgInfo = profile?.equipped_background ? getProfileBackgroundInfo(profile.equipped_background) : null
    const borderInfo = profile?.equipped_border ? getProfileBorderInfo(profile.equipped_border) : null
    const effectInfo = profile?.equipped_profile_effect ? getProfileEffectInfo(profile.equipped_profile_effect) : null

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/85 backdrop-blur-lg z-[60]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        className="fixed inset-0 flex items-center justify-center z-[60] p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl"
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
                            <div className="relative">
                                {profile?.equipped_profile_effect && (
                                    <div className="absolute -inset-[2px] pointer-events-none z-20">
                                        <AvatarDecoration
                                            decorationType={EFFECT_TO_DECORATION[profile.equipped_profile_effect] || 'default'}
                                            animate={true}
                                            className="w-full h-full"
                                        />
                                    </div>
                                )}
                                <div
                                    className="relative rounded-2xl overflow-hidden"
                                    style={{
                                        background: bgInfo ? `url(${bgInfo.path}) center/cover no-repeat` : 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                                        border: effectInfo
                                            ? `2px solid ${effectInfo.color}70`
                                            : '1px solid rgba(255,255,255,0.08)',
                                        boxShadow: effectInfo
                                            ? `0 0 30px ${effectInfo.color}50, inset 0 1px 1px ${effectInfo.color}30`
                                            : undefined
                                    }}
                                >
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
                                                {/* SVG Effect decorations ON card border - facing inward */}
                                                {/* (Moved outside) */}
                                            </>
                                        );
                                    })()}

                                    <div className="relative z-10 overflow-y-auto max-h-[90vh] custom-scrollbar">
                                        <div className="px-6 py-5 flex items-center justify-between border-b border-white/[0.04]">
                                            <h2 className="text-base font-semibold text-white">Player Profile</h2>
                                            <button
                                                onClick={onClose}
                                                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-gray-400 flex items-center justify-center transition-colors shadow-lg"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>

                                        <div className="p-6">
                                            <div className="flex flex-col items-center mb-6">
                                                <div className="relative">
                                                    {/* Avatar container with proper spacing for decorations */}
                                                    <div className="relative p-4">
                                                        {/* Border decoration - wraps around avatar */}
                                                        {borderInfo && profile?.equipped_border && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <AvatarDecoration
                                                                    decorationType={BORDER_TO_DECORATION[profile.equipped_border] || 'default'}
                                                                    size={144}
                                                                    animate={true}
                                                                />
                                                            </div>
                                                        )}
                                                        {/* Actual avatar - innermost */}
                                                        <div
                                                            className="relative w-24 h-24 rounded-full overflow-hidden shadow-lg"
                                                            style={{
                                                                boxShadow: effectInfo?.color
                                                                    ? `0 0 25px ${effectInfo.color}60, 0 4px 20px rgba(0,0,0,0.3)`
                                                                    : borderInfo?.color
                                                                        ? `0 4px 20px ${borderInfo.color}40`
                                                                        : '0 4px 20px rgba(249, 115, 22, 0.2)'
                                                            }}
                                                        >
                                                            {userPhoto ? (
                                                                <img
                                                                    src={userPhoto}
                                                                    alt={userName}
                                                                    className="w-full h-full object-cover"
                                                                    crossOrigin="anonymous"
                                                                    referrerPolicy="no-referrer"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-3xl text-white/60 bg-gradient-to-br from-orange-500/20 to-red-500/20">
                                                                    {userName.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Friend request button */}
                                                    {!isOwnProfile && (
                                                        <button
                                                            onClick={handleSendRequest}
                                                            disabled={sending || sent}
                                                            className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-[#0d0d0d] flex items-center justify-center transition-colors ${sent ? 'bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-400'
                                                                }`}
                                                            title={sent ? "Friend request sent" : "Add friend"}
                                                        >
                                                            {sending ? (
                                                                <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                                                            ) : sent ? (
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                                                    <path d="M20 6L9 17l-5-5" />
                                                                </svg>
                                                            ) : (
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                                    <path d="M12 5v14M5 12h14" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>

                                                <h3 className="text-xl font-bold text-white mb-2">{userName}</h3>

                                                <div className="flex items-center gap-3 mb-4">
                                                    <span
                                                        className="px-3 py-1 rounded text-sm font-bold"
                                                        style={{
                                                            backgroundColor: `${getRankColor(userRank as Rank)}20`,
                                                            color: getRankColor(userRank as Rank)
                                                        }}
                                                    >
                                                        {userRank}
                                                    </span>
                                                    <span className="text-sm font-mono text-white/50">{userElo} / {nextRankElo}</span>
                                                </div>

                                                <div className="w-full max-w-xs space-y-2">
                                                    <div className="flex justify-between text-xs text-white/40">
                                                        <span>Next rank</span>
                                                        <span>{rank === 'Ranker' ? 'MAX' : `${nextRankElo - currentElo} ELO to go`}</span>
                                                    </div>
                                                    <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
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
                                            </div>

                                            <div className="border-t border-white/5 pt-4">
                                                <div className="flex items-center gap-1 mb-4">
                                                    {(['overview', 'stats'] as TabType[]).map((tab) => (
                                                        <button
                                                            key={tab}
                                                            onClick={() => setActiveTab(tab)}
                                                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab
                                                                ? 'bg-white/[0.05] text-white'
                                                                : 'text-white/40 hover:text-white/60'
                                                                }`}
                                                        >
                                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>

                                                {loading ? (
                                                    <div className="py-8 flex justify-center">
                                                        <div className="w-6 h-6 border-2 border-white/20 border-t-orange-400 rounded-full animate-spin" />
                                                    </div>
                                                ) : profile && (
                                                    <>
                                                        {activeTab === 'overview' && (
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <StatCard
                                                                    icon={
                                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                                                                            <circle cx="12" cy="12" r="10" />
                                                                            <path d="M12 6v6l4 2" />
                                                                        </svg>
                                                                    }
                                                                    value={profile.total_matches}
                                                                    label="Total Games"
                                                                />
                                                                <StatCard
                                                                    icon={
                                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                                                                            <path d="M20 6L9 17l-5-5" />
                                                                        </svg>
                                                                    }
                                                                    value={`${winRate}%`}
                                                                    label="Win Rate"
                                                                    highlight
                                                                />
                                                                <StatCard
                                                                    icon={
                                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                                                                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                                                        </svg>
                                                                    }
                                                                    value={profile.wins}
                                                                    label="Wins"
                                                                />
                                                                <StatCard
                                                                    icon={
                                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                                                                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                                                        </svg>
                                                                    }
                                                                    value={`${Math.round(profile.avg_wpm)} WPM`}
                                                                    label="Avg Speed"
                                                                />
                                                            </div>
                                                        )}

                                                        {activeTab === 'stats' && (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                                                    <span className="text-sm text-white/50">Total Matches</span>
                                                                    <span className="font-mono font-bold text-white">{profile.total_matches}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                                                    <span className="text-sm text-white/50">Wins</span>
                                                                    <span className="font-mono font-bold text-emerald-400">{profile.wins}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                                                    <span className="text-sm text-white/50">Losses</span>
                                                                    <span className="font-mono font-bold text-red-400">{profile.losses}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                                                    <span className="text-sm text-white/50">Win Rate</span>
                                                                    <span className="font-mono font-bold text-white">{winRate}%</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                                                    <span className="text-sm text-white/50">Average WPM</span>
                                                                    <span className="font-mono font-bold text-orange-400">{Math.round(profile.avg_wpm)}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                                                    <span className="text-sm text-white/50">Current ELO</span>
                                                                    <span className="font-mono font-bold text-white">{profile.elo_rating}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                                                    <span className="text-sm text-white/50">Rank</span>
                                                                    <span className="font-bold" style={{ color: getRankColor(profile.rank as Rank) }}>{profile.rank}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                {error && (
                                                    <p className="text-red-400 text-sm text-center mt-4">{error}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

function StatCard({ icon, value, label, highlight }: { icon: React.ReactNode; value: string | number; label: string; highlight?: boolean }) {
    return (
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center">
                {icon}
            </div>
            <div>
                <p className={`text-xl font-semibold ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
            </div>
        </div>
    )
}
