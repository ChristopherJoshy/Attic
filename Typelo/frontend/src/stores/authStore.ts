/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Auth Store - Manages user authentication state and statistics.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * useAuthStore: Zustand store hook.
 * initialize: Sets up Firebase auth listener.
 * signInWithGoogle: Handles Google sign-in flow.
 * signOut: Handles sign-out.
 * refreshStats: Fetches latest stats from backend.
 * updateStats: Optimistically updates local stats.
 * refreshToken: Refreshes Firebase ID token.
 * clearError: Resets error state.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * user: Authenticated user object.
 * stats: User game statistics.
 * loading: Auth loading status.
 * error: Error message.
 * idToken: Firebase ID token for API requests.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * zustand: State management.
 * firebase/auth: Auth SDK.
 * config: Firebase and API config.
 */

import { create } from 'zustand'
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'
import { verifyToken, getUserProfile } from '../config/api'
import { DEFAULT_ELO } from '../constants'
import type { User, UserStats, Rank } from '../types'

interface AuthState {
  user: User | null
  stats: UserStats | null
  loading: boolean
  error: string | null
  idToken: string | null
  isGuest: boolean

  // Actions
  initialize: () => void
  signInWithGoogle: () => Promise<void>
  registerAsGuest: (username: string, password: string) => Promise<void>
  signInAsGuest: (username: string, password: string) => Promise<void>
  convertGuestToGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateStats: (stats: Partial<UserStats>) => void
  refreshStats: () => Promise<void>
  refreshToken: () => Promise<string | null>
  clearError: () => void
}

