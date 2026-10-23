/**
 *   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *
 * UpdateModal Component - Displays recent updates to users.
 * Auto-shows once per update version using localStorage tracking.
 *
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * UpdateModal: Main component rendering the update changelog modal.
 *
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * UPDATE_VERSION: Current update version string for localStorage tracking.
 * UPDATES: Array of update items with titles and descriptions.
 * isOpen: State for modal visibility.
 *
 * --------------------------------------------------------------------------
 *                                   Imports
 * --------------------------------------------------------------------------
 * react: React hooks (useState, useEffect).
 * framer-motion: Animations for modal.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Update this version string each time you push updates
const UPDATE_VERSION = '2024-12-14-v12'
const STORAGE_KEY = 'typelo_last_seen_update'

interface UpdateItem {
    icon: string
    title: string
    description: string
    color: string
}

const UPDATES: UpdateItem[] = [
    {
        icon: '✨',
        title: 'Premium Profile Effects',
        description: 'Discord-inspired animated borders with rainbow, galaxy, phoenix, aurora effects.',
        color: '#a855f7'
    },
    {
        icon: '🎨',
        title: 'Inventory Redesign',
        description: 'Minimal futuristic design with glassmorphism and enhanced item display.',
        color: '#22d3ee'
    },
    {
        icon: '🏆',
        title: 'Leaderboard Bonuses',
        description: 'Top 3: 50% bonus. Top 4-10: 20% bonus on luck, discounts, and match coins.',
        color: '#fbbf24'
    },
    {
        icon: '📦',
        title: 'Profile Crates',
        description: 'Spend 1000 coins to unlock exclusive profile customizations.',
        color: '#f97316'
    }
]

interface UpdateModalProps {
    forceOpen?: boolean
    onClose?: () => void
}

export default function UpdateModal({ forceOpen, onClose }: UpdateModalProps) {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        if (forceOpen) {
            setIsOpen(true)
            return
        }

        const lastSeenVersion = localStorage.getItem(STORAGE_KEY)
        if (lastSeenVersion !== UPDATE_VERSION) {
            setIsOpen(true)
        }
    }, [forceOpen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') handleClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEY, UPDATE_VERSION)
        setIsOpen(false)
        onClose?.()
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                    />

                    <motion.div
                        className="fixed inset-0 flex items-center justify-center z-50 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="relative w-full max-w-md bg-[#0c0c0c] border border-white/[0.08] rounded-2xl overflow-hidden"
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-white/[0.06]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-focus/20 to-transparent flex items-center justify-center">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-focus">
                                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-white">What's New</h2>
                                            <p className="text-xs text-text-muted">Latest updates</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleClose}
                                        className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Updates List */}
                            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
                                {UPDATES.map((update, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="flex gap-4 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                                            style={{ background: `${update.color}15` }}
                                        >
                                            {update.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-medium text-white mb-0.5">{update.title}</h3>
                                            <p className="text-xs text-text-muted leading-relaxed">{update.description}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-white/[0.06]">
                                <button
                                    onClick={handleClose}
                                    className="w-full py-2.5 rounded-xl bg-accent-focus/10 hover:bg-accent-focus/20 text-accent-focus font-medium text-sm transition-colors"
                                >
                                    Got it!
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
