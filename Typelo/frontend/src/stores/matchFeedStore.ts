/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Match Feed Store - Manages live feed of public matches happening on the server.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * useMatchFeedStore: Zustand store hook.
 * addMatch: Adds a new active match to feed.
 * removeMatch: Removes a match.
 * endMatch: Moves match from active to results.
 * removeResult: Removes a result.
 * clearFeed: Clears all feed data.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * activeMatches: List of currently playing matches.
 * recentResults: List of recently finished matches.
 * maxResults: Limit for history list.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * zustand: State management.
 */

import { create } from 'zustand'

export interface PublicMatchStarted {
    matchId: string
    player1Name: string
    player1Photo?: string
    player2Name: string
    player2Photo?: string
    isBotMatch: boolean
    gameMode: string
    timestamp: number
}

export interface PublicMatchEnded {
    matchId: string
    winnerName: string
    winnerPhoto?: string
    loserName: string
    loserPhoto?: string
    winnerWpm: number
    loserWpm: number
    isTie: boolean
    gameMode: string
    timestamp: number
}

interface MatchFeedStore {
    activeMatches: PublicMatchStarted[]
    recentResults: PublicMatchEnded[]
    maxResults: number

    addMatch: (match: PublicMatchStarted) => void
    removeMatch: (matchId: string) => void
    endMatch: (result: PublicMatchEnded) => void
    removeResult: (matchId: string) => void
    clearFeed: () => void
}

const DISPLAY_DURATION = 5000 // 5 seconds

export const useMatchFeedStore = create<MatchFeedStore>((set, get) => ({
    activeMatches: [],
    recentResults: [],
    maxResults: 5,

    addMatch: (match) => {
        set((state) => ({
            activeMatches: [...state.activeMatches, match]
        }))
        // Auto-remove after 3 seconds (match will also be removed when it ends)
        setTimeout(() => {
            get().removeMatch(match.matchId)
        }, DISPLAY_DURATION)
    },

    removeMatch: (matchId) => set((state) => ({
        activeMatches: state.activeMatches.filter(m => m.matchId !== matchId)
    })),

    endMatch: (result) => {
        set((state) => ({
            // Remove from active matches
            activeMatches: state.activeMatches.filter(m => m.matchId !== result.matchId),
            // Add to recent results (keep only last maxResults)
            recentResults: [result, ...state.recentResults].slice(0, state.maxResults)
        }))
        // Auto-remove result after 3 seconds
        setTimeout(() => {
            get().removeResult(result.matchId)
        }, DISPLAY_DURATION)
    },

    removeResult: (matchId) => set((state) => ({
        recentResults: state.recentResults.filter(r => r.matchId !== matchId)
    })),

    clearFeed: () => set({
        activeMatches: [],
        recentResults: []
    })
}))
