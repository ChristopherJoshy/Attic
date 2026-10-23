/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * ShopModal - Main shop interface with Cursor Royal gacha section.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * ShopModal: Main component managing the shop and spinning logic.
 * CrownIcon: Custom SVG icon for the "Cursor Royal" header.
 * CoinIcon: Custom SVG icon for coins.
 * SpinnerIcon: Custom SVG icon for the loading state.
 * playSpinTick: Synthesizes a ticking sound using Tone.js.
 * playWinSound: Synthesizes a victory sound using Tone.js.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * SPIN_COST: Cost in coins to spin the wheel (50).
 * SLOT_HEIGHT: Height of a single item slot in pixels (64).
 * VISIBLE_SLOTS: Number of slots visible at once (3).
 * SPINS_BEFORE_STOP: Minimum number of items to scroll past (50).
 * ANIMATION_DURATION: Duration of the spin animation in seconds (5).
 * 
 * --------------------------------------------------------------------------
 *                                   Imports
 * --------------------------------------------------------------------------
 * react: useState, useEffect, useMemo, useRef.
 * framer-motion: motion, AnimatePresence, useAnimation.
 * react-dom: createPortal.
 * tone: Audio synthesis for sound effects.
 * inventoryStore: Global state for user inventory and spin actions.
 * authStore: Authentication state.
 * types: Shared types like CursorInfo, SpinResult, and helpers like getRarityColor.
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { createPortal } from 'react-dom'
import * as Tone from 'tone'
import { useInventoryStore, SPIN_COST, PROFILE_SPIN_COST } from '../stores/inventoryStore'
import { useAuthStore } from '../stores/authStore'
import { getLeaderboardBonus, type LeaderboardBonus } from '../config/api'
import {
    CURSORS, EFFECTS, getRarityColor, type SpinResult, type CursorInfo, type EffectInfo,
    PROFILE_BACKGROUNDS, PROFILE_EFFECTS as PROFILE_EFFECTS_DATA, PROFILE_BORDERS,
    type ProfileSpinResult, type ProfileBackgroundInfo, type ProfileEffectInfo, type ProfileBorderInfo
} from '../types'
import GachaReveal from './GachaReveal'
import crateImg from '../assets/crate.png'

import profileCrateImg from '../assets/profile_crate.png'

const ITEM_WIDTH = 120
const VISIBLE_ITEMS = 5
const ITEMS_BEFORE_WINNER = 60
const ANIMATION_DURATION = 6

interface SpinItem {
    type: 'cursor' | 'coins' | 'effect' | 'background' | 'profile_effect' | 'border'
    cursor?: CursorInfo
    effect?: EffectInfo
    coins?: number
    background?: ProfileBackgroundInfo
    profileEffect?: ProfileEffectInfo
    border?: ProfileBorderInfo
    id: string
}

interface ShopModalProps {
    isOpen: boolean
    onClose: () => void
}

