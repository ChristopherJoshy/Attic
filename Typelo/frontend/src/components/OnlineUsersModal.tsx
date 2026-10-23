/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * OnlineUsersModal Component - Displays a list of currently online users.
 * Shows user display names and ELO ratings in a modal dialog.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * OnlineUsersModal: Main component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * isOpen: Modal visibility state.
 * users: List of online users to display.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * framer-motion: Animations.
 */

import { motion, AnimatePresence } from 'framer-motion'

export interface OnlineUser {
  userId: string
  displayName: string
  photoUrl?: string
  elo?: number
}

interface OnlineUsersModalProps {
  isOpen: boolean
  onClose: () => void
  users: OnlineUser[]
}

export default function OnlineUsersModal({ isOpen, onClose, users }: OnlineUsersModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
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
              className="bg-bg-secondary/95 border border-white/10 backdrop-blur-xl rounded-2xl w-full max-w-md overflow-hidden"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4 text-text-primary">Online Users</h2>
                <ul className="space-y-3 max-h-80 overflow-y-auto">
                  {users.length === 0 ? (
                    <li className="text-text-secondary text-center">No users online.</li>
                  ) : (
                    users.map(user => (
                      <li key={user.userId} className="flex items-center gap-3 p-2 rounded hover:bg-bg-primary/30">
                        <span className="font-medium text-text-primary">{user.displayName}</span>
                        {user.elo && (
                          <span className="ml-auto text-xs text-text-secondary">Elo: {user.elo}</span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
                <button
                  className="mt-6 w-full py-2 bg-bg-primary text-text-primary rounded-lg font-semibold hover:bg-bg-primary/80 transition"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
