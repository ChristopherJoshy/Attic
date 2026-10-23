/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * useDevToolsDetection Hook - Detects and discourages browser DevTools usage.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * useDevToolsDetection: Main hook function.
 * checkWindowSize: Detects docked DevTools by resize events.
 * handleKeyDown: Detects DevTools keyboard shortcuts.
 * handleContextMenu: Disables right-click context menu.
 * handleDevToolsOpen: Action taken when detected (reload).
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * threshold: Pixel threshold for window resize detection.
 * devToolsOpen: Flag to prevent repeated handling.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 */

import { useEffect } from 'react'

export function useDevToolsDetection() {
    useEffect(() => {
        // Only enable in production
        if (import.meta.env.DEV) {
            console.log('DevTools detection disabled in development mode')
            return
        }

        let devToolsOpen = false

        // Method 1: Detect window resize when devtools opens (docked mode)
        const threshold = 160 // DevTools panel is usually at least 160px
        const checkWindowSize = () => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold
            const heightThreshold = window.outerHeight - window.innerHeight > threshold

            if (widthThreshold || heightThreshold) {
                if (!devToolsOpen) {
                    devToolsOpen = true
                    handleDevToolsOpen()
                }
            }
        }

        // Method 2: Keyboard shortcut detection
        const handleKeyDown = (e: KeyboardEvent) => {
            // F12
            if (e.key === 'F12') {
                e.preventDefault()
                handleDevToolsOpen()
                return
            }

            // Ctrl+Shift+I (Chrome DevTools)
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                e.preventDefault()
                handleDevToolsOpen()
                return
            }

            // Ctrl+Shift+J (Chrome Console)
            if (e.ctrlKey && e.shiftKey && e.key === 'J') {
                e.preventDefault()
                handleDevToolsOpen()
                return
            }

            // Ctrl+Shift+C (Chrome Inspect Element)
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault()
                handleDevToolsOpen()
                return
            }

            // Cmd+Option+I (Mac)
            if (e.metaKey && e.altKey && e.key === 'i') {
                e.preventDefault()
                handleDevToolsOpen()
                return
            }
        }

        // Method 3: Disable right-click context menu
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
            return false
        }

        // Handler when devtools is detected
        const handleDevToolsOpen = () => {
            // Reload the page
            window.location.reload()
        }

        // Add event listeners
        window.addEventListener('resize', checkWindowSize)
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('contextmenu', handleContextMenu)

        // Check periodically for devtools
        const intervalId = setInterval(checkWindowSize, 1000)

        return () => {
            window.removeEventListener('resize', checkWindowSize)
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('contextmenu', handleContextMenu)
            clearInterval(intervalId)
        }
    }, [])
}