const CoinIcon = ({ size = 48 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" fill="#fbbf24" />
        <text x="24" y="31" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#000">$</text>
    </svg>
)

const EffectIcon = ({ color, size = 40 }: { color: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
)

export default function ShopModal({ isOpen, onClose }: ShopModalProps) {
    const { idToken } = useAuthStore()
    const {
        coins, fetchInventory, spin, pityActive, pityStreak, cratesOpened,
        spinProfileCrate, profilePityActive, profilePityStreak, profileCratesOpened,
        fetchProfileInventory,
    } = useInventoryStore()

    const [phase, setPhase] = useState<'crates' | 'rolling' | 'reveal'>('crates')
    const [activeRollType, setActiveRollType] = useState<'cursor' | 'profile'>('cursor')
    const [isSpinning, setIsSpinning] = useState(false)
    const [spinResult, setSpinResult] = useState<SpinResult | null>(null)
    const [profileSpinResult, setProfileSpinResult] = useState<ProfileSpinResult | null>(null)
    const [displayItems, setDisplayItems] = useState<SpinItem[]>([])
    const [showDropRates, setShowDropRates] = useState(false)
    const [showProfileDropRates, setShowProfileDropRates] = useState(false)
    const [leaderboardBonus, setLeaderboardBonus] = useState<LeaderboardBonus | null>(null)
    const [autoSpinCursor, setAutoSpinCursor] = useState(false)
    const [autoSpinProfile, setAutoSpinProfile] = useState(false)

    const controls = useAnimation()
    const tickIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastTickRef = useRef<number>(0)
    const containerRef = useRef<HTMLDivElement>(null)

    const baseItems: SpinItem[] = useMemo(() => {
        const items: SpinItem[] = []
        Object.values(CURSORS).forEach((cursor, idx) => {
            items.push({ type: 'cursor', cursor, id: `base-cursor-${idx}` })
        })
        Object.values(EFFECTS).forEach((effect, idx) => {
            items.push({ type: 'effect', effect, id: `base-effect-${idx}` })
        })
        items.push({ type: 'coins', coins: 5, id: 'base-coin-5' })
        items.push({ type: 'coins', coins: 10, id: 'base-coin-10' })
        return items
    }, [])

    const profileBaseItems: SpinItem[] = useMemo(() => {
        const items: SpinItem[] = []
        Object.values(PROFILE_BACKGROUNDS).forEach((bg, idx) => {
            items.push({ type: 'background', background: bg, id: `base-bg-${idx}` })
        })
        Object.values(PROFILE_EFFECTS_DATA).forEach((effect, idx) => {
            items.push({ type: 'profile_effect', profileEffect: effect, id: `base-peffect-${idx}` })
        })
        Object.values(PROFILE_BORDERS).forEach((border, idx) => {
            items.push({ type: 'border', border, id: `base-border-${idx}` })
        })
        return items
    }, [])

    useEffect(() => {
        if (isOpen && idToken) {
            fetchInventory(idToken)
            fetchProfileInventory(idToken)
            // Fetch leaderboard bonus for price display
            getLeaderboardBonus(idToken).then(setLeaderboardBonus).catch(console.error)
        }
    }, [isOpen, idToken, fetchInventory, fetchProfileInventory])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape' && !isSpinning) onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose, isSpinning])

    // Sound Helpers
    const playTickSound = () => {
        const now = Tone.now()
        if (now - lastTickRef.current < 0.03) return
        lastTickRef.current = now

        const synth = new Tone.MembraneSynth({
            pitchDecay: 0.02,
            octaves: 1,
            volume: -18,
            envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }
        }).toDestination()
        synth.triggerAttackRelease("C3", "64n")
    }

    const playWinSound = (rarity: string = 'common') => {
        const now = Tone.now()
        const synth = new Tone.PolySynth(Tone.Synth).toDestination()

        if (rarity === 'mythical' || rarity === 'divine') {
            synth.volume.value = -3
            synth.triggerAttackRelease(["C3", "E3", "G3", "B3"], "4n", now)
            synth.triggerAttackRelease(["E3", "G3", "B3", "D4"], "4n", now + 0.15)
            synth.triggerAttackRelease(["G3", "B3", "D4", "F#4"], "4n", now + 0.3)
            synth.triggerAttackRelease(["B3", "D4", "F#4", "A4"], "2n", now + 0.45)

            const sparkle = new Tone.PluckSynth().toDestination()
            sparkle.volume.value = -8
            sparkle.triggerAttackRelease("A5", now + 0.6)
            sparkle.triggerAttackRelease("C6", now + 0.7)
            sparkle.triggerAttackRelease("E6", now + 0.8)
        } else if (rarity === 'legendary' || rarity === 'ultra') {
            synth.volume.value = -5
            synth.triggerAttackRelease(["D4", "F#4", "A4", "D5"], "8n", now)
            synth.triggerAttackRelease(["D4", "A4", "D5", "F#5"], "8n", now + 0.15)
            synth.triggerAttackRelease(["D4", "D5", "F#5", "A5"], "2n", now + 0.3)
        } else if (rarity === 'epic') {
            synth.volume.value = -8
            synth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "8n", now)
            synth.triggerAttackRelease(["E4", "G4", "C5", "E5"], "4n", now + 0.1)
        } else {
            synth.volume.value = -10
            synth.triggerAttackRelease(["C4", "E4", "G4"], "4n", now)
        }
    }

    // Handle Animation Phase
    useEffect(() => {
        if (phase === 'rolling') {
            const animate = async () => {
                // Allow a frame for the ROLLING view to render so containerRef is valid
                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            resolve()
                        })
                    })
                })

                // Reset controller
                await controls.set({ x: 0 })

                // Calculate target position dynamically based on container width
                const containerWidth = containerRef.current?.offsetWidth || (ITEM_WIDTH * VISIBLE_ITEMS)
                const centerOffset = containerWidth / 2 - ITEM_WIDTH / 2
                const targetX = -(ITEMS_BEFORE_WINNER * ITEM_WIDTH) + centerOffset

                // Start tick sounds
                let tickCount = 0
                const maxTicks = 80
                const scheduleNextTick = () => {
                    playTickSound()
                    tickCount++
                    const progress = tickCount / maxTicks
                    const nextDelay = 30 + (200 * Math.pow(progress, 2))
                    if (tickCount < maxTicks) {
                        tickIntervalRef.current = setTimeout(scheduleNextTick, nextDelay)
                    }
                }
                scheduleNextTick()

                // Start roll animation
                await controls.start({
                    x: targetX,
                    transition: {
                        duration: ANIMATION_DURATION,
                        ease: [0.15, 0.85, 0.35, 1.0]
                    }
                })

                // Animation Complete
                if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current)

                // Play Win Sound
                const winningItem = displayItems[ITEMS_BEFORE_WINNER]
                if (winningItem) {
                    playWinSound(
                        winningItem.cursor?.rarity ||
                        winningItem.effect?.rarity ||
                        winningItem.background?.rarity ||
                        winningItem.profileEffect?.rarity ||
                        winningItem.border?.rarity ||
                        'common'
                    )
                }

                setPhase('reveal')
                setIsSpinning(false)

                // Refresh Inventory Data
                if (idToken) {
                    fetchInventory(idToken)
                    if (activeRollType === 'profile') {
                        fetchProfileInventory(idToken)
                    }
                }
            }
            animate()
        }
    }, [phase, controls, displayItems, activeRollType, idToken, fetchInventory, fetchProfileInventory, playTickSound, playWinSound, containerRef])

    useEffect(() => {
        if (!isOpen) {
            setPhase('crates')
            setSpinResult(null)
            setIsSpinning(false)
            setAutoSpinCursor(false)
            setAutoSpinProfile(false)
            controls.stop()
            if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current)
        }
    }, [isOpen, controls])



    const handleOpenCrate = async () => {
        const cost = leaderboardBonus?.gachaDiscountedCost ?? SPIN_COST
        if (!idToken || coins < cost || isSpinning) return

        // Ensure audio context is ready
        Tone.start().catch(() => { })

        setIsSpinning(true)
        if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current)

        try {
            // FIRST: Get the result from the API
            const result = await spin(idToken, cost)

            if (!result) {
                setIsSpinning(false)
                setPhase('crates')
                return
            }

            setSpinResult(result)
            setActiveRollType('cursor')

            // SECOND: Determine the winning item
            let winningItem: SpinItem | undefined

            if (result.type === 'cursor' && result.cursorId) {
                const cursorInfo = CURSORS[result.cursorId]
                if (cursorInfo) {
                    winningItem = { type: 'cursor', cursor: cursorInfo, id: `winner-${Date.now()}` }
                }
            } else if (result.type === 'effect' && result.effectId) {
                const effectInfo = EFFECTS[result.effectId]
                if (effectInfo) {
                    winningItem = { type: 'effect', effect: effectInfo, id: `winner-${Date.now()}` }
                }
            } else if (result.type === 'coins' && result.coinsWon === 5) {
                winningItem = { type: 'coins', coins: 5, id: `winner-${Date.now()}` }
            } else if (result.type === 'coins' && result.coinsWon === 10) {
                winningItem = { type: 'coins', coins: 10, id: `winner-${Date.now()}` }
            } else if (result.type === 'nothing') {
                winningItem = { type: 'coins', coins: 0, id: `winner-nothing-${Date.now()}` }
            }

            // Fallback
            if (!winningItem) {
                winningItem = { ...baseItems[0], id: `winner-fallback-${Date.now()}` }
            }

            // THIRD: Generate items with the winner ALREADY in place at position ITEMS_BEFORE_WINNER
            const items: SpinItem[] = []
            for (let i = 0; i < ITEMS_BEFORE_WINNER + 10; i++) {
                if (i === ITEMS_BEFORE_WINNER) {
                    // Place the winning item at the target position
                    items.push(winningItem)
                } else {
                    const randomBase = baseItems[Math.floor(Math.random() * baseItems.length)]
                    items.push({ ...randomBase, id: `roll-${Date.now()}-${i}` })
                }
            }

            // FOURTH: Set items and show rolling phase
            setDisplayItems(items)
            setPhase('rolling')



        } catch (error) {
            console.error("Spin failed", error)
            setIsSpinning(false)
            setPhase('crates')
        }
    }

    const handleOpenProfileCrate = async () => {
        const cost = leaderboardBonus?.profileDiscountedCost ?? PROFILE_SPIN_COST
        if (!idToken || coins < cost || isSpinning) return

        setIsSpinning(true)
        if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current)

        try {
            // FIRST: Get the result from the API
            const result = await spinProfileCrate(idToken, cost)
            if (!result) {
                setIsSpinning(false)
                setPhase('crates')
                return
            }

            setProfileSpinResult(result)
            setActiveRollType('profile')

            // SECOND: Determine the winning item
            let winningItem: SpinItem | undefined

            if (result.type === 'background' && result.itemId) {
                const bgInfo = PROFILE_BACKGROUNDS[result.itemId as keyof typeof PROFILE_BACKGROUNDS]
                if (bgInfo) {
                    winningItem = { type: 'background', background: bgInfo, id: `profile-winner-${Date.now()}` }
                }
            } else if (result.type === 'profile_effect' && result.itemId) {
                const effectInfo = PROFILE_EFFECTS_DATA[result.itemId]
                if (effectInfo) {
                    winningItem = { type: 'profile_effect', profileEffect: effectInfo, id: `profile-winner-${Date.now()}` }
                }
            } else if (result.type === 'border' && result.itemId) {
                const borderInfo = PROFILE_BORDERS[result.itemId]
                if (borderInfo) {
                    winningItem = { type: 'border', border: borderInfo, id: `profile-winner-${Date.now()}` }
                }
            } else if (result.type === 'nothing') {
                if (profileBaseItems.length > 0) {
                    winningItem = { ...profileBaseItems[0], id: `profile-nothing-${Date.now()}` }
                }
            }

            if (!winningItem && profileBaseItems.length > 0) {
                winningItem = { ...profileBaseItems[0], id: `profile-fallback-${Date.now()}` }
            }

            if (!winningItem) throw new Error("No winning item found")

            // THIRD: Generate items with the winner ALREADY in place at position ITEMS_BEFORE_WINNER
            const items: SpinItem[] = []
            for (let i = 0; i < ITEMS_BEFORE_WINNER + 10; i++) {
                if (i === ITEMS_BEFORE_WINNER) {
                    // Place the winning item at the target position
                    items.push(winningItem)
                } else if (profileBaseItems.length > 0) {
                    const randomBase = profileBaseItems[Math.floor(Math.random() * profileBaseItems.length)]
                    items.push({ ...randomBase, id: `profile-roll-${Date.now()}-${i}` })
                }
            }

            // FOURTH: Set items and show rolling phase
            setDisplayItems(items)
            setPhase('rolling')



        } catch (error) {
            console.error("Profile spin failed", error)
            setIsSpinning(false)
            setPhase('crates')
        }
    }

    const calculateBoostedRate = (baseRateStr: string, bonusPercent: number = 0) => {
        if (!bonusPercent) return baseRateStr
        const baseRate = parseFloat(baseRateStr.replace('%', ''))
        const boostedRate = baseRate * (1 + bonusPercent / 100)

        // Handle decimals intelligently
        if (boostedRate < 0.01) return boostedRate.toFixed(4) + '%'
        if (boostedRate < 0.1) return boostedRate.toFixed(3) + '%'
        if (boostedRate < 1) return boostedRate.toFixed(2) + '%'
        if (boostedRate % 1 === 0) return boostedRate.toFixed(0) + '%'
        return boostedRate.toFixed(1) + '%'
    }

    const getItemRarity = () => {
        if (!spinResult) return 'common'
        if (spinResult.type === 'cursor' && spinResult.cursorInfo) return spinResult.cursorInfo.rarity
        if (spinResult.type === 'effect' && spinResult.effectInfo) return spinResult.effectInfo.rarity
        return 'common'
    }

    const modal = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                    onClick={() => phase === 'crates' && onClose()}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#0a0a0a] border border-white/10"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-white/10 bg-[#0f0f0f]">
                            <div className="flex items-center gap-2 md:gap-3">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400 md:w-6 md:h-6">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                </svg>
                                <h2 className="text-base md:text-lg font-bold text-white">Crates</h2>
                                {/* OPENED counter - desktop only, inline with title */}
                                <span className="hidden md:inline text-[10px] text-white/40 font-mono ml-2">
                                    OPENED: <span className="text-white/80">{cratesOpened}</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2 md:gap-4">
                                <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-white/5 border border-white/10">
                                    <span className="text-yellow-400 text-xs md:text-sm font-bold">{coins}</span>
                                    <span className="text-white/40 text-[10px] md:text-xs">coins</span>
                                </div>
                                <button onClick={onClose} className="p-1 text-white/40 hover:text-white transition-colors">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="md:w-5 md:h-5">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Phase: Crates */}
                        {phase === 'crates' && (
                            <div className="p-4 md:p-8">
                                {/* Always 2 columns - compact on mobile, larger on desktop */}
                                <div className="grid grid-cols-2 gap-3 md:gap-6">

                                    {/* ==================== ALL IN ONE CRATE ==================== */}
                                    <motion.div
                                        whileHover={{ y: -5 }}
                                        className="relative group flex flex-col justify-between rounded-xl md:rounded-2xl bg-[#141414] border border-white/10 overflow-hidden"
                                    >
                                        {/* Subtle Static Background */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-[#0a0a0a]" />

                                        {/* Content Container */}
                                        <div className="relative z-10 p-3 md:p-6 flex flex-col h-full">

                                            {/* Header Section */}
                                            <div className="flex justify-between items-start mb-2 md:mb-6">
                                                <div className="flex flex-col">
                                                    <h3 className="text-sm md:text-xl font-bold text-white uppercase tracking-wider">
                                                        Start Crate
                                                    </h3>
                                                    <p className="text-[8px] md:text-xs font-semibold text-white/50 uppercase tracking-wider mt-0.5 md:mt-1">Cursors & Effects</p>
                                                </div>
                                                <div className="px-1.5 md:px-2 py-0.5 md:py-1 rounded bg-white/10 border border-white/5 hidden md:block">
                                                    <span className="text-[8px] md:text-[10px] font-bold text-purple-200 uppercase tracking-wider">Series 1</span>
                                                </div>
                                            </div>

                                            {/* Centerpiece Image - Static */}
                                            <div className="flex-1 flex items-center justify-center py-2 md:py-4 mb-2 md:mb-6 relative">
                                                <div className="absolute inset-0 bg-purple-500/5 blur-[40px] rounded-full" />
                                                <img
                                                    src={crateImg}
                                                    alt="Crate"
                                                    className="w-20 h-20 md:w-40 md:h-40 object-contain z-10 drop-shadow-2xl"
                                                />
                                                {/* Text Badge instead of floating element - hidden on mobile */}
                                                <div className="absolute top-0 right-0 py-0.5 md:py-1 px-1.5 md:px-3 bg-red-500/10 border border-red-500/20 rounded-full z-20">
                                                    <span className="text-[6px] md:text-[10px] font-bold text-red-400 uppercase tracking-widest">Popular</span>
                                                </div>
                                            </div>

                                            {/* Pity Meter */}
                                            <div className="mb-2 md:mb-6 space-y-1 md:space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest">Luck</span>
                                                    <span className={`text-[8px] md:text-[10px] font-bold uppercase tracking-wider ${pityActive ? 'text-yellow-400' : 'text-white/40'}`}>
                                                        {pityActive ? 'MAX' : `${pityStreak}/5`}
                                                    </span>
                                                </div>
                                                <div className="flex gap-0.5 md:gap-1 h-1.5 md:h-2">
                                                    {[...Array(5)].map((_, i) => (
                                                        <div key={i} className="flex-1 rounded-sm bg-white/5 overflow-hidden relative">
                                                            <div
                                                                className={`absolute inset-0 ${pityStreak > i || pityActive
                                                                    ? 'bg-purple-500'
                                                                    : ''
                                                                    }`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Action Area */}
                                            <div className="mt-auto space-y-2 md:space-y-3">
                                                {/* Leaderboard/Bonus Info - hidden on mobile */}
                                                {leaderboardBonus?.isTopPlayer && (
                                                    <div className="hidden md:flex gap-2 justify-center mb-2">
                                                        <div className="px-2 py-0.5 rounded bg-yellow-400/10 text-[10px] text-yellow-400 font-bold border border-yellow-400/20">
                                                            -{leaderboardBonus.coinReductionPercent}% Cost
                                                        </div>
                                                        <div className="px-2 py-0.5 rounded bg-emerald-400/10 text-[10px] text-emerald-400 font-bold border border-emerald-400/20">
                                                            +{leaderboardBonus.luckBonusPercent}% Luck
                                                        </div>
                                                    </div>
                                                )}

                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={handleOpenCrate}
                                                    disabled={coins < (leaderboardBonus?.gachaDiscountedCost ?? SPIN_COST) || isSpinning}
                                                    className={`
                                                        w-full overflow-hidden rounded-md md:rounded-lg font-bold uppercase tracking-widest text-xs md:text-sm shadow-xl transition-all
                                                        ${coins >= (leaderboardBonus?.gachaDiscountedCost ?? SPIN_COST) && !isSpinning
                                                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:brightness-110'
                                                            : 'bg-white/5 text-white/20 cursor-not-allowed'
                                                        }
                                                    `}
                                                >
                                                    <div className="py-2 md:py-4 flex flex-col items-center justify-center">
                                                        {isSpinning ? (
                                                            <div className="h-4 w-4 md:h-5 md:w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        ) : (
                                                            <>
                                                                <span className="text-[10px] md:text-sm mb-0.5">Spin</span>
                                                                <div className="flex items-center gap-1 text-[8px] md:text-[10px] text-white/80">
                                                                    {leaderboardBonus?.isTopPlayer ? (
                                                                        <>
                                                                            <span className="line-through opacity-50">{leaderboardBonus.gachaOriginalCost}</span>
                                                                            <span className="text-yellow-300 font-bold">{leaderboardBonus.gachaDiscountedCost}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span>{SPIN_COST}</span>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.button>

                                                {/* Auto and Info buttons - hidden on mobile */}
                                                <div className="hidden md:flex items-center justify-between gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAutoSpinCursor(!autoSpinCursor) }}
                                                        className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border ${autoSpinCursor
                                                            ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                                                            : 'bg-transparent border-white/5 text-white/30 hover:bg-white/5 hover:text-white/50'
                                                            }`}
                                                    >
                                                        {autoSpinCursor ? 'Auto: ON' : 'Enable Auto'}
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShowDropRates(!showDropRates) }}
                                                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/5 text-white/30 hover:bg-white/5 hover:text-white transition-colors"
                                                        title="View Drop Rates"
                                                    >
                                                        <span className="font-serif italic font-bold">i</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* ==================== PROFILE CRATE ==================== */}
                                    <motion.div
                                        whileHover={{ y: -5 }}
                                        className="relative group flex flex-col justify-between rounded-xl md:rounded-2xl bg-[#141414] border border-white/10 overflow-hidden"
                                    >
                                        {/* Subtle Static Background */}
                                        <div className="absolute inset-0 bg-gradient-to-bl from-cyan-900/10 to-[#0a0a0a]" />

                                        {/* Content Container */}
                                        <div className="relative z-10 p-3 md:p-6 flex flex-col h-full">

                                            {/* Header Section */}
                                            <div className="flex justify-between items-start mb-2 md:mb-6">
                                                <div className="flex flex-col">
                                                    <h3 className="text-sm md:text-xl font-bold text-white uppercase tracking-wider">
                                                        Profile Kit
                                                    </h3>
                                                    <p className="text-[8px] md:text-xs font-semibold text-white/50 uppercase tracking-wider mt-0.5 md:mt-1">Banners & Borders</p>
                                                </div>
                                                <div className="px-1.5 md:px-2 py-0.5 md:py-1 rounded bg-white/10 border border-white/5 hidden md:block">
                                                    <span className="text-[8px] md:text-[10px] font-bold text-cyan-200 uppercase tracking-wider">Cosmetics</span>
                                                </div>
                                            </div>

                                            {/* Centerpiece Image - Static */}
                                            <div className="flex-1 flex items-center justify-center py-2 md:py-4 mb-2 md:mb-6 relative">
                                                <div className="absolute inset-0 bg-cyan-500/5 blur-[40px] rounded-full" />
                                                <img
                                                    src={profileCrateImg}
                                                    alt="Profile Crate"
                                                    className="w-20 h-20 md:w-40 md:h-40 object-contain z-10 drop-shadow-2xl"
                                                />
                                                {/* Text Badge */}
                                                <div className="absolute top-0 left-0 py-0.5 md:py-1 px-1.5 md:px-3 bg-blue-500/10 border border-blue-500/20 rounded-full z-20">
                                                    <span className="text-[6px] md:text-[10px] font-bold text-blue-400 uppercase tracking-widest">Exclusive</span>
                                                </div>
                                            </div>

                                            {/* Pity Meter */}
                                            <div className="mb-2 md:mb-6 space-y-1 md:space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest">Luck</span>
                                                    <span className={`text-[8px] md:text-[10px] font-bold uppercase tracking-wider ${profilePityActive ? 'text-cyan-400' : 'text-white/40'}`}>
                                                        {profilePityActive ? 'MAX' : `${profilePityStreak}/7`}
                                                    </span>
                                                </div>
                                                <div className="flex gap-0.5 md:gap-1 h-1.5 md:h-2">
                                                    {[...Array(7)].map((_, i) => (
                                                        <div key={i} className="flex-1 rounded-sm bg-white/5 overflow-hidden relative">
                                                            <div
                                                                className={`absolute inset-0 ${profilePityStreak > i || profilePityActive
                                                                    ? 'bg-cyan-500'
                                                                    : ''
                                                                    }`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Action Area */}
                                            <div className="mt-auto space-y-2 md:space-y-3">
                                                {/* Leaderboard/Bonus Info - hidden on mobile */}
                                                {leaderboardBonus?.isTopPlayer && (
                                                    <div className="hidden md:flex gap-2 justify-center mb-2">
                                                        <div className="px-2 py-0.5 rounded bg-yellow-400/10 text-[10px] text-yellow-400 font-bold border border-yellow-400/20">
                                                            -{leaderboardBonus.coinReductionPercent}% Cost
                                                        </div>
                                                        <div className="px-2 py-0.5 rounded bg-emerald-400/10 text-[10px] text-emerald-400 font-bold border border-emerald-400/20">
                                                            +{leaderboardBonus.luckBonusPercent}% Luck
                                                        </div>
                                                    </div>
                                                )}

                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={handleOpenProfileCrate}
                                                    disabled={coins < (leaderboardBonus?.profileDiscountedCost ?? PROFILE_SPIN_COST) || isSpinning}
                                                    className={`
                                                        w-full overflow-hidden rounded-md md:rounded-lg font-bold uppercase tracking-widest text-xs md:text-sm shadow-xl transition-all
                                                        ${coins >= (leaderboardBonus?.profileDiscountedCost ?? PROFILE_SPIN_COST) && !isSpinning
                                                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:brightness-110'
                                                            : 'bg-white/5 text-white/20 cursor-not-allowed'
                                                        }
                                                    `}
                                                >
                                                    <div className="py-2 md:py-4 flex flex-col items-center justify-center">
                                                        {isSpinning ? (
                                                            <div className="h-4 w-4 md:h-5 md:w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        ) : (
                                                            <>
                                                                <span className="text-[10px] md:text-sm mb-0.5">Spin</span>
                                                                <div className="flex items-center gap-1 text-[8px] md:text-[10px] text-white/80">
                                                                    {leaderboardBonus?.isTopPlayer ? (
                                                                        <>
                                                                            <span className="line-through opacity-50">{leaderboardBonus.profileOriginalCost}</span>
                                                                            <span className="text-yellow-300 font-bold">{leaderboardBonus.profileDiscountedCost}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span>{PROFILE_SPIN_COST}</span>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.button>

                                                {/* Auto and Info buttons - hidden on mobile */}
                                                <div className="hidden md:flex items-center justify-between gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAutoSpinProfile(!autoSpinProfile) }}
                                                        className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border ${autoSpinProfile
                                                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                                                            : 'bg-transparent border-white/5 text-white/30 hover:bg-white/5 hover:text-white/50'
                                                            }`}
                                                    >
                                                        {autoSpinProfile ? 'Auto: ON' : 'Enable Auto'}
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShowProfileDropRates(!showProfileDropRates) }}
                                                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/5 text-white/30 hover:bg-white/5 hover:text-white transition-colors"
                                                        title="View Drop Rates"
                                                    >
                                                        <span className="font-serif italic font-bold">i</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>

                                </div>

                                {/* Shared Drop Rates Popover (Conditional Rendering) */}
                                <AnimatePresence>
                                    {(showDropRates || showProfileDropRates) && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="absolute inset-x-8 top-1/2 -translate-y-1/2 p-6 rounded-2xl bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 ring-1 ring-white/5"
                                        >
                                            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                                                <div>
                                                    <h4 className="text-xl font-bold text-white">
                                                        {showDropRates ? 'Crate Probabilities' : 'Profile Kit Odds'}
                                                    </h4>
                                                    <p className="text-xs text-white/40 mt-1">
                                                        Fair play certified. Pity system guarantees rare items over time.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => { setShowDropRates(false); setShowProfileDropRates(false); }}
                                                    className="p-2 rounded-full bg-white/5 hover:bg-white/10"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60">
                                                        <path d="M18 6L6 18M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                {(showDropRates ? [
                                                    { label: 'Better Luck Next Time', rate: '60%', color: '#ef4444' },
                                                    { label: 'Common Item', rate: '20%', color: getRarityColor('common') },
                                                    { label: 'Common Effect', rate: '8%', color: getRarityColor('common') },
                                                    { label: 'Uncommon Item', rate: '5%', color: getRarityColor('uncommon') },
                                                    { label: 'Rare Item', rate: '3%', color: getRarityColor('rare') },
                                                    { label: 'Epic Item', rate: '2%', color: getRarityColor('epic') },
                                                    { label: 'Legendary', rate: '1%', color: getRarityColor('legendary') },
                                                    { label: 'Ultra', rate: '0.5%', color: getRarityColor('ultra') },
                                                    { label: 'Divine', rate: '0.15%', color: getRarityColor('divine') },
                                                    { label: 'Myhtical', rate: '0.001%', color: getRarityColor('mythical') },
                                                ] : [
                                                    { label: 'Better Luck Next Time', rate: '65%', color: '#ef4444' },
                                                    { label: 'Common Background', rate: '10%', color: getRarityColor('common') },
                                                    { label: 'Common Effect', rate: '12%', color: getRarityColor('common') },
                                                    { label: 'Common Border', rate: '8%', color: getRarityColor('common') },
                                                    { label: 'Uncommon', rate: '2%', color: getRarityColor('uncommon') },
                                                    { label: 'Rare', rate: '0.8%', color: getRarityColor('rare') },
                                                    { label: 'Epic', rate: '0.3%', color: getRarityColor('epic') },
                                                    { label: 'Legendary', rate: '0.1%', color: getRarityColor('legendary') },
                                                    { label: 'Mythical', rate: '0.01%', color: getRarityColor('mythical') },
                                                ]).map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                                        <span className="text-sm font-medium" style={{ color: item.color }}>{item.label}</span>
                                                        <span className="font-mono text-sm text-white/50">{item.rate}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}{/* Phase: Rolling */}
                        {
                            phase === 'rolling' && (
                                <div className="py-8">
                                    {/* Center Marker */}
                                    <div className="relative">
                                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[3px] bg-yellow-400 z-20 shadow-lg shadow-yellow-400/50" />
                                        <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-yellow-400 z-20" />
                                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-yellow-400 z-20" />

                                        {/* Rolling Strip */}
                                        <div ref={containerRef} className="relative overflow-hidden mx-auto rounded-lg bg-[#111] border border-white/10" style={{ maxWidth: ITEM_WIDTH * VISIBLE_ITEMS, width: '100%' }}>
                                            {/* Edge fades */}
                                            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#111] to-transparent z-10 pointer-events-none" />
                                            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#111] to-transparent z-10 pointer-events-none" />

                                            <motion.div
                                                className="flex"
                                                animate={controls}
                                                initial={{ x: 0 }}
                                            >
                                                {displayItems.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex-shrink-0 flex flex-col items-center justify-center p-2 border-r border-white/5"
                                                        style={{ width: ITEM_WIDTH, height: 120 }}
                                                    >
                                                        {item.type === 'cursor' && item.cursor ? (
                                                            <>
                                                                <div
                                                                    className="w-2 h-12 rounded-full mb-2"
                                                                    style={{
                                                                        backgroundColor: item.cursor.color === 'rainbow' ? '#ec4899' : item.cursor.color,
                                                                        boxShadow: `0 0 16px ${item.cursor.glow}`,
                                                                    }}
                                                                />
                                                                <span className="text-[10px] text-white/60 text-center truncate w-full px-1">{item.cursor.name}</span>
                                                                <span className="text-[8px] uppercase mt-0.5" style={{ color: getRarityColor(item.cursor.rarity) }}>
                                                                    {item.cursor.rarity}
                                                                </span>
                                                            </>
                                                        ) : item.type === 'effect' && item.effect ? (
                                                            <>
                                                                <EffectIcon color={item.effect.color} size={40} />
                                                                <span className="text-[10px] text-white/60 text-center truncate w-full px-1 mt-1">{item.effect.name}</span>
                                                                <span className="text-[8px] uppercase mt-0.5" style={{ color: getRarityColor(item.effect.rarity) }}>
                                                                    {item.effect.rarity}
                                                                </span>
                                                            </>
                                                        ) : item.type === 'background' && item.background ? (
                                                            <>
                                                                <div
                                                                    className="w-16 h-10 rounded overflow-hidden mb-1"
                                                                    style={{ backgroundColor: `${getRarityColor(item.background.rarity)}20` }}
                                                                >
                                                                    <img
                                                                        src={item.background.path}
                                                                        alt={item.background.name}
                                                                        className="w-full h-full object-cover"
                                                                        loading="lazy"
                                                                        decoding="async"
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-white/60 text-center truncate w-full px-1">{item.background.name}</span>
                                                                <span className="text-[8px] uppercase mt-0.5" style={{ color: getRarityColor(item.background.rarity) }}>
                                                                    {item.background.rarity}
                                                                </span>
                                                            </>
                                                        ) : item.type === 'profile_effect' && item.profileEffect ? (
                                                            <>
                                                                <div
                                                                    className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
                                                                    style={{ backgroundColor: `${item.profileEffect.color}20`, border: `2px solid ${item.profileEffect.color}` }}
                                                                >
                                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={item.profileEffect.color} strokeWidth="2">
                                                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                                    </svg>
                                                                </div>
                                                                <span className="text-[10px] text-white/60 text-center truncate w-full px-1">{item.profileEffect.name}</span>
                                                                <span className="text-[8px] uppercase mt-0.5" style={{ color: getRarityColor(item.profileEffect.rarity) }}>
                                                                    {item.profileEffect.rarity}
                                                                </span>
                                                            </>
                                                        ) : item.type === 'border' && item.border ? (
                                                            <>
                                                                <div
                                                                    className="w-10 h-10 rounded-full mb-1"
                                                                    style={{
                                                                        border: `${item.border.width}px ${item.border.style === 'gradient' ? 'solid' : item.border.style} ${item.border.color || '#22d3ee'}`,
                                                                        background: item.border.style === 'gradient' && item.border.colors ?
                                                                            `linear-gradient(45deg, ${item.border.colors.join(', ')})` : 'transparent'
                                                                    }}
                                                                />
                                                                <span className="text-[10px] text-white/60 text-center truncate w-full px-1">{item.border.name}</span>
                                                                <span className="text-[8px] uppercase mt-0.5" style={{ color: getRarityColor(item.border.rarity) }}>
                                                                    {item.border.rarity}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CoinIcon size={40} />
                                                                <span className="text-[10px] text-yellow-400 font-bold mt-1">+{item.coins}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </motion.div>
                                        </div>
                                    </div>
                                </div>
                            )
                        }

                        {/* Phase: Reveal */}
                        {
                            phase === 'reveal' && (spinResult || profileSpinResult) && (
                                <div className="relative">
                                    {/* Rarity-colored header bar */}
                                    <div
                                        className="py-3 text-center font-bold text-white"
                                        style={{
                                            backgroundColor: getRarityColor(
                                                activeRollType === 'cursor'
                                                    ? getItemRarity()
                                                    : (profileSpinResult?.backgroundInfo?.rarity || profileSpinResult?.effectInfo?.rarity || profileSpinResult?.borderInfo?.rarity || 'common')
                                            )
                                        }}
                                    >
                                        {activeRollType === 'cursor' ? (
                                            <>
                                                {spinResult?.type === 'cursor' && spinResult.cursorInfo?.name}
                                                {spinResult?.type === 'effect' && spinResult.effectInfo?.name}
                                                {spinResult?.type === 'coins' && `+${spinResult.coinsWon} Coins`}
                                                {spinResult?.type === 'nothing' && 'Better Luck Next Time!'}
                                            </>
                                        ) : (
                                            <>
                                                {profileSpinResult?.type === 'background' && profileSpinResult.backgroundInfo?.name}
                                                {profileSpinResult?.type === 'profile_effect' && profileSpinResult.effectInfo?.name}
                                                {profileSpinResult?.type === 'border' && profileSpinResult.borderInfo?.name}
                                                {profileSpinResult?.type === 'nothing' && 'Better Luck Next Time!'}
                                            </>
                                        )}
                                    </div>

                                    {/* Item Showcase */}
                                    <div className="py-12 px-8 flex flex-col items-center">
                                        {/* Item Display */}
                                        <div className="flex items-center justify-center relative w-full h-40 mb-6">
                                            <GachaReveal isVisible={true} rarity={
                                                activeRollType === 'cursor'
                                                    ? getItemRarity()
                                                    : (profileSpinResult?.backgroundInfo?.rarity || profileSpinResult?.effectInfo?.rarity || profileSpinResult?.borderInfo?.rarity || 'common')
                                            }>
                                                {activeRollType === 'cursor' ? (
                                                    // Cursor/Effect crate reveal
                                                    spinResult?.type === 'cursor' && spinResult.cursorInfo ? (
                                                        <div className="relative">
                                                            <div
                                                                className="absolute inset-0 blur-3xl opacity-40"
                                                                style={{ backgroundColor: spinResult.cursorInfo.color }}
                                                            />
                                                            <motion.div
                                                                animate={{ scale: [1, 1.05, 1] }}
                                                                transition={{ duration: 2, repeat: Infinity }}
                                                                className="relative w-4 h-32 rounded-full"
                                                                style={{
                                                                    backgroundColor: spinResult.cursorInfo.color === 'rainbow' ? '#ec4899' : spinResult.cursorInfo.color,
                                                                    boxShadow: `0 0 40px ${spinResult.cursorInfo.glow}`,
                                                                }}
                                                            />
                                                        </div>
                                                    ) : spinResult?.type === 'effect' && spinResult.effectInfo ? (
                                                        <motion.div
                                                            animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
                                                            transition={{ duration: 2, repeat: Infinity }}
                                                        >
                                                            <EffectIcon color={spinResult.effectInfo.color} size={80} />
                                                        </motion.div>
                                                    ) : spinResult?.type === 'nothing' ? (
                                                        <motion.div
                                                            animate={{ x: [-5, 5, -5, 5, 0] }}
                                                            transition={{ duration: 0.5, repeat: 2 }}
                                                            className="flex flex-col items-center"
                                                        >
                                                            <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
                                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                                                    <circle cx="12" cy="12" r="10" />
                                                                    <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                                                                    <line x1="9" y1="9" x2="9.01" y2="9" />
                                                                    <line x1="15" y1="9" x2="15.01" y2="9" />
                                                                </svg>
                                                            </div>
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div
                                                            animate={{ rotate: [0, 10, -10, 0] }}
                                                            transition={{ duration: 1.5, repeat: Infinity }}
                                                        >
                                                            <CoinIcon size={80} />
                                                        </motion.div>
                                                    )
                                                ) : (
                                                    // Profile crate reveal
                                                    profileSpinResult?.type === 'background' && profileSpinResult.backgroundInfo ? (
                                                        <motion.div
                                                            animate={{ scale: [1, 1.02, 1] }}
                                                            transition={{ duration: 2, repeat: Infinity }}
                                                            className="w-48 h-28 rounded-xl overflow-hidden shadow-2xl"
                                                        >
                                                            <img
                                                                src={profileSpinResult.backgroundInfo.path}
                                                                alt={profileSpinResult.backgroundInfo.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </motion.div>
                                                    ) : profileSpinResult?.type === 'profile_effect' && profileSpinResult.effectInfo ? (
                                                        <motion.div
                                                            animate={{ rotate: [0, 360] }}
                                                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                                            className="w-24 h-24 rounded-full flex items-center justify-center"
                                                            style={{
                                                                backgroundColor: `${profileSpinResult.effectInfo.color}30`,
                                                                border: `3px solid ${profileSpinResult.effectInfo.color}`,
                                                                boxShadow: `0 0 30px ${profileSpinResult.effectInfo.color}50`
                                                            }}
                                                        >
                                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={profileSpinResult.effectInfo.color} strokeWidth="2">
                                                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                            </svg>
                                                        </motion.div>
                                                    ) : profileSpinResult?.type === 'border' && profileSpinResult.borderInfo ? (
                                                        <motion.div
                                                            animate={{ scale: [1, 1.1, 1] }}
                                                            transition={{ duration: 1.5, repeat: Infinity }}
                                                            className="w-24 h-24 rounded-full"
                                                            style={{
                                                                border: `${profileSpinResult.borderInfo.width * 2}px ${profileSpinResult.borderInfo.style === 'gradient' ? 'solid' : profileSpinResult.borderInfo.style} ${profileSpinResult.borderInfo.color || '#22d3ee'}`,
                                                                boxShadow: `0 0 30px ${profileSpinResult.borderInfo.color || '#22d3ee'}50`
                                                            }}
                                                        />
                                                    ) : profileSpinResult?.type === 'nothing' ? (
                                                        <motion.div
                                                            animate={{ x: [-5, 5, -5, 5, 0] }}
                                                            transition={{ duration: 0.5, repeat: 2 }}
                                                            className="flex flex-col items-center"
                                                        >
                                                            <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
                                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                                                    <circle cx="12" cy="12" r="10" />
                                                                    <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                                                                    <line x1="9" y1="9" x2="9.01" y2="9" />
                                                                    <line x1="15" y1="9" x2="15.01" y2="9" />
                                                                </svg>
                                                            </div>
                                                        </motion.div>
                                                    ) : null
                                                )}
                                            </GachaReveal>
                                        </div>

                                        {/* Item Name and Rarity */}
                                        <div className="text-center mb-6">
                                            <h3 className="text-2xl font-bold text-white mb-3">
                                                {activeRollType === 'cursor' ? (
                                                    <>
                                                        {spinResult?.type === 'cursor' && spinResult.cursorInfo?.name}
                                                        {spinResult?.type === 'effect' && spinResult.effectInfo?.name}
                                                        {spinResult?.type === 'coins' && `${spinResult.coinsWon} Coins`}
                                                        {spinResult?.type === 'nothing' && 'Try Again!'}
                                                    </>
                                                ) : (
                                                    <>
                                                        {profileSpinResult?.type === 'background' && profileSpinResult.backgroundInfo?.name}
                                                        {profileSpinResult?.type === 'profile_effect' && profileSpinResult.effectInfo?.name}
                                                        {profileSpinResult?.type === 'border' && profileSpinResult.borderInfo?.name}
                                                        {profileSpinResult?.type === 'nothing' && 'Try Again!'}
                                                    </>
                                                )}
                                            </h3>
                                            <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
                                                <span
                                                    className="text-xs font-bold uppercase tracking-wider"
                                                    style={{
                                                        color: getRarityColor(
                                                            activeRollType === 'cursor'
                                                                ? getItemRarity()
                                                                : (profileSpinResult?.backgroundInfo?.rarity || profileSpinResult?.effectInfo?.rarity || profileSpinResult?.borderInfo?.rarity || 'common')
                                                        )
                                                    }}
                                                >
                                                    {activeRollType === 'cursor'
                                                        ? getItemRarity()
                                                        : (profileSpinResult?.backgroundInfo?.rarity || profileSpinResult?.effectInfo?.rarity || profileSpinResult?.borderInfo?.rarity || 'common')}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Text and Button */}
                                        <div className="text-center">
                                            <p className="text-white/60 text-sm mb-6">
                                                {(activeRollType === 'cursor' ? spinResult?.isNew : profileSpinResult?.isNew)
                                                    ? "You unlocked a new item!"
                                                    : "You got a duplicate item (Coins refunded)"}
                                            </p>

                                            {/* Auto Spin Progress Indicator */}
                                            {((activeRollType === 'cursor' && autoSpinCursor) || (activeRollType === 'profile' && autoSpinProfile)) && (
                                                <div className="mb-4">
                                                    <motion.div
                                                        className="h-1 bg-white/10 rounded-full overflow-hidden w-32 mx-auto"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                    >
                                                        <motion.div
                                                            className={`h-full ${activeRollType === 'cursor' ? 'bg-purple-500' : 'bg-cyan-500'}`}
                                                            initial={{ width: '0%' }}
                                                            animate={{ width: '100%' }}
                                                            transition={{ duration: 1.5, ease: 'linear' }}
                                                            onAnimationComplete={() => {
                                                                const cost = activeRollType === 'cursor'
                                                                    ? (leaderboardBonus?.gachaDiscountedCost ?? SPIN_COST)
                                                                    : (leaderboardBonus?.profileDiscountedCost ?? PROFILE_SPIN_COST)

                                                                // Seamless auto-spin: check coins and trigger next spin immediately
                                                                // without going back to 'crates' phase
                                                                if (coins >= cost) {
                                                                    if (activeRollType === 'cursor') {
                                                                        handleOpenCrate()
                                                                    } else {
                                                                        handleOpenProfileCrate()
                                                                    }
                                                                } else {
                                                                    // Not enough coins, disable auto spin and return to crates
                                                                    if (activeRollType === 'cursor') {
                                                                        setAutoSpinCursor(false)
                                                                    } else {
                                                                        setAutoSpinProfile(false)
                                                                    }
                                                                    setPhase('crates')
                                                                }
                                                            }}
                                                        />
                                                    </motion.div>
                                                    <span className="text-[10px] text-white/40 mt-2 inline-block">Auto spinning...</span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-center gap-3">
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => {
                                                        setPhase('crates')
                                                        setActiveRollType('cursor')
                                                        // Disable auto spin on manual continue
                                                        if (activeRollType === 'cursor') setAutoSpinCursor(false)
                                                        else setAutoSpinProfile(false)
                                                    }}
                                                    className="px-8 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold hover:from-emerald-400 hover:to-green-400 transition-all"
                                                >
                                                    Continue
                                                </motion.button>

                                                {/* Stop Auto Spin Button */}
                                                {((activeRollType === 'cursor' && autoSpinCursor) || (activeRollType === 'profile' && autoSpinProfile)) && (
                                                    <motion.button
                                                        initial={{ opacity: 0, scale: 0.8 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => {
                                                            if (activeRollType === 'cursor') setAutoSpinCursor(false)
                                                            else setAutoSpinProfile(false)
                                                        }}
                                                        className="px-6 py-3 rounded-lg bg-red-500/20 text-red-400 border border-red-500/50 font-bold hover:bg-red-500/30 transition-all"
                                                    >
                                                        Stop Auto
                                                    </motion.button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    </motion.div >
                </motion.div >
            )
            }
        </AnimatePresence >
    )

    return createPortal(modal, document.body)
}
