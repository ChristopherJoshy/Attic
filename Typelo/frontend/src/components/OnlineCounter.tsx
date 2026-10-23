/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * OnlineCounter Component - Displays the number of concurrent online users.
 * Floats in the bottom-right corner and opens the `OnlineUsersModal` when clicked.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * OnlineCounter: Main component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * count: Total online users count.
 * users: List of online users.
 * user: Current logged-in user.
 * modalOpen: State for modal visibility.
 * filteredUsers: Online users list excluding current user.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 * stores: Online and Auth stores.
 * components: OnlineUsersModal.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useOnlineStore } from '../stores/onlineStore'
import { useAuthStore } from '../stores/authStore'
import OnlineUsersModal from './OnlineUsersModal'

export default function OnlineCounter() {
  const { count, users } = useOnlineStore()
  const { user } = useAuthStore()
  const [modalOpen, setModalOpen] = useState(false)

  // Filter out current user from the list
  const filteredUsers = user ? users.filter(u => u.userId !== user.uid) : users

  if (count === 0) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <button
          className="flex items-center gap-2 px-3 py-2 bg-bg-secondary/80 backdrop-blur-md border border-white/10 rounded-lg shadow-lg focus:outline-none"
          onClick={() => setModalOpen(true)}
          aria-label="Show online users"
        >
          <div className="relative">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
          </div>
          <span className="text-sm text-text-secondary font-medium">
            <span className="text-text-primary font-bold">{count}</span> online
          </span>
        </button>
      </motion.div>
      <OnlineUsersModal isOpen={modalOpen} onClose={() => setModalOpen(false)} users={filteredUsers} />
    </>
  )
}
