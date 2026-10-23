/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * MatchHistoryModal Component - Displays the user's past match history.
 * Supports pagination, expandable details for each match, and stats visualization.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * MatchHistoryModal: Main component.
 * fetchMatches: Retrieves match history from API.
 * formatDate: Formats relative time (e.g., "2 hours ago").
 * formatFullDate: Formats full date string.
 * toggleExpand: Expands/collapses match details.
 * StatBox: Sub-component for individual stat cards.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * matches: List of match history entries.
 * loading: Loading state.
 * page: Current pagination page.
 * totalMatches: Total count of matches.
 * expandedId: ID of currently expanded match.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 * config/api: API endpoints.
 * stores: Auth store.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_ENDPOINTS } from '../config/api'
import { useAuthStore } from '../stores/authStore'

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

interface MatchHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function MatchHistoryModal({ isOpen, onClose }: MatchHistoryModalProps) {
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalMatches, setTotalMatches] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { idToken } = useAuthStore()

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
  }, [idToken, page, limit])

  useEffect(() => {
    if (isOpen && idToken) {
      fetchMatches()
    }
  }, [isOpen, idToken, fetchMatches])

  useEffect(() => {
    if (!isOpen) {
      setExpandedId(null)
    }
  }, [isOpen])

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
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const totalPages = Math.ceil(totalMatches / limit)

  const toggleExpand = (matchId: string) => {
    setExpandedId(expandedId === matchId ? null : matchId)
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
              className="bg-[#0c0c0c] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Match History</h2>
                  <p className="text-xs text-white/40 mt-1">{totalMatches} total matches</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Matches List */}
              <div className="max-h-[55vh] overflow-y-auto px-3 pb-3">
                {loading ? (
                  <div className="space-y-2 p-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : matches.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-white/30 text-sm">No matches yet</p>
                    <p className="text-white/20 text-xs mt-1">Play a match to see it here</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {matches.map((match, index) => {
                      const isExpanded = expandedId === match.match_id
                      const isWin = match.result === 'win'
                      const isLoss = match.result === 'loss'

                      return (
                        <motion.div
                          key={match.match_id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={`rounded-xl overflow-hidden transition-colors ${isExpanded
                            ? 'bg-white/[0.04]'
                            : 'bg-white/[0.02] hover:bg-white/[0.03]'
                            }`}
                        >
                          {/* Main Row */}
                          <div
                            className="px-4 py-3.5 flex items-center gap-3 cursor-pointer"
                            onClick={() => toggleExpand(match.match_id)}
                          >
                            {/* Result Badge */}
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isWin
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : isLoss
                                ? 'bg-red-500/10 text-red-400/80'
                                : 'bg-white/[0.05] text-white/40'
                              }`}>
                              {isWin ? 'W' : isLoss ? 'L' : 'T'}
                            </div>

                            {/* Match Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white truncate">
                                  vs {match.opponent_is_bot ? 'Bot' : match.opponent_name}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/30 mt-0.5">
                                {formatDate(match.played_at)} · {Math.round(match.your_wpm)} wpm
                              </p>
                            </div>

                            {/* ELO Change */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-sm font-mono font-medium ${match.elo_change > 0
                                ? 'text-emerald-400'
                                : match.elo_change < 0
                                  ? 'text-red-400/70'
                                  : 'text-white/30'
                                }`}>
                                {match.elo_change > 0 ? '+' : ''}{match.elo_change}
                              </span>
                              <motion.svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-white/20"
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <path d="M6 9l6 6 6-6" />
                              </motion.svg>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-1">
                                  {/* Divider */}
                                  <div className="h-px bg-white/[0.05] mb-4" />

                                  {/* Timestamp */}
                                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-4">
                                    {formatFullDate(match.played_at)}
                                  </p>

                                  {/* Stats Grid */}
                                  <div className="grid grid-cols-3 gap-3">
                                    <StatBox
                                      label="WPM"
                                      value={Math.round(match.your_wpm)}
                                      highlight={match.your_wpm >= match.opponent_wpm}
                                    />
                                    <StatBox
                                      label="Accuracy"
                                      value={`${Math.round(match.your_accuracy)}%`}
                                      highlight={match.your_accuracy >= 90}
                                    />
                                    <StatBox
                                      label="Score"
                                      value={Math.round(match.your_score)}
                                      highlight={true}
                                    />
                                  </div>

                                  {/* Opponent comparison */}
                                  <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                                    <span className="text-[10px] text-white/30 uppercase tracking-wider">
                                      Opponent WPM
                                    </span>
                                    <span className="text-xs font-mono text-white/50">
                                      {Math.round(match.opponent_wpm)}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-white/[0.05] flex items-center justify-between">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-xs text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${page === pageNum
                            ? 'bg-white/10 text-white'
                            : 'text-white/30 hover:text-white/60'
                            }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    {totalPages > 5 && (
                      <span className="text-white/20 text-xs px-1">...</span>
                    )}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="text-xs text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    Next
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Stat box component for expanded view
function StatBox({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-3 text-center">
      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-base font-mono font-medium ${highlight ? 'text-white' : 'text-white/50'}`}>
        {value}
      </p>
    </div>
  )
}
