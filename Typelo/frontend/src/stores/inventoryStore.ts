/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Inventory Store - Manages user's coins, unlocked cursors, effects, and profile items.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * useInventoryStore: Zustand store hook.
 * fetchInventory: Loads cursor/effect inventory from API.
 * fetchProfileInventory: Loads profile backgrounds/effects/borders from API.
 * updateCoins: Updates coin balance.
 * addCoins: Optimistically adds coins.
 * addAfkCoins: Adds AFK coins and syncs with backend.
 * addCursor: Adds a new cursor to unlocked list.
 * setEquipped: Sets the equipped cursor.
 * spinProfileCrate: Spins the profile crate for 1000 coins.
 * equipBackground/equipProfileEffect/equipBorder: Equip profile items.
 * reset: Resets store to defaults.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * InventoryStore: Interface for store state and actions.
 * SPIN_COST: Cost to spin cursor/effect gacha (50 coins).
 * PROFILE_SPIN_COST: Cost to spin profile gacha (1000 coins).
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * zustand: State management.
 */

import { create } from 'zustand'
import { getInventory, equipCursor as equipCursorApi, equipItem, spinGacha, getProfileInventory, spinProfileCrate as spinProfileCrateApi, equipProfileItem, claimRankRewards, claimAfkCoins as claimAfkCoinsApi } from '../config/api'
import type { SpinResult, ProfileSpinResult } from '../types'

export const SPIN_COST = 1000  // Both crates cost 1000
export const PROFILE_SPIN_COST = 1000  // Both crates cost 1000

interface InventoryStore {
    // Cursor/Effect state
    coins: number
    unlockedCursors: string[]
    equippedCursor: string
    unlockedEffects: string[]
    equippedEffect: string | null
    pityActive: boolean
    pityStreak: number
    cratesOpened: number

    // Profile items state
    unlockedBackgrounds: string[]
    equippedBackground: string | null
    unlockedProfileEffects: string[]
    equippedProfileEffect: string | null
    unlockedBorders: string[]
    equippedBorder: string | null
    profilePityActive: boolean
    profilePityStreak: number
    profileCratesOpened: number

    isLoading: boolean
    error: string | null

    // Cursor/Effect actions
    fetchInventory: (token: string) => Promise<void>
    updateCoins: (coins: number) => void
    addCoins: (amount: number) => void
    addAfkCoins: (amount: number, token: string) => Promise<boolean>
    addCursor: (cursorId: string) => void
    addEffect: (effectId: string) => void
    setEquipped: (cursorId: string) => void
    setEquippedEffect: (effectId: string | null) => void
    equipCursor: (cursorId: string, token: string) => Promise<boolean>
    equipEffect: (effectId: string, token: string) => Promise<boolean>
    spin: (token: string, customCost?: number) => Promise<SpinResult | null>

    // Profile actions
    fetchProfileInventory: (token: string) => Promise<void>
    spinProfileCrate: (token: string, customCost?: number) => Promise<ProfileSpinResult | null>
    equipBackground: (bgId: string, token: string) => Promise<boolean>
    equipProfileEffect: (effectId: string, token: string) => Promise<boolean>
    equipBorder: (borderId: string, token: string) => Promise<boolean>
    claimRankReward: (token: string) => Promise<{ success: boolean; message?: string }>

    reset: () => void
}

