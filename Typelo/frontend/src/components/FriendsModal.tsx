/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * FriendsModal Component - Manages friend list, requests, and user search.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * FriendsModal: Main component.
 * fetchData: Loads friends and requests.
 * performSearch: Executes user search query.
 * handleSearchChange: Debounces search input.
 * handleAcceptRequest: Accepts friend request.
 * handleDeclineRequest: Declines friend request.
 * handleRemoveFriend: Removes a friend.
 * FriendRow: Sub-component for individual friend row.
 * RequestRow: Sub-component for request row.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * activeTab: Tab state (friends/requests/search).
 * friends: List of friends.
 * pendingRequests: List of pending friend requests.
 * loading: Loading state.
 * searchQuery: Current search input.
 * searchResults: Search result list.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: UI animations.
 * stores: Auth store.
 * config/api: Friend management API functions.
 * types: Shared types.
 * components: UserProfileModal.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import {
    getFriends,
    getFriendRequests,
    acceptFriendRequest,
    declineFriendRequest,
    searchUsers,
    removeFriend,
    Friend,
    FriendRequest,
    UserSearchResult
} from '../config/api'
import { getRankColor, Rank } from '../types'
import UserProfileModal from './UserProfileModal'

interface FriendsModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function FriendsModal({ isOpen, onClose }: FriendsModalProps) {
    const { idToken } = useAuthStore()
    const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends')
    const [friends, setFriends] = useState<Friend[]>([])
    const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
    const [searching, setSearching] = useState(false)
    const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
    const [showProfileModal, setShowProfileModal] = useState(false)
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const performSearch = useCallback(async (query: string) => {
        if (!idToken || query.trim().length < 1) {
            setSearchResults([])
            setSearching(false)
            return
        }

        setSearching(true)
        try {
            const results = await searchUsers(query.trim(), idToken)
            setSearchResults(results)
        } catch (err) {
            console.error('Search failed:', err)
            setSearchResults([])
        } finally {
            setSearching(false)
        }
    }, [idToken])

    const handleSearchChange = (value: string) => {
        setSearchQuery(value)

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        if (value.trim().length < 1) {
            setSearchResults([])
            return
        }

        setSearching(true)
        searchTimeoutRef.current = setTimeout(() => {
            performSearch(value)
        }, 300)
    }

    const handleUserClick = (user: UserSearchResult) => {
        setSelectedUser(user)
        setShowProfileModal(true)
    }

    // Fetch friends and requests when modal opens
    useEffect(() => {
        if (isOpen && idToken) {
            fetchData()
        }
    }, [isOpen, idToken])

    const fetchData = async () => {
        if (!idToken) return

        setLoading(true)
        setError(null)

        try {
            const [friendsData, requestsData] = await Promise.all([
                getFriends(idToken).catch(() => []),
                getFriendRequests(idToken).catch(() => [])
            ])
            setFriends(friendsData)
            setPendingRequests(requestsData)
        } catch (err) {
            console.error('Failed to fetch friends data:', err)
            setError('Failed to load friends')
        } finally {
            setLoading(false)
        }
    }

    const handleAcceptRequest = async (requestId: string) => {
        if (!idToken) return

        try {
            await acceptFriendRequest(requestId, idToken)
            // Refresh data after accepting
            fetchData()
        } catch (err) {
            console.error('Failed to accept request:', err)
        }
    }

    const handleDeclineRequest = async (requestId: string) => {
        if (!idToken) return

        try {
            await declineFriendRequest(requestId, idToken)
            // Remove from local state immediately for responsiveness
            setPendingRequests(prev => prev.filter(r => r.id !== requestId))
        } catch (err) {
            console.error('Failed to decline request:', err)
        }
    }

