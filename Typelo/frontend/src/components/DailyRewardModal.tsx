/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * DailyRewardModal - Shows 7-day login reward calendar and claim button.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * DailyRewardModal: Main modal component with streak calendar.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * REWARD_ICONS: Icon mapping for reward types.
 * DAILY_REWARDS: Client-side reward preview data.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react, framer-motion, api functions.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { getDailyStatus, claimDailyReward, DailyStatus, ClaimDailyResult } from '../config/api'
import { useAuthStore } from '../stores/authStore'
import { useInventoryStore } from '../stores/inventoryStore'

interface DailyRewardModalProps {
    isOpen: boolean
    onClose: () => void
}

const DAILY_REWARDS = [
    { day: 1, coins: 100, type: 'coins', label: '100' },
    { day: 2, coins: 200, type: 'coins', label: '200' },
    { day: 3, type: 'effect', label: 'Effect' },
    { day: 4, coins: 300, type: 'coins', label: '300' },
    { day: 5, type: 'cursor', label: 'Cursor' },
    { day: 6, coins: 400, type: 'coins', label: '400' },
    { day: 7, type: 'special', label: 'Jackpot' },
]

const RewardIcon = ({ type, size = 32, isActive }: { type: string; size?: number; isActive?: boolean }) => {
    switch (type) {
        case 'coins':
            return (
                <div className="relative">
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isActive ? "text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]" : "text-yellow-500/50"}>
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 6v12M9 10h6M9 14h6" />
                    </svg>
                    {isActive && (
                        <motion.div
                            className="absolute inset-0 bg-yellow-400/20 blur-xl rounded-full"
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    )}
                </div>
            )
        case 'effect':
            return (
                <div className="relative">
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isActive ? "text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.5)]" : "text-purple-500/50"}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {isActive && (
                        <motion.div
                            className="absolute inset-0 bg-purple-400/20 blur-xl rounded-full"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        />
                    )}
                </div>
            )
        case 'cursor':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isActive ? "text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.5)]" : "text-cyan-500/50"}>
                    <path d="M4 4v16l4-4h12V4H4z" />
                </svg>
            )
        case 'special':
            return (
                <div className="relative">
                    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isActive ? "text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" : "text-amber-600/50"}>
                        <path d="M12 3l1.5 4.5H18l-3.5 2.5 1.5 4.5L12 12l-4 2.5 1.5-4.5L6 7.5h4.5L12 3z" />
                        <path d="M12 17v4" />
                    </svg>
                    {isActive && (
                        <motion.div
                            className="absolute inset-0 bg-amber-500/30 blur-xl rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                        />
                    )}
                </div>
            )
        default:
            return null
    }
}

