/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Online Store - Manages online users data.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * useOnlineStore: Zustand store hook.
 * setCount: Update online count.
 * setUsers: Update online users list.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * count: Number of users online.
 * users: List of user objects.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * zustand: State management.
 */

import { create } from 'zustand'


export interface OnlineUser {
  userId: string
  displayName: string
  photoUrl?: string
  elo?: number
}

interface OnlineStore {
  count: number
  users: OnlineUser[]
  setCount: (count: number) => void
  setUsers: (users: OnlineUser[]) => void
}

export const useOnlineStore = create<OnlineStore>((set) => ({
  count: 0,
  users: [],
  setCount: (count: number) => set({ count }),
  setUsers: (users: OnlineUser[]) => set({ users }),
}))
