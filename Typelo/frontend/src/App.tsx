/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Main App Component - Handles routing and global initialization.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * App: The root component structure.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * user: Authenticated user state.
 * loading: Auth loading state.
 * connectionStatus: Global WebSocket/Server connection status.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core/hooks.
 * react-router-dom: Routing.
 * @vercel/analytics/react: Analytics.
 * stores: Zustand stores for state.
 * contexts: React contexts (WebSocket).
 * hooks: Custom hooks.
 * components: UI Components.
 */

import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { useAuthStore } from './stores/authStore'
import { useConnectionStore } from './stores/connectionStore'
import { useInventoryStore } from './stores/inventoryStore'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { useDevToolsDetection } from './hooks/useDevToolsDetection'
import Layout from './components/Layout'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Game from './components/Game'
import InvitePage from './components/InvitePage'
import ConnectionError from './components/ConnectionError'
import InstallBanner from './components/InstallBanner'
import UpdateBanner from './components/UpdateBanner'
import CursorEffect from './components/CursorEffect'
import FAQ from './components/FAQ'
import TypeloVsMonkeytype from './components/compare/TypeloVsMonkeytype'
import TypeloVsTypeRacer from './components/compare/TypeloVsTypeRacer'

function App() {
  const { user, loading, idToken } = useAuthStore()
  const { status: connectionStatus, startHealthCheck, stopHealthCheck } = useConnectionStore()
  const { equippedEffect, fetchInventory } = useInventoryStore()

  // Anti-cheat: disabled to prevent site reload issues
  // useDevToolsDetection()

  // Start health check on mount
  useEffect(() => {
    startHealthCheck()
    return () => stopHealthCheck()
  }, [startHealthCheck, stopHealthCheck])

  // Fetch inventory to get equipped effect if user logged in
  useEffect(() => {
    if (user && idToken) {
      fetchInventory(idToken)
    }
  }, [user, idToken])

  // Show connection error if disconnected
  if (connectionStatus === 'disconnected') {
    return <ConnectionError />
  }

  // Show loading while checking connection or auth
  if (connectionStatus === 'checking' || loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-primary gap-4">
        <div className="relative">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
        <p className="text-xs text-text-muted font-mono uppercase tracking-wider">
          {connectionStatus === 'checking' ? 'Connecting to server' : 'Loading'}
        </p>
      </div>
    )
  }

  return (
    <>
      <Analytics />
      <CursorEffect effectId={equippedEffect} />
      <WebSocketProvider>
        <Layout>
          <Routes>
            <Route
              path="/"
              element={user ? <Navigate to="/dashboard" replace /> : <Login />}
            />
            <Route
              path="/dashboard"
              element={user ? <Dashboard /> : <Navigate to="/" replace />}
            />
            <Route
              path="/game/:matchId"
              element={user ? <Game /> : <Navigate to="/" replace />}
            />
            <Route
              path="/invite/:code"
              element={<InvitePage />}
            />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/compare/typelo-vs-monkeytype" element={<TypeloVsMonkeytype />} />
            <Route path="/compare/typelo-vs-typeracer" element={<TypeloVsTypeRacer />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </WebSocketProvider>
      <InstallBanner />
      <UpdateBanner />
    </>
  )
}

export default App