export default function DailyRewardModal({ isOpen, onClose }: DailyRewardModalProps) {
    const { idToken } = useAuthStore()
    const { fetchInventory } = useInventoryStore()
    const [status, setStatus] = useState<DailyStatus | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isClaiming, setIsClaiming] = useState(false)
    const [claimResult, setClaimResult] = useState<ClaimDailyResult | null>(null)

    useEffect(() => {
        if (isOpen && idToken) {
            setIsLoading(true)
            getDailyStatus(idToken)
                .then(setStatus)
                .catch(console.error)
                .finally(() => setIsLoading(false))
        }
    }, [isOpen, idToken])

    const handleClaim = async () => {
        if (!idToken || !status?.can_claim) return

        setIsClaiming(true)
        try {
            const result = await claimDailyReward(idToken)
            setClaimResult(result)
            // Refresh inventory to get new coins/items
            fetchInventory(idToken)
            // Update status
            const newStatus = await getDailyStatus(idToken)
            setStatus(newStatus)
        } catch (error) {
            console.error('Failed to claim:', error)
        } finally {
            setIsClaiming(false)
        }
    }

    if (!isOpen) return null

    const modal = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 30 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-[#0f0f0f] border border-white/10 shadow-2xl"
                    >
                        {/* Decorative Background Gradients */}
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
                        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="relative z-10 p-8 flex flex-col items-center">

                            {/* Header */}
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-black text-white tracking-tight mb-2">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200">
                                        Daily Login Rewards
                                    </span>
                                </h2>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                    <span className="text-sm font-medium text-white/60">Current Streak:</span>
                                    <span className="text-sm font-bold text-amber-400">{status ? status.streak : '-'} Days</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                </div>
                            </div>

                            {/* Rewards Grid */}
                            {isLoading ? (
                                <div className="h-48 flex items-center justify-center w-full">
                                    <div className="w-10 h-10 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="flex gap-3 w-full justify-between items-stretch mb-8 overflow-x-auto py-6 px-4 no-scrollbar">
                                    {DAILY_REWARDS.map((reward) => {
                                        const isPast = status && reward.day < status.current_day
                                        const isCurrent = status && reward.day === status.current_day
                                        const isFuture = status && reward.day > status.current_day
                                        const isDay7 = reward.day === 7

                                        return (
                                            <motion.div
                                                key={reward.day}
                                                initial={isCurrent ? { scale: 0.95 } : {}}
                                                animate={isCurrent ? { scale: 1.05 } : {}}
                                                transition={{ duration: 0.5 }}
                                                className={`
                                                    relative flex flex-col items-center justify-between p-4 rounded-2xl min-w-[100px] flex-1
                                                    transition-all duration-300 group
                                                    ${isFuture ? 'bg-white/5 border border-white/10 hover:border-white/20' : ''}
                                                    ${isPast ? 'bg-emerald-900/10 border border-emerald-500/20' : ''}
                                                    ${isCurrent ? 'bg-gradient-to-b from-amber-500/20 to-orange-600/10 border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : ''}
                                                    ${isDay7 ? 'min-w-[140px] border border-purple-500/30 bg-purple-500/5' : ''}
                                                `}
                                            >
                                                {/* Status Badge */}
                                                <div className="absolute top-2 left-0 right-0 flex justify-center">
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isCurrent ? 'text-amber-400' : 'text-white/20'}`}>
                                                        Day {reward.day}
                                                    </span>
                                                </div>

                                                {/* Icon */}
                                                <div className="my-6 transform group-hover:scale-110 transition-transform duration-300">
                                                    <RewardIcon type={reward.type} size={isDay7 ? 40 : 28} isActive={isCurrent || isDay7} />
                                                </div>

                                                {/* Label */}
                                                <div className="text-center">
                                                    <p className={`text-sm font-bold ${isCurrent ? 'text-white' : 'text-white/50'}`}>
                                                        {reward.label}
                                                    </p>
                                                    {isDay7 && <p className="text-[10px] text-purple-400 mt-1">Special!</p>}
                                                </div>

                                                {/* Collected Overlay */}
                                                {isPast && (
                                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
                                                        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg transform scale-100 animate-in fade-in zoom-in duration-300">
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
                                                                <path d="M20 6L9 17l-5-5" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Current Indicator */}
                                                {isCurrent && status?.can_claim && (
                                                    <motion.div
                                                        className="absolute -bottom-2 px-2 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded-full shadow-lg"
                                                        animate={{ y: [0, -3, 0] }}
                                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                                    >
                                                        CLAIM!
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Claim Result Message */}
                            {claimResult && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mb-6 w-full max-w-lg bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center overflow-hidden"
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-1">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-emerald-400">Success!</h3>
                                        <p className="text-white/70 text-sm">
                                            You received <span className="text-white font-bold">{claimResult.coins_added} coins</span>
                                            {claimResult.luck_boost_added > 0 && <span className="text-amber-400 font-bold"> + {claimResult.luck_boost_added} Lucky Spins</span>}
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Main Action Button */}
                            <div className="w-full max-w-sm">
                                <motion.button
                                    onClick={handleClaim}
                                    disabled={!status?.can_claim || isClaiming}
                                    whileHover={status?.can_claim ? { scale: 1.02 } : {}}
                                    whileTap={status?.can_claim ? { scale: 0.98 } : {}}
                                    className={`
                                        group relative w-full py-4 rounded-xl font-black text-lg uppercase tracking-wider overflow-hidden
                                        transition-all duration-300
                                        ${status?.can_claim
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)]'
                                            : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                        }
                                    `}
                                >
                                    {isClaiming ? (
                                        <span className="flex items-center justify-center gap-3">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Claiming...
                                        </span>
                                    ) : status?.can_claim ? (
                                        <span className="flex items-center justify-center gap-2 relative z-10">
                                            Claim Rewards
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:translate-x-1 transition-transform">
                                                <path d="M5 12h14M12 5l7 7-7 7" />
                                            </svg>
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                            </svg>
                                            Next Reward in {Math.ceil(status?.hours_until_reset || 0)}h
                                        </span>
                                    )}

                                    {/* Shine Effect */}
                                    {status?.can_claim && (
                                        <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] group-hover:animate-shine" />
                                    )}
                                </motion.button>
                            </div>

                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )

    return createPortal(modal, document.body)
}