    const handleRemoveFriend = async (friendId: string) => {
        if (!idToken) return

        try {
            await removeFriend(friendId, idToken)
            // Remove from local state immediately for responsiveness
            setFriends(prev => prev.filter(f => f.uid !== friendId))
        } catch (err) {
            console.error('Failed to remove friend:', err)
        }
    }

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
                            {/* Header */}
                            <div className="px-6 py-5 flex items-center justify-between">
                                <h2 className="text-base font-semibold text-white">Friends</h2>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="px-6 flex gap-1 border-b border-white/[0.04]">
                                <button
                                    onClick={() => setActiveTab('friends')}
                                    className={`px-4 py-2.5 text-xs font-medium transition-colors relative ${activeTab === 'friends' ? 'text-white' : 'text-white/40 hover:text-white/60'
                                        }`}
                                >
                                    Friends
                                    {activeTab === 'friends' && (
                                        <motion.div
                                            layoutId="friends-tab"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                                        />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('requests')}
                                    className={`px-4 py-2.5 text-xs font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'requests' ? 'text-white' : 'text-white/40 hover:text-white/60'
                                        }`}
                                >
                                    Requests
                                    {pendingRequests.length > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-[10px] flex items-center justify-center">
                                            {pendingRequests.length}
                                        </span>
                                    )}
                                    {activeTab === 'requests' && (
                                        <motion.div
                                            layoutId="friends-tab"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                                        />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('search')}
                                    className={`px-4 py-2.5 text-xs font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'search' ? 'text-white' : 'text-white/40 hover:text-white/60'
                                        }`}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="M21 21l-4.35-4.35" />
                                    </svg>
                                    Search
                                    {activeTab === 'search' && (
                                        <motion.div
                                            layoutId="friends-tab"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                                        />
                                    )}
                                </button>
                            </div>

                            {/* Content */}
                            <div className="max-h-[50vh] overflow-y-auto">
                                {loading ? (
                                    <div className="py-16 flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    </div>
                                ) : error ? (
                                    <div className="py-16 text-center px-6">
                                        <p className="text-red-400/80 text-sm">{error}</p>
                                        <button
                                            onClick={fetchData}
                                            className="mt-3 text-xs text-white/40 hover:text-white/60 transition-colors"
                                        >
                                            Try again
                                        </button>
                                    </div>
                                ) : activeTab === 'friends' ? (
                                    friends.length === 0 ? (
                                        <div className="py-16 text-center px-6">
                                            <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                                                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                                    <circle cx="8.5" cy="7" r="4" />
                                                    <path d="M20 8v6M23 11h-6" />
                                                </svg>
                                            </div>
                                            <p className="text-white/40 text-sm mb-1">No friends yet</p>
                                            <p className="text-white/20 text-xs">Share your invite link to add friends</p>
                                        </div>
                                    ) : (
                                        <div className="p-3 space-y-1">
                                            {friends.map((friend) => (
                                                <FriendRow
                                                    key={friend.uid}
                                                    friend={friend}
                                                    onRemove={() => handleRemoveFriend(friend.uid)}
                                                />
                                            ))}
                                        </div>
                                    )
                                ) : activeTab === 'requests' ? (
                                    pendingRequests.length === 0 ? (
                                        <div className="py-16 text-center px-6">
                                            <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                                </svg>
                                            </div>
                                            <p className="text-white/40 text-sm mb-1">No pending requests</p>
                                            <p className="text-white/20 text-xs">Friend requests will appear here</p>
                                        </div>
                                    ) : (
                                        <div className="p-3 space-y-1">
                                            {pendingRequests.map((request) => (
                                                <RequestRow
                                                    key={request.id}
                                                    request={request}
                                                    onAccept={() => handleAcceptRequest(request.id)}
                                                    onDecline={() => handleDeclineRequest(request.id)}
                                                />
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    <div className="p-4">
                                        <div className="relative mb-4">
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                                            >
                                                <circle cx="11" cy="11" r="8" />
                                                <path d="M21 21l-4.35-4.35" />
                                            </svg>
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => handleSearchChange(e.target.value)}
                                                placeholder="Search by username..."
                                                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors"
                                                autoFocus
                                            />
                                            {searching && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                </div>
                                            )}
                                        </div>

                                        {searchQuery.trim().length === 0 ? (
                                            <div className="py-12 text-center">
                                                <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                                                        <circle cx="11" cy="11" r="8" />
                                                        <path d="M21 21l-4.35-4.35" />
                                                    </svg>
                                                </div>
                                                <p className="text-white/40 text-sm mb-1">Search for players</p>
                                                <p className="text-white/20 text-xs">Find friends by their username</p>
                                            </div>
                                        ) : searchResults.length === 0 && !searching ? (
                                            <div className="py-12 text-center">
                                                <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                                                        <circle cx="11" cy="11" r="8" />
                                                        <path d="M21 21l-4.35-4.35" />
                                                    </svg>
                                                </div>
                                                <p className="text-white/40 text-sm mb-1">No users found</p>
                                                <p className="text-white/20 text-xs">Try a different username</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {searchResults.map((user) => (
                                                    <button
                                                        key={user.uid}
                                                        onClick={() => handleUserClick(user)}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors text-left"
                                                    >
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                                            {user.photo_url ? (
                                                                <img
                                                                    src={user.photo_url}
                                                                    alt={user.display_name}
                                                                    className="w-full h-full object-cover"
                                                                    crossOrigin="anonymous"
                                                                    referrerPolicy="no-referrer"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-sm text-white/40">
                                                                    {user.display_name.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{user.display_name}</p>
                                                            <p className="text-[11px] text-white/30">
                                                                {user.elo_rating} ELO ·
                                                                <span style={{ color: getRankColor(user.rank as Rank) }}> {user.rank}</span>
                                                            </p>
                                                        </div>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 flex-shrink-0">
                                                            <path d="M9 18l6-6-6-6" />
                                                        </svg>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}

            {selectedUser && (
                <UserProfileModal
                    isOpen={showProfileModal}
                    onClose={() => setShowProfileModal(false)}
                    userId={selectedUser.uid}
                    userName={selectedUser.display_name}
                    userPhoto={selectedUser.photo_url}
                    userElo={selectedUser.elo_rating}
                    userRank={selectedUser.rank}
                />
            )}
        </AnimatePresence>
    )
}

interface FriendRowProps {
    friend: Friend
    onRemove: () => void
}

function FriendRow({ friend, onRemove }: FriendRowProps) {
    const [removing, setRemoving] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const handleRemove = async () => {
        setRemoving(true)
        await onRemove()
    }

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
            {/* Avatar with online status */}
            <div className="relative">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10">
                    {friend.photo_url ? (
                        <img
                            src={friend.photo_url}
                            alt={friend.display_name}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-white/40">
                            {friend.display_name.charAt(0)}
                        </div>
                    )}
                </div>
                {friend.is_online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0c0c0c]" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{friend.display_name}</p>
                <p className="text-[11px] text-white/30">
                    {friend.elo_rating} ELO ·
                    <span style={{ color: getRankColor(friend.rank as Rank) }}> {friend.rank}</span>
                </p>
            </div>

            {/* Remove button - shows on hover or when confirming */}
            <div className={`transition-opacity ${showConfirm ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {showConfirm ? (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleRemove}
                            disabled={removing}
                            className="px-2 py-1 text-[10px] rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                        >
                            {removing ? '...' : 'Remove'}
                        </button>
                        <button
                            onClick={() => setShowConfirm(false)}
                            className="px-2 py-1 text-[10px] rounded bg-white/5 text-white/50 hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowConfirm(true)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                        title="Remove friend"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30 hover:text-red-400">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )
}

interface RequestRowProps {
    request: FriendRequest
    onAccept: () => void
    onDecline: () => void
}

function RequestRow({ request, onAccept, onDecline }: RequestRowProps) {
    const [accepting, setAccepting] = useState(false)
    const [declining, setDeclining] = useState(false)

    const handleAccept = async () => {
        setAccepting(true)
        await onAccept()
    }

    const handleDecline = async () => {
        setDeclining(true)
        await onDecline()
    }

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10">
                {request.from_user.photo_url ? (
                    <img
                        src={request.from_user.photo_url}
                        alt={request.from_user.display_name}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-white/40">
                        {request.from_user.display_name.charAt(0)}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{request.from_user.display_name}</p>
                <p className="text-[11px] text-white/30">
                    {request.from_user.elo_rating} ELO ·
                    <span style={{ color: getRankColor(request.from_user.rank as Rank) }}> {request.from_user.rank}</span>
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={handleAccept}
                    disabled={accepting || declining}
                    className="w-8 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                    {accepting ? (
                        <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    )}
                </button>
                <button
                    onClick={handleDecline}
                    disabled={accepting || declining}
                    className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                    {declining ? (
                        <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400/70">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    )
}
