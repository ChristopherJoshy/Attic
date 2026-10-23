/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * InvitePage Component - Handles incoming friend invite links.
 * Decodes the invite token, fetches the inviter's profile, and allows sending a friend request.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * InvitePage: Main component.
 * decodeInviteCode: Decodes Base64 invite code to retrieve User ID.
 * fetchProfile: Gets the public profile of the inviter.
 * handleSendRequest: Sends a friend request to the inviter.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * code: URL parameter containing the invite code.
 * profile: Inviter's profile data.
 * requestSent: Success state for the request.
 * winRate: Calculated win rate of the inviter.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 * stores: Auth store.
 * config/api: API functions (getUserPublicProfile, sendFriendRequest).
 * types: Shared types.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { getUserPublicProfile, sendFriendRequest, PublicProfile } from '../config/api'
import { getRankColor, Rank } from '../types'

export default function InvitePage() {
    const { code } = useParams<{ code: string }>()
    const navigate = useNavigate()
    const { user, idToken } = useAuthStore()

    const [profile, setProfile] = useState<PublicProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [requestSent, setRequestSent] = useState(false)
    const [sending, setSending] = useState(false)

    // Decode invite code to get user ID
    const decodeInviteCode = (code: string): string | null => {
        try {
            // Decode base64 to get the Firebase UID directly
            const userId = atob(code)
            return userId || null
        } catch {
            return null
        }
    }

    useEffect(() => {
        const fetchProfile = async () => {
            if (!code) {
                setError('Invalid invite link')
                setLoading(false)
                return
            }

            const userId = decodeInviteCode(code)
            if (!userId) {
                setError('Invalid invite code')
                setLoading(false)
                return
            }

            // Check if user is trying to add themselves
            if (user && userId === user.uid) {
                setError("You can't add yourself as a friend!")
                setLoading(false)
                return
            }

            if (!idToken) {
                setLoading(false)
                return
            }

            try {
                const profileData = await getUserPublicProfile(userId, idToken)
                setProfile(profileData)
            } catch (err: any) {
                console.error('Failed to fetch profile:', err)
                if (err.status === 404) {
                    setError('User not found')
                } else if (err.message?.includes('Failed to fetch')) {
                    setError('Unable to connect to server')
                } else {
                    setError(err.message || 'Failed to load profile')
                }
            } finally {
                setLoading(false)
            }
        }

        fetchProfile()
    }, [code, idToken, user])

    const handleSendRequest = async () => {
        if (!profile || !idToken) return

        setSending(true)
        try {
            await sendFriendRequest(profile.uid, idToken)
            setRequestSent(true)
        } catch (err: any) {
            console.error('Failed to send request:', err)
            setError(err.message || 'Failed to send friend request')
        } finally {
            setSending(false)
        }
    }

    const winRate = profile && profile.total_matches > 0
        ? Math.round((profile.wins / profile.total_matches) * 100)
        : 0

    // Not logged in state
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0c0c0c] border border-white/[0.08] rounded-2xl p-8 max-w-sm w-full text-center"
                >
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <path d="M20 8v6M23 11h-6" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">Friend Invite</h2>
                    <p className="text-sm text-white/50 mb-6">Sign in to accept this friend request</p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                    >
                        Sign In
                    </button>
                </motion.div>
            </div>
        )
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-primary">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0c0c0c] border border-white/[0.08] rounded-2xl p-8 max-w-sm w-full text-center"
                >
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M15 9l-6 6M9 9l6 6" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">Oops!</h2>
                    <p className="text-sm text-white/50 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </motion.div>
            </div>
        )
    }

    // Success state (request sent)
    if (requestSent) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#0c0c0c] border border-white/[0.08] rounded-2xl p-8 max-w-sm w-full text-center"
                >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">Request Sent!</h2>
                    <p className="text-sm text-white/50 mb-6">
                        Friend request sent to <span className="text-white">{profile?.display_name}</span>
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </motion.div>
            </div>
        )
    }

    // Profile view with send request button
    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0c0c0c] border border-white/[0.08] rounded-2xl w-full max-w-sm overflow-hidden"
            >
                {/* Header */}
                <div className="px-6 pt-8 pb-6 text-center">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 bg-white/5 mx-auto mb-4">
                        {profile?.photo_url ? (
                            <img
                                src={profile.photo_url}
                                alt={profile.display_name}
                                className="w-full h-full object-cover"
                                crossOrigin="anonymous"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl font-medium text-white/60">
                                {profile?.display_name?.charAt(0) || '?'}
                            </div>
                        )}
                    </div>

                    {/* Name */}
                    <h2 className="text-xl font-semibold text-white">{profile?.display_name}</h2>

                    {/* Rank */}
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <span
                            className="text-sm font-medium"
                            style={{ color: getRankColor((profile?.rank as Rank) || 'Unranked') }}
                        >
                            {profile?.rank || 'Unranked'}
                        </span>
                        <span className="text-white/20">•</span>
                        <span className="text-sm text-white/50">{profile?.elo_rating || 1000} ELO</span>
                    </div>
                </div>

                {/* Stats */}
                <div className="px-6 pb-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                            <p className="text-lg font-mono font-medium text-white">{profile?.total_matches || 0}</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Matches</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                            <p className="text-lg font-mono font-medium text-white">{winRate}%</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Win Rate</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                            <p className="text-lg font-mono font-medium text-white">{Math.round(profile?.avg_wpm || 0)}</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Avg WPM</p>
                        </div>
                    </div>
                </div>

                {/* W/L Record */}
                <div className="px-6 pb-4">
                    <div className="flex items-center justify-center gap-6 py-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                        <div className="text-center">
                            <span className="text-emerald-400 font-mono font-medium">{profile?.wins || 0}</span>
                            <span className="text-white/30 text-xs ml-1">W</span>
                        </div>
                        <div className="w-px h-4 bg-white/10" />
                        <div className="text-center">
                            <span className="text-red-400/80 font-mono font-medium">{profile?.losses || 0}</span>
                            <span className="text-white/30 text-xs ml-1">L</span>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="px-6 pb-6">
                    <button
                        onClick={handleSendRequest}
                        disabled={sending}
                        className="w-full py-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {sending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                    <circle cx="8.5" cy="7" r="4" />
                                    <path d="M20 8v6M23 11h-6" />
                                </svg>
                                Send Friend Request
                            </>
                        )}
                    </button>
                </div>

                {/* Back link */}
                <div className="px-6 pb-6 text-center">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-sm text-white/30 hover:text-white/50 transition-colors"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