export const useInventoryStore = create<InventoryStore>((set, get) => ({
    // Cursor/Effect state
    coins: 0,
    unlockedCursors: ['default'],
    equippedCursor: 'default',
    unlockedEffects: [],
    equippedEffect: null,
    pityActive: false,
    pityStreak: 0,
    cratesOpened: 0,

    // Profile items state
    unlockedBackgrounds: [],
    equippedBackground: null,
    unlockedProfileEffects: [],
    equippedProfileEffect: null,
    unlockedBorders: [],
    equippedBorder: null,
    profilePityActive: false,
    profilePityStreak: 0,
    profileCratesOpened: 0,

    isLoading: false,
    error: null,

    fetchInventory: async (token: string) => {
        set({ isLoading: true, error: null })
        try {
            const data = await getInventory(token)
            set({
                coins: data.coins,
                unlockedCursors: data.unlockedCursors,
                equippedCursor: data.equippedCursor,
                unlockedEffects: data.unlockedEffects,
                equippedEffect: data.equippedEffect,
                pityActive: data.pityActive,
                pityStreak: data.pityStreak,
                cratesOpened: data.cratesOpened,
                isLoading: false,
            })
        } catch (e) {
            set({ error: 'Failed to load inventory', isLoading: false })
        }
    },

    fetchProfileInventory: async (token: string) => {
        try {
            const data = await getProfileInventory(token)
            set({
                unlockedBackgrounds: data.unlockedBackgrounds,
                equippedBackground: data.equippedBackground,
                unlockedProfileEffects: data.unlockedProfileEffects,
                equippedProfileEffect: data.equippedProfileEffect,
                unlockedBorders: data.unlockedBorders,
                equippedBorder: data.equippedBorder,
                profilePityActive: data.profilePityActive,
                profilePityStreak: data.profilePityStreak,
                profileCratesOpened: data.profileCratesOpened,
            })
        } catch (e) {
            set({ error: 'Failed to load profile inventory' })
        }
    },

    updateCoins: (coins: number) => set({ coins }),

    addCoins: (amount: number) => set((state) => ({ coins: state.coins + amount })),

    addAfkCoins: async (amount: number, token: string) => {
        try {
            // Optimistic update so UI feels responsive
            set((state) => ({ coins: state.coins + amount }))

            // Confirm with backend
            const result = await claimAfkCoinsApi(token, amount)

            if (result.success) {
                // Sync with server balance just in case
                set({ coins: result.new_balance })
                return true
            } else {
                // Revert if failed
                set((state) => ({ coins: state.coins - amount }))
                return false
            }
        } catch (e) {
            // Revert if error
            set((state) => ({ coins: state.coins - amount }))
            return false
        }
    },

    addCursor: (cursorId: string) => set((state) => ({
        unlockedCursors: state.unlockedCursors.includes(cursorId)
            ? state.unlockedCursors
            : [...state.unlockedCursors, cursorId]
    })),

    addEffect: (effectId: string) => set((state) => ({
        unlockedEffects: state.unlockedEffects.includes(effectId)
            ? state.unlockedEffects
            : [...state.unlockedEffects, effectId]
    })),

    setEquipped: (cursorId: string) => set({ equippedCursor: cursorId }),

    setEquippedEffect: (effectId: string | null) => set({ equippedEffect: effectId }),

    equipCursor: async (cursorId: string, token: string) => {
        try {
            await equipItem(cursorId, 'cursor', token)
            set({ equippedCursor: cursorId })
            return true
        } catch {
            return false
        }
    },

    equipEffect: async (effectId: string, token: string) => {
        try {
            const idToEquip = effectId === 'none' ? 'none' : effectId
            await equipItem(idToEquip, 'effect', token)
            set({ equippedEffect: effectId === 'none' ? null : effectId })
            return true
        } catch {
            return false
        }
    },

    spin: async (token: string, customCost?: number) => {
        const { coins } = get()
        const cost = customCost ?? SPIN_COST
        if (coins < cost) {
            set({ error: 'Not enough coins' })
            return null
        }

        // Optimistic update
        set((state) => ({ coins: state.coins - cost }))

        try {
            const result = await spinGacha(token)

            if (result.type === 'cursor' && result.cursorId) {
                set((state) => ({
                    unlockedCursors: state.unlockedCursors.includes(result.cursorId!)
                        ? state.unlockedCursors
                        : [...state.unlockedCursors, result.cursorId!]
                }))
            } else if (result.type === 'effect' && result.effectId) {
                set((state) => ({
                    unlockedEffects: state.unlockedEffects.includes(result.effectId!)
                        ? state.unlockedEffects
                        : [...state.unlockedEffects, result.effectId!]
                }))
            } else if (result.type === 'coins' && result.coinsWon) {
                set((state) => ({ coins: state.coins + (result.coinsWon || 0) }))
            }

            set((state) => ({
                cratesOpened: state.cratesOpened + 1,
                pityActive: result.pityActivated ?? state.pityActive,
                pityStreak: result.pityStreak ?? state.pityStreak
            }))

            return result
        } catch (error) {
            // Revert on failure
            set((state) => ({ coins: state.coins + cost }))
            console.error('Spin failed:', error)
            set({ error: 'Spin failed' })
            return null
        }
    },

    spinProfileCrate: async (token: string, customCost?: number) => {
        const { coins } = get()
        const cost = customCost ?? PROFILE_SPIN_COST
        if (coins < cost) {
            set({ error: 'Not enough coins for profile crate' })
            return null
        }

        // Optimistic update
        set((state) => ({ coins: state.coins - cost }))

        try {
            const result = await spinProfileCrateApi(token)

            if (result.type === 'background' && result.itemId) {
                set((state) => ({
                    unlockedBackgrounds: state.unlockedBackgrounds.includes(result.itemId!)
                        ? state.unlockedBackgrounds
                        : [...state.unlockedBackgrounds, result.itemId!]
                }))
            } else if (result.type === 'profile_effect' && result.itemId) {
                set((state) => ({
                    unlockedProfileEffects: state.unlockedProfileEffects.includes(result.itemId!)
                        ? state.unlockedProfileEffects
                        : [...state.unlockedProfileEffects, result.itemId!]
                }))
            } else if (result.type === 'border' && result.itemId) {
                set((state) => ({
                    unlockedBorders: state.unlockedBorders.includes(result.itemId!)
                        ? state.unlockedBorders
                        : [...state.unlockedBorders, result.itemId!]
                }))
            }

            set((state) => ({
                profileCratesOpened: state.profileCratesOpened + 1,
                profilePityActive: result.pityActivated ?? state.profilePityActive,
                profilePityStreak: result.pityStreak ?? state.profilePityStreak
            }))

            return result
        } catch (e) {
            // Revert on failure
            set((state) => ({ coins: state.coins + cost }))
            set({ error: 'Profile spin failed' })
            return null
        }
    },

    equipBackground: async (bgId: string, token: string) => {
        try {
            const idToEquip = bgId === 'none' ? 'none' : bgId
            await equipProfileItem(idToEquip, 'background', token)
            set({ equippedBackground: bgId === 'none' ? null : bgId })
            return true
        } catch {
            return false
        }
    },

    equipProfileEffect: async (effectId: string, token: string) => {
        try {
            const idToEquip = effectId === 'none' ? 'none' : effectId
            await equipProfileItem(idToEquip, 'profile_effect', token)
            set({ equippedProfileEffect: effectId === 'none' ? null : effectId })
            return true
        } catch {
            return false
        }
    },

    equipBorder: async (borderId: string, token: string) => {
        try {
            const idToEquip = borderId === 'none' ? 'none' : borderId
            await equipProfileItem(idToEquip, 'border', token)
            set({ equippedBorder: borderId === 'none' ? null : borderId })
            return true
        } catch {
            return false
        }
    },

    claimRankReward: async (token: string) => {
        try {
            const result = await claimRankRewards(token)
            if (result.status === 'success' && result.claimed_item) {
                set((state) => ({
                    unlockedBackgrounds: state.unlockedBackgrounds.includes(result.claimed_item!)
                        ? state.unlockedBackgrounds
                        : [...state.unlockedBackgrounds, result.claimed_item!]
                }))
                return { success: true, message: 'Reward unlocked!' }
            } else if (result.status === 'already_owned') {
                return { success: true, message: 'Already unlocked.' }
            }
            return { success: false, message: result.message || 'No reward available' }
        } catch {
            return { success: false, message: 'Claim failed' }
        }
    },


    reset: () => set({
        coins: 0,
        unlockedCursors: ['default'],
        equippedCursor: 'default',
        unlockedEffects: [],
        equippedEffect: null,
        pityActive: false,
        pityStreak: 0,
        cratesOpened: 0,
        unlockedBackgrounds: [],
        equippedBackground: null,
        unlockedProfileEffects: [],
        equippedProfileEffect: null,
        unlockedBorders: [],
        equippedBorder: null,
        profilePityActive: false,
        profilePityStreak: 0,
        profileCratesOpened: 0,
        isLoading: false,
        error: null,
    }),
}))
