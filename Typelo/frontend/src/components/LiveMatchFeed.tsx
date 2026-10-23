/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * LiveMatchFeed Component - Shows live matches and results to all online users.
 * Displays active matches and recent winners/losers in real-time.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * LiveMatchFeed: Main component.
 * getModeColor: Returns text color class for each game mode.
 * getModeLabel: Returns human-readable label for game mode.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * activeMatches: List of currently playing matches.
 * recentResults: List of recently finished match results.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * stores: matchFeedStore.
 * framer-motion: Animations.
 */

import { useMatchFeedStore } from '../stores/matchFeedStore'
import { motion, AnimatePresence } from 'framer-motion'

export default function LiveMatchFeed() {
    const { activeMatches, recentResults } = useMatchFeedStore()

    const getModeColor = (mode: string) => {
        switch (mode) {
            case 'training': return 'text-yellow-400'
            case 'friends': return 'text-purple-400'
            default: return 'text-cyan-400'
        }
    }

    const getModeLabel = (mode: string) => {
        switch (mode) {
            case 'training': return 'TRAINING'
            case 'friends': return 'FRIENDS'
            default: return 'RANKED'
        }
    }

    // Don't render if nothing to show
    if (activeMatches.length === 0 && recentResults.length === 0) {
        return null
    }

    return (
        <div className="fixed bottom-4 left-4 z-50 max-w-xs w-full pointer-events-none">
            <AnimatePresence mode="popLayout">
                {/* Active Matches */}
                {activeMatches.map((match) => (
                    <motion.div
                        key={`active-${match.matchId}`}
                        initial={{ opacity: 0, x: -100, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -100, scale: 0.8 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="mb-2 pointer-events-auto"
                    >
                        <div className="bg-bg-secondary/90 backdrop-blur-lg rounded-xl border border-white/10 p-3 shadow-xl">
                            {/* Mode badge */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <span className={`text-[10px] font-bold tracking-wider ${getModeColor(match.gameMode)}`}>
                                    {getModeLabel(match.gameMode)} LIVE
                                </span>
                            </div>

                            {/* Players */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {match.player1Photo ? (
                                        <img src={match.player1Photo} className="w-6 h-6 rounded-full" alt="" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                            {match.player1Name.charAt(0)}
                                        </div>
                                    )}
                                    <span className="text-sm font-medium text-text-primary truncate">
                                        {match.player1Name}
                                    </span>
                                </div>

                                <span className="text-xs text-white/40 font-bold">VS</span>

                                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                    <span className="text-sm font-medium text-text-primary truncate">
                                        {match.isBotMatch ? 'Bot' : match.player2Name}
                                    </span>
                                    {match.player2Photo && !match.isBotMatch ? (
                                        <img src={match.player2Photo} className="w-6 h-6 rounded-full" alt="" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                            {match.isBotMatch ? (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/70">
                                                    <rect x="3" y="11" width="18" height="10" rx="2" />
                                                    <circle cx="12" cy="5" r="2" />
                                                    <path d="M12 7v4" />
                                                </svg>
                                            ) : (
                                                match.player2Name.charAt(0)
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}

                {/* Recent Results */}
                {recentResults.slice(0, 3).map((result) => (
                    <motion.div
                        key={`result-${result.matchId}`}
                        initial={{ opacity: 0, x: -100, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -100, scale: 0.8 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="mb-2 pointer-events-auto"
                    >
                        <div className="bg-bg-secondary/80 backdrop-blur-lg rounded-xl border border-white/5 p-3 shadow-lg">
                            {/* Mode badge */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-bold tracking-wider ${getModeColor(result.gameMode)}`}>
                                    {getModeLabel(result.gameMode)} {result.isTie ? 'TIE' : 'FINISHED'}
                                </span>
                            </div>

                            {/* Winner / Loser */}
                            {result.isTie ? (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-text-muted">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1">
                                            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                                            <path d="M9 12l2 2l4 -4" />
                                        </svg>
                                    </span>
                                    <span className="text-text-primary font-medium">{result.winnerName}</span>
                                    <span className="text-white/30">vs</span>
                                    <span className="text-text-primary font-medium">{result.loserName}</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                                            <path d="M8 21h8" />
                                            <path d="M12 17v4" />
                                            <path d="M7 4h10" />
                                            <path d="M17 4v8a5 5 0 0 1 -10 0v-8" />
                                            <circle cx="5" cy="9" r="2" />
                                            <circle cx="19" cy="9" r="2" />
                                        </svg>
                                        <span className="text-text-primary font-medium text-sm">{result.winnerName}</span>
                                        <span className="text-green-400/70 text-xs font-mono">{Math.round(result.winnerWpm)} WPM</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400/60">
                                            <circle cx="9" cy="12" r="1" />
                                            <circle cx="15" cy="12" r="1" />
                                            <path d="M8 20v2h8v-2" />
                                            <path d="M12.5 17l-.5 4" />
                                            <path d="M16 20a2 2 0 0 0 1.5 -2.5a9 9 0 1 0 -11 0a2 2 0 0 0 1.5 2.5" />
                                        </svg>
                                        <span className="text-text-muted text-sm">{result.loserName}</span>
                                        <span className="text-red-400/50 text-xs font-mono">{Math.round(result.loserWpm)} WPM</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
