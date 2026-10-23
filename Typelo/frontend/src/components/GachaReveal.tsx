/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * GachaReveal - Graffiti-style spray paint burst animation for gacha reveals.
 * Creates an explosive visual effect with rarity-themed colors.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useMemo } from 'react'
import { getRarityColor } from '../types'

interface GachaRevealProps {
    isVisible: boolean
    rarity: string
    children: React.ReactNode
    onComplete?: () => void
}

const RARITY_PALETTES: Record<string, string[]> = {
    common: ['#9ca3af', '#6b7280', '#d1d5db'],
    uncommon: ['#22c55e', '#16a34a', '#86efac'],
    rare: ['#3b82f6', '#2563eb', '#93c5fd'],
    epic: ['#a855f7', '#9333ea', '#d8b4fe'],
    legendary: ['#f59e0b', '#fbbf24', '#fcd34d'],
    ultra: ['#c084fc', '#a855f7', '#e879f9'],
    divine: ['#fef08a', '#fde047', '#fef9c3'],
    mythical: ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#fbbf24'],
}

export default function GachaReveal({ isVisible, rarity, children, onComplete }: GachaRevealProps) {
    const palette = RARITY_PALETTES[rarity] || RARITY_PALETTES.common
    const primaryColor = getRarityColor(rarity as any)

    // Generate spray particles
    const particles = useMemo(() => {
        const count = rarity === 'mythical' ? 40 : rarity === 'legendary' || rarity === 'divine' ? 30 : 20
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            angle: (i / count) * 360 + Math.random() * 30,
            distance: 80 + Math.random() * 120,
            size: 4 + Math.random() * 12,
            delay: Math.random() * 0.2,
            color: palette[i % palette.length],
            duration: 0.4 + Math.random() * 0.3,
        }))
    }, [rarity, palette])

    // Generate splatter blobs
    const splatters = useMemo(() => {
        const count = rarity === 'mythical' ? 8 : 5
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            angle: (i / count) * 360 + Math.random() * 60,
            distance: 40 + Math.random() * 60,
            width: 20 + Math.random() * 40,
            height: 8 + Math.random() * 16,
            rotation: Math.random() * 360,
            delay: 0.1 + Math.random() * 0.15,
            color: palette[i % palette.length],
        }))
    }, [rarity, palette])

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                    {/* Background flash */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.4, 0] }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0"
                        style={{ backgroundColor: primaryColor }}
                    />

                    {/* Spray particles */}
                    {particles.map((p) => (
                        <motion.div
                            key={p.id}
                            initial={{
                                x: 0,
                                y: 0,
                                scale: 0,
                                opacity: 1
                            }}
                            animate={{
                                x: Math.cos(p.angle * Math.PI / 180) * p.distance,
                                y: Math.sin(p.angle * Math.PI / 180) * p.distance,
                                scale: [0, 1.5, 1],
                                opacity: [1, 1, 0],
                            }}
                            transition={{
                                duration: p.duration,
                                delay: p.delay,
                                ease: 'easeOut',
                            }}
                            className="absolute rounded-full"
                            style={{
                                width: p.size,
                                height: p.size,
                                backgroundColor: p.color,
                                boxShadow: `0 0 ${p.size}px ${p.color}`,
                            }}
                        />
                    ))}

                    {/* Splatter blobs */}
                    {splatters.map((s) => (
                        <motion.div
                            key={`splat-${s.id}`}
                            initial={{
                                x: 0,
                                y: 0,
                                scale: 0,
                                opacity: 0.8,
                            }}
                            animate={{
                                x: Math.cos(s.angle * Math.PI / 180) * s.distance,
                                y: Math.sin(s.angle * Math.PI / 180) * s.distance,
                                scale: [0, 1.2, 1],
                                opacity: [0.8, 0.6, 0],
                            }}
                            transition={{
                                duration: 0.5,
                                delay: s.delay,
                                ease: 'easeOut',
                            }}
                            className="absolute"
                            style={{
                                width: s.width,
                                height: s.height,
                                backgroundColor: s.color,
                                borderRadius: '50%',
                                transform: `rotate(${s.rotation}deg)`,
                                filter: 'blur(2px)',
                            }}
                        />
                    ))}

                    {/* Center ring burst */}
                    <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 3, opacity: 0 }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="absolute rounded-full border-4"
                        style={{
                            width: 60,
                            height: 60,
                            borderColor: primaryColor,
                        }}
                    />

                    {/* Inner ring */}
                    <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 2, opacity: 0 }}
                        transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                        className="absolute rounded-full border-2"
                        style={{
                            width: 40,
                            height: 40,
                            borderColor: primaryColor,
                        }}
                    />

                    {/* Content reveal */}
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                            type: 'spring',
                            delay: 0.2,
                            stiffness: 200,
                            damping: 15,
                        }}
                        onAnimationComplete={onComplete}
                        className="relative z-10"
                    >
                        {children}
                    </motion.div>

                    {/* Mythical rainbow shimmer */}
                    {rarity === 'mythical' && (
                        <motion.div
                            initial={{ opacity: 0, rotate: 0 }}
                            animate={{
                                opacity: [0, 0.3, 0],
                                rotate: 180,
                            }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="absolute w-[200%] h-[200%]"
                            style={{
                                background: 'conic-gradient(from 0deg, #ec4899, #8b5cf6, #3b82f6, #10b981, #fbbf24, #ec4899)',
                                filter: 'blur(40px)',
                            }}
                        />
                    )}
                </div>
            )}
        </AnimatePresence>
    )
}
