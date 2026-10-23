/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Connection Store - Manages backend connection health status.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * useConnectionStore: Zustand store hook.
 * checkConnection: Pings backend to verify connectivity.
 * startHealthCheck: Starts periodic health polling.
 * stopHealthCheck: Stops periodic polling.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * status: Connection status (connected/disconnected/checking).
 * lastCheck: Timestamp of last check.
 * retryCount: Check failure counter.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * zustand: State management.
 * config/api: Health check function.
 */

import { create } from 'zustand'
import { checkBackendHealth } from '../config/api'

type ConnectionStatus = 'checking' | 'connected' | 'disconnected'

interface ConnectionState {
  status: ConnectionStatus
  lastCheck: Date | null
  retryCount: number

  // Actions
  checkConnection: () => Promise<boolean>
  startHealthCheck: () => void
  stopHealthCheck: () => void
}

let healthCheckInterval: ReturnType<typeof setInterval> | null = null

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'checking',
  lastCheck: null,
  retryCount: 0,

  checkConnection: async () => {
    const isConnected = await checkBackendHealth()

    set({
      status: isConnected ? 'connected' : 'disconnected',
      lastCheck: new Date(),
      retryCount: isConnected ? 0 : get().retryCount + 1,
    })

    return isConnected
  },

  startHealthCheck: () => {
    // Initial check
    get().checkConnection()

    // Check every 10 seconds
    if (!healthCheckInterval) {
      healthCheckInterval = setInterval(() => {
        get().checkConnection()
      }, 10000)
    }
  },

  stopHealthCheck: () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval)
      healthCheckInterval = null
    }
  },
}))
