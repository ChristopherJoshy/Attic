/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * ProfileModal Component - Displays the current user's profile statistics and settings.
 * Allows generating friend invite links and viewing detailed stats.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * ProfileModal: Main component.
 * generateInviteLink: Creates a sharable friend invite link.
 * copyInviteLink: Copies the invite link to clipboard.
 * StatItem: Sub-component for stats.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * user: Current user.
 * stats: User statistics.
 * inviteLink: Generated link URL.
 * copied: State for copy feedback.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 * stores: Auth store.
 * types: Rank color utility.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { getRankColor } from '../types'

interface ProfileModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { user, stats, isGuest, convertGuestToGoogle } = useAuthStore()
    const [inviteLink, setInviteLink] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [converting, setConverting] = useState(false)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    const generateInviteLink = () => {
        // Generate a unique invite link with user ID
        // Use base64 encoding of just the user ID (no timestamp to avoid truncation)
        const baseUrl = window.location.origin
        const inviteCode = btoa(user?.uid || '')
        const link = `${baseUrl}/invite/${inviteCode}`
        setInviteLink(link)
        return link
    }

    const copyInviteLink = async () => {
        const link = inviteLink || generateInviteLink()
        try {
            await navigator.clipboard.writeText(link)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const winRate = stats && stats.totalMatches > 0
        ? Math.round((stats.wins / stats.totalMatches) * 100)
        : 0

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        className="fixed inset-0 flex items-center justify-center z-50 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-[#0c0c0c] border border-white/[0.08] rounded-2xl w-full max-w-sm overflow-hidden"
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header with avatar */}
                            <div className="relative px-6 pt-8 pb-6">
                                {/* Close button */}
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-gray-400 flex items-center justify-center transition-colors shadow-lg"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>

                                {/* Avatar with online indicator */}
                                <div className="flex flex-col items-center">
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 bg-white/5">
                                            {user?.photoURL ? (
                                                <img
                                                    src={user.photoURL}
                                                    alt={user.displayName}
                                                    className="w-full h-full object-cover"
                                                    crossOrigin="anonymous"
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-2xl font-medium text-white/60">
                                                    {user?.displayName?.charAt(0) || '?'}
                                                </div>
                                            )}
                                        </div>
                                        {/* Online indicator */}
                                        <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0c0c0c]" />
                                    </div>

                                    {/* Name and email */}
                                    <h2 className="text-lg font-semibold text-white mt-4">{user?.displayName}</h2>
                                    <p className="text-xs text-white/30 mt-0.5">{user?.email}</p>
                                </div>
                            </div>

                            {/* Rank Section */}
                            <div className="px-6 pb-4">
                                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] text-white/30 uppercase tracking-wider">Current Rank</span>
                                        <span
                                            className="text-sm font-semibold"
                                            style={{ color: getRankColor(stats?.rank || 'Unranked') }}
                                        >
                                            {stats?.rank || 'Unranked'}
                                        </span>
                                    </div>

                                    {/* Rank cards */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white/[0.02] rounded-lg p-3 text-center">
                                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Peak ELO</p>
                                            <p className="text-xl font-mono font-medium text-white">{stats?.peakElo || 1000}</p>
                                        </div>
                                        <div className="bg-white/[0.02] rounded-lg p-3 text-center">
                                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Current ELO</p>
                                            <p className="text-xl font-mono font-medium text-white">{stats?.currentElo || 1000}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="px-6 pb-4">
                                <div className="grid grid-cols-4 gap-2">
                                    <StatItem label="Matches" value={stats?.totalMatches || 0} />
                                    <StatItem label="Win Rate" value={`${winRate}%`} />
                                    <StatItem label="Best WPM" value={stats?.bestWpm || 0} />
                                    <StatItem label="Avg WPM" value={Math.round(stats?.avgWpm || 0)} />
                                </div>
                            </div>

                            {/* Quick Stats Row */}
                            <div className="px-6 pb-4">
                                <div className="flex items-center justify-center gap-6 py-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                                    <div className="text-center">
                                        <span className="text-emerald-400 font-mono font-medium">{stats?.wins || 0}</span>
                                        <span className="text-white/30 text-xs ml-1">W</span>
                                    </div>
                                    <div className="w-px h-4 bg-white/10" />
                                    <div className="text-center">
                                        <span className="text-red-400/80 font-mono font-medium">{stats?.losses || 0}</span>
                                        <span className="text-white/30 text-xs ml-1">L</span>
                                    </div>
                                    <div className="w-px h-4 bg-white/10" />
                                    <div className="text-center">
                                        <span className="text-white/60 font-mono font-medium">{Math.round(stats?.avgAccuracy || 0)}%</span>
                                        <span className="text-white/30 text-xs ml-1">Acc</span>
                                    </div>
                                </div>
                            </div>

                            {/* Link with Google - Show for guest users */}
                            {isGuest && (
                                <div className="px-6 pb-4">
                                    <button
                                        onClick={async () => {
                                            setConverting(true)
                                            try {
                                                await convertGuestToGoogle()
                                                onClose()
                                            } catch (err) {
                                                console.error('Failed to convert:', err)
                                            } finally {
                                                setConverting(false)
                                            }
                                        }}
                                        disabled={converting}
                                        className="w-full py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-medium text-sm transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        {converting ? 'Linking...' : 'Link with Google'}
                                    </button>
                                    <p className="text-[10px] text-white/30 text-center mt-2">
                                        Keep your progress when you sign in with Google
                                    </p>
                                </div>
                            )}

                            {/* Invite Friend Section */}
                            <div className="px-6 pb-6">
                                <div className="border-t border-white/[0.04] pt-4">
                                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3 text-center">Invite Friends</p>

                                    {inviteLink ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg p-2 border border-white/[0.06]">
                                                <input
                                                    type="text"
                                                    value={inviteLink}
                                                    readOnly
                                                    className="flex-1 bg-transparent text-xs text-white/60 outline-none font-mono truncate"
                                                />
                                                <button
                                                    onClick={copyInviteLink}
                                                    className={`px-3 py-1.5 rounded text-[10px] font-medium transition-colors ${copied
                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                        : 'bg-white/10 text-white/60 hover:bg-white/15'
                                                        }`}
                                                >
                                                    {copied ? 'Copied!' : 'Copy'}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-white/20 text-center">Share this link with friends to add them</p>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={generateInviteLink}
                                            className="w-full py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-sm text-white/70 hover:text-white transition-colors flex items-center justify-center gap-2"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                                <circle cx="8.5" cy="7" r="4" />
                                                <path d="M20 8v6M23 11h-6" />
                                            </svg>
                                            Generate Invite Link
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

function StatItem({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="text-center py-2">
            <p className="text-base font-mono font-medium text-white">{value}</p>
            <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">{label}</p>
        </div>
    )
}