const defaultStats: UserStats = {
  currentElo: DEFAULT_ELO,
  peakElo: DEFAULT_ELO,
  rank: 'Unranked' as Rank,
  totalMatches: 0,
  wins: 0,
  losses: 0,
  avgWpm: 0,
  avgAccuracy: 0,
  bestWpm: 0,
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  stats: null,
  loading: true,
  error: null,
  idToken: null,
  isGuest: false,

  initialize: () => {
    // Check for existing guest session
    const guestToken = localStorage.getItem('guest_token')
    const guestUserStr = localStorage.getItem('guest_user')

    if (guestToken && guestUserStr) {
      try {
        const guestUser = JSON.parse(guestUserStr)
        set({
          user: guestUser,
          idToken: guestToken,
          isGuest: true,
          loading: false,
          stats: defaultStats
        })
        // Don't set up Firebase listener for guest users
        return
      } catch (e) {
        // Invalid guest data, clear it
        localStorage.removeItem('guest_token')
        localStorage.removeItem('guest_user')
      }
    }


    onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      // Clear any existing refresh interval
      if ((window as any)._tokenRefreshInterval) {
        clearInterval((window as any)._tokenRefreshInterval)
          ; (window as any)._tokenRefreshInterval = null
      }

      if (firebaseUser) {
        try {
          // Get ID token for API auth (force refresh to ensure fresh token)
          const idToken = await firebaseUser.getIdToken(true)

          const user: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Anonymous',
            photoURL: firebaseUser.photoURL,
          }

          set({ user, idToken, loading: false })

            // Set up automatic token refresh every 50 minutes
            ; (window as any)._tokenRefreshInterval = window.setInterval(async () => {
              try {
                const freshToken = await firebaseUser.getIdToken(true)
                set({ idToken: freshToken })
                console.log('Firebase token refreshed automatically')

                // Also refresh stats when token refreshes
                get().refreshStats()
              } catch (err) {
                console.error('Failed to refresh token:', err)
              }
            }, 50 * 60 * 1000) // 50 minutes

          // Set up periodic stats refresh every 2 minutes (keeps UI updated silently)
          const statsRefreshInterval = window.setInterval(() => {
            // Silent refresh - no loading state changes
            get().refreshStats()
          }, 2 * 60 * 1000) // 2 minutes

            // Store interval for cleanup (we'll clear it when user signs out)
            ; (window as any)._statsRefreshInterval = statsRefreshInterval

          // Fetch stats from backend
          try {
            const profile = await getUserProfile(idToken)
            const stats: UserStats = {
              currentElo: profile.elo_rating,
              peakElo: profile.peak_elo,
              rank: profile.rank as Rank,
              totalMatches: profile.total_matches,
              wins: profile.wins,
              losses: profile.losses,
              avgWpm: profile.avg_wpm,
              avgAccuracy: profile.avg_accuracy,
              bestWpm: profile.best_wpm,
            }
            set({ stats })
          } catch (err) {
            console.warn('Failed to fetch user profile, using defaults:', err)
            set({ stats: defaultStats })
          }
        } catch (err) {
          console.error('Auth initialization error:', err)
          set({ user: null, stats: null, loading: false })
        }
      } else {
        set({ user: null, stats: null, idToken: null, loading: false })
      }
    })
  },

  signInWithGoogle: async () => {
    try {
      set({ loading: true, error: null })
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user

      // Get ID token
      const idToken = await firebaseUser.getIdToken()

      // Verify with backend (creates user if doesn't exist)
      try {
        const referralCode = localStorage.getItem('referral_code')
        const backendUser = await verifyToken(idToken, referralCode)

        // Clear referral code after successful use
        if (referralCode) localStorage.removeItem('referral_code')

        // If referral bonus was applied, store flag for showing popup (only once)
        if (backendUser.referral_bonus_applied && backendUser.is_new_user) {
          localStorage.setItem('show_referral_bonus_popup', 'true')
        }

        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Anonymous',
          photoURL: firebaseUser.photoURL,
        }

        const stats: UserStats = {
          currentElo: backendUser.elo_rating,
          peakElo: backendUser.elo_rating,
          rank: backendUser.rank as Rank,
          totalMatches: 0,
          wins: 0,
          losses: 0,
          avgWpm: 0,
          avgAccuracy: 0,
          bestWpm: 0,
        }

        set({ user, stats, idToken, loading: false })

        // Fetch full profile
        get().refreshStats()
      } catch (err) {
        console.warn('Backend verification failed, using local data:', err)
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Anonymous',
          photoURL: firebaseUser.photoURL,
        }
        set({ user, stats: defaultStats, idToken, loading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Sign in failed',
        loading: false
      })
    }
  },

  registerAsGuest: async (username: string, password: string) => {
    try {
      set({ loading: true, error: null })

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/guest/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Registration failed')
      }

      const data = await response.json()

      const user: User = {
        uid: data.uid,
        email: '',
        displayName: data.display_name,
        photoURL: null
      }

      // Store guest session in localStorage
      localStorage.setItem('guest_token', data.token)
      localStorage.setItem('guest_user', JSON.stringify(user))

      set({
        user,
        stats: defaultStats,
        idToken: data.token,
        isGuest: true,
        loading: false
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Registration failed',
        loading: false
      })
      throw error
    }
  },

  signInAsGuest: async (username: string, password: string) => {
    try {
      set({ loading: true, error: null })

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/guest/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Login failed')
      }

      const data = await response.json()

      const user: User = {
        uid: data.uid,
        email: '',
        displayName: data.display_name,
        photoURL: null
      }

      // Store guest session in localStorage
      localStorage.setItem('guest_token', data.token)
      localStorage.setItem('guest_user', JSON.stringify(user))

      // Set initial stats from server response
      const initialStats: UserStats = {
        currentElo: data.elo_rating || DEFAULT_ELO,
        peakElo: data.elo_rating || DEFAULT_ELO,
        rank: data.rank as Rank || 'Unranked',
        totalMatches: 0,
        wins: 0,
        losses: 0,
        avgWpm: 0,
        avgAccuracy: 0,
        bestWpm: 0,
      }

      set({
        user,
        stats: initialStats,
        idToken: data.token,
        isGuest: true,
        loading: false
      })

      // Fetch full stats from profile endpoint
      get().refreshStats()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        loading: false
      })
      throw error
    }
  },

  convertGuestToGoogle: async () => {
    const { idToken: guestToken, isGuest } = get()
    if (!isGuest || !guestToken) {
      throw new Error('Not logged in as guest')
    }

    try {
      set({ loading: true, error: null })

      // Sign in with Google to get Firebase token
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseToken = await result.user.getIdToken()

      // Call conversion endpoint
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/guest/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: firebaseToken,
          guest_token: guestToken
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Conversion failed')
      }

      // Clear guest session
      localStorage.removeItem('guest_token')
      localStorage.removeItem('guest_user')

      // Set up new Google user
      const user: User = {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || 'Anonymous',
        photoURL: result.user.photoURL
      }

      set({
        user,
        idToken: firebaseToken,
        isGuest: false,
        loading: false
      })

      // Show conversion bonus notification
      localStorage.setItem('show_conversion_bonus_popup', 'true')

      // Fetch updated stats
      get().refreshStats()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Conversion failed',
        loading: false
      })
      throw error
    }
  },

  signOut: async () => {
    const { isGuest } = get()

    try {
      // Clean up intervals
      if ((window as any)._tokenRefreshInterval) {
        clearInterval((window as any)._tokenRefreshInterval)
          ; (window as any)._tokenRefreshInterval = null
      }
      if ((window as any)._statsRefreshInterval) {
        clearInterval((window as any)._statsRefreshInterval)
          ; (window as any)._statsRefreshInterval = null
      }

      // Clear guest session if applicable
      if (isGuest) {
        localStorage.removeItem('guest_token')
        localStorage.removeItem('guest_user')
      } else {
        await firebaseSignOut(auth)
      }

      set({ user: null, stats: null, idToken: null, isGuest: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Sign out failed'
      })
    }
  },

  refreshStats: async () => {
    const { idToken } = get()
    if (!idToken) return

    try {
      const profile = await getUserProfile(idToken)
      const stats: UserStats = {
        currentElo: profile.elo_rating,
        peakElo: profile.peak_elo,
        rank: profile.rank as Rank,
        totalMatches: profile.total_matches,
        wins: profile.wins,
        losses: profile.losses,
        avgWpm: profile.avg_wpm,
        avgAccuracy: profile.avg_accuracy,
        bestWpm: profile.best_wpm,
      }
      set({ stats })
    } catch (err) {
      console.error('Failed to refresh stats:', err)
    }
  },

  updateStats: (newStats: Partial<UserStats>) => {
    const currentStats = get().stats || defaultStats
    set({
      stats: {
        ...currentStats,
        ...newStats,
        peakElo: Math.max(
          currentStats.peakElo,
          newStats.currentElo || currentStats.currentElo
        ),
      }
    })
  },

  refreshToken: async () => {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) return null

      const freshToken = await currentUser.getIdToken(true)
      set({ idToken: freshToken })
      return freshToken
    } catch (err) {
      console.error('Failed to refresh token:', err)
      return null
    }
  },

  clearError: () => set({ error: null }),
}))

// Initialize auth listener on module load
useAuthStore.getState().initialize()
