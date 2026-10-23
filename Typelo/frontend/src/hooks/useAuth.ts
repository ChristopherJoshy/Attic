/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * useAuth Hook - Wrapper around authStore to provide simplified auth access.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * useAuth: Main hook function.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * user: Current user object.
 * stats: User statistics.
 * loading: Loading state.
 * error: Error state.
 * isAuthenticated: Boolean helper.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * stores/authStore: Zustand store.
 */

import { useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'

export function useAuth() {
  const {
    user,
    stats,
    loading,
    error,
    isGuest,
    signInWithGoogle,
    registerAsGuest,
    signInAsGuest,
    convertGuestToGoogle,
    signOut,
    clearError,
    refreshStats,
    updateStats
  } = useAuthStore()

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(clearError, 5000)
      return () => clearTimeout(timeout)
    }
  }, [error, clearError])

  return {
    user,
    stats,
    loading,
    error,
    isGuest,
    signInWithGoogle,
    registerAsGuest,
    signInAsGuest,
    convertGuestToGoogle,
    signOut,
    refreshStats,
    updateStats,
    isAuthenticated: !!user,
  }
}
