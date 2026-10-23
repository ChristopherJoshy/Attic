/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * UpdateBanner Component - Checks for application updates (new deployments).
 * Prompts the user to refresh the page when a new version is detected.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * UpdateBanner: Main component.
 * checkForUpdates: Fetches version.json to check for new build timestamp.
 * handleRefresh: Refreshes the page and updates service worker.
 * handleDismiss: Closes the banner.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * VERSION_CHECK_INTERVAL: Interval in ms to check for updates.
 * showBanner: Visibility state.
 * currentVersion: Stores the currently detected version/timestamp.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const VERSION_CHECK_INTERVAL = 60000 // 60 seconds

export default function UpdateBanner() {
    const [showBanner, setShowBanner] = useState(false)
    const [currentVersion, setCurrentVersion] = useState<string | null>(null)

    const checkForUpdates = useCallback(async () => {
        try {
            // Add cache-busting query param
            const response = await fetch(`/version.json?t=${Date.now()}`)
            if (!response.ok) return

            const data = await response.json()
            const newVersion = data.buildTime

            if (currentVersion && currentVersion !== newVersion) {
                setShowBanner(true)
            } else if (!currentVersion) {
                setCurrentVersion(newVersion)
            }
        } catch (e) {
            // Silently fail - network issues shouldn't show errors
        }
    }, [currentVersion])

    useEffect(() => {
        // Initial check
        checkForUpdates()

        // Periodic checks
        const interval = setInterval(checkForUpdates, VERSION_CHECK_INTERVAL)
        return () => clearInterval(interval)
    }, [checkForUpdates])

    const handleRefresh = () => {
        // Tell service worker to skip waiting
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('skipWaiting')
        }
        window.location.reload()
    }

    const handleDismiss = () => {
        setShowBanner(false)
        // Update current version so we don't show again for this version
        setCurrentVersion(null)
    }

    if (!showBanner) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-4 left-4 right-4 z-[100] sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:max-w-md"
            >
                <div className="bg-[#0a0a0a] border border-accent-focus/30 rounded-xl p-3 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div className="w-8 h-8 rounded-lg bg-accent-focus/10 flex items-center justify-center flex-shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-focus">
                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                <path d="M16 16h5v5" />
                            </svg>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">Update available</p>
                        </div>

                        {/* Buttons */}
                        <button
                            onClick={handleRefresh}
                            className="px-3 py-1.5 bg-accent-focus text-white text-xs font-bold rounded-lg hover:bg-accent-focus/80 transition-colors"
                        >
                            Refresh
                        </button>

                        {/* Close */}
                        <button
                            onClick={handleDismiss}
                            className="p-1 text-white/30 hover:text-white/60 transition-colors"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
