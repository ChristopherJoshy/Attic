/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * InventoryModal - Displays user's unlocked cursors and allows equipping.
 * Redesigned for a minimal and futuristic aesthetic.
 */

import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useInventoryStore } from '../stores/inventoryStore'
import { useAuthStore } from '../stores/authStore'
import {
    CURSORS, EFFECTS, getRarityColor, getCursorInfo, getEffectInfo,
    PROFILE_BACKGROUNDS, PROFILE_EFFECTS as PROFILE_EFFECTS_DATA, PROFILE_BORDERS,
    getProfileBackgroundInfo, getProfileEffectInfo, getProfileBorderInfo
} from '../types'
import { getItemStats } from '../config/api'
import AvatarDecoration, { EFFECT_TO_DECORATION, BORDER_TO_DECORATION } from './AvatarDecoration'

interface InventoryModalProps {
    isOpen: boolean
    onClose: () => void
}

const EffectIcon = ({ color }: { color: string }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" className="drop-shadow-lg">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
)


export default function InventoryModal({ isOpen, onClose }: InventoryModalProps) {
    const { idToken } = useAuthStore()
    const {
        coins,
        unlockedCursors,
        equippedCursor,
        unlockedEffects,
        equippedEffect,
        fetchInventory,
        equipCursor,
        equipEffect,
        isLoading,
        unlockedBackgrounds,
        equippedBackground,
        unlockedProfileEffects,
        equippedProfileEffect,
        unlockedBorders,
        equippedBorder,
        fetchProfileInventory,
        equipBackground,
        equipProfileEffect,
        equipBorder
    } = useInventoryStore()

    const [activeTab, setActiveTab] = useState<'cursors' | 'effects' | 'profile'>('cursors')
    const [profileSubTab, setProfileSubTab] = useState<'backgrounds' | 'effects' | 'borders'>('backgrounds')
    const [itemCounts, setItemCounts] = useState<{ cursor_counts: Record<string, number>; effect_counts: Record<string, number> } | null>(null)

    useEffect(() => {
        if (isOpen && idToken) {
            fetchInventory(idToken)
            fetchProfileInventory(idToken)
        }
        if (isOpen) {
            getItemStats().then(setItemCounts).catch(() => { })
        }
    }, [isOpen, idToken, fetchInventory, fetchProfileInventory])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const handleEquipCursor = async (cursorId: string) => {
        if (idToken && cursorId !== equippedCursor) {
            await equipCursor(cursorId, idToken)
        }
    }

    const handleEquipEffect = async (effectId: string) => {
        if (idToken && effectId !== equippedEffect) {
            await equipEffect(effectId, idToken)
        }
    }

    const handleEquipBackground = async (bgId: string) => {
        if (idToken) {
            await equipBackground(bgId, idToken)
        }
    }

    const handleEquipProfileEffect = async (effectId: string) => {
        if (idToken) {
            await equipProfileEffect(effectId, idToken)
        }
    }

    const handleEquipBorder = async (borderId: string) => {
        if (idToken) {
            await equipBorder(borderId, idToken)
        }
    }

    const allCursors = Object.keys(CURSORS)
    const allEffects = Object.keys(EFFECTS)
    const allBackgrounds = Object.keys(PROFILE_BACKGROUNDS)
    const allProfileEffects = Object.keys(PROFILE_EFFECTS_DATA)
    const allBorders = Object.keys(PROFILE_BORDERS)

    const modal = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-4xl h-[85vh] bg-[#0A0A0A] border border-white/[0.05] rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex-none px-8 py-6 border-b border-white/[0.05] bg-[#0A0A0A]/50 backdrop-blur-xl flex items-center justify-between z-20">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
                                        <path d="M20 7h-9M20 11h-9M14 15H4M14 19H4" />
                                        <rect x="4" y="7" width="4" height="4" rx="1" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">Inventory</h2>
                                    <p className="text-xs text-white/40 font-medium">Manage your digital assets</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                {/* Coins Display */}
                                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-yellow-500/5 border border-yellow-500/20">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                    <span className="text-sm font-mono font-bold text-yellow-500">{coins.toLocaleString()}</span>
                                    <span className="text-xs text-yellow-500/50 uppercase tracking-wider font-bold">Coins</span>
                                </div>

                                {/* Close Button */}
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex-none px-8 pt-6 pb-2">
                            <div className="flex items-center gap-8 border-b border-white/[0.05]">
                                {(['cursors', 'effects', 'profile'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`pb-4 text-sm font-medium transition-all relative ${activeTab === tab
                                            ? 'text-white'
                                            : 'text-white/40 hover:text-white/70'
                                            }`}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        {activeTab === tab && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500"
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 overflow-hidden relative">
                            {isLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 border-2 border-white/10 border-t-cyan-400 rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="h-full overflow-y-auto px-8 py-6 custom-scrollbar">
                                    {/* Sub-tabs for Profile */}
                                    {activeTab === 'profile' && (
                                        <div className="flex gap-2 mb-8 p-1 bg-white/[0.03] rounded-xl w-fit border border-white/[0.05]">
                                            {(['backgrounds', 'effects', 'borders'] as const).map((subTab) => {
                                                const getCount = () => {
                                                    if (subTab === 'backgrounds') return `${unlockedBackgrounds.length}/${allBackgrounds.length}`
                                                    if (subTab === 'effects') return `${unlockedProfileEffects.length}/${allProfileEffects.length}`
                                                    return `${unlockedBorders.length}/${allBorders.length}`
                                                }

                                                return (
                                                    <button
                                                        key={subTab}
                                                        onClick={() => setProfileSubTab(subTab)}
                                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${profileSubTab === subTab
                                                            ? 'bg-white/10 text-white shadow-sm'
                                                            : 'text-white/40 hover:text-white/60'
                                                            }`}
                                                    >
                                                        {subTab.charAt(0).toUpperCase() + subTab.slice(1)}
                                                        <span className="ml-2 opacity-50 font-normal">{getCount()}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {/* Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {activeTab === 'profile' ? (
                                            <>
                                                {/* None Option */}
                                                <ItemCard
                                                    type="none"
                                                    isSelected={
                                                        (profileSubTab === 'backgrounds' && !equippedBackground) ||
                                                        (profileSubTab === 'effects' && !equippedProfileEffect) ||
                                                        (profileSubTab === 'borders' && !equippedBorder)
                                                    }
                                                    onClick={() => {
                                                        if (profileSubTab === 'backgrounds') handleEquipBackground('none')
                                                        else if (profileSubTab === 'effects') handleEquipProfileEffect('none')
                                                        else handleEquipBorder('none')
                                                    }}
                                                />

                                                {/* Profile Items */}
                                                {profileSubTab === 'backgrounds' && allBackgrounds.map((bgId) => {
                                                    const bg = getProfileBackgroundInfo(bgId)
                                                    if (!bg) return null
                                                    return (
                                                        <ItemCard
                                                            key={bgId}
                                                            type="background"
                                                            data={bg}
                                                            isUnlocked={unlockedBackgrounds.includes(bgId)}
                                                            isSelected={bgId === equippedBackground}
                                                            onClick={() => handleEquipBackground(bgId)}
                                                        />
                                                    )
                                                })}
                                                {profileSubTab === 'effects' && allProfileEffects.map((effectId) => {
                                                    const effect = getProfileEffectInfo(effectId)
                                                    if (!effect) return null
                                                    return (
                                                        <ItemCard
                                                            key={effectId}
                                                            type="profile_effect"
                                                            data={effect}
                                                            isUnlocked={unlockedProfileEffects.includes(effectId)}
                                                            isSelected={effectId === equippedProfileEffect}
                                                            onClick={() => handleEquipProfileEffect(effectId)}
                                                        />
                                                    )
                                                })}
                                                {profileSubTab === 'borders' && allBorders.map((borderId) => {
                                                    const border = getProfileBorderInfo(borderId)
                                                    if (!border) return null
                                                    return (
                                                        <ItemCard
                                                            key={borderId}
                                                            type="border"
                                                            data={border}
                                                            isUnlocked={unlockedBorders.includes(borderId)}
                                                            isSelected={borderId === equippedBorder}
                                                            onClick={() => handleEquipBorder(borderId)}
                                                        />
                                                    )
                                                })}
                                            </>
                                        ) : activeTab === 'effects' ? (
                                            <>
                                                <ItemCard
                                                    type="none"
                                                    isSelected={equippedEffect === null}
                                                    onClick={() => handleEquipEffect('none')}
                                                />
                                                {allEffects.map((effectId) => {
                                                    const effect = getEffectInfo(effectId)
                                                    if (!effect) return null
                                                    return (
                                                        <ItemCard
                                                            key={effectId}
                                                            type="effect"
                                                            data={effect}
                                                            isUnlocked={unlockedEffects.includes(effectId)}
                                                            isSelected={effectId === equippedEffect}
                                                            count={itemCounts?.effect_counts[effectId] || 0}
                                                            onClick={() => handleEquipEffect(effectId)}
                                                        />
                                                    )
                                                })}
                                            </>
                                        ) : (
                                            /* Cursors */
                                            allCursors.map((cursorId) => {
                                                const cursor = getCursorInfo(cursorId)
                                                return (
                                                    <ItemCard
                                                        key={cursorId}
                                                        type="cursor"
                                                        data={cursor}
                                                        isUnlocked={unlockedCursors.includes(cursorId)}
                                                        isSelected={cursorId === equippedCursor}
                                                        count={itemCounts?.cursor_counts[cursorId] || 0}
                                                        onClick={() => handleEquipCursor(cursorId)}
                                                    />
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )

    return createPortal(modal, document.body)
}

const ItemCard = memo(function ItemCard({
    type,
    data,
    isUnlocked = true,
    isSelected = false,
    onClick,
    count
}: {
    type: 'cursor' | 'effect' | 'background' | 'profile_effect' | 'border' | 'none'
    data?: any
    isUnlocked?: boolean
    isSelected?: boolean
    onClick: () => void
    count?: number
}) {
    const [isHovered, setIsHovered] = useState(false)

    // Handle "None" card special case
    if (type === 'none') {
        return (
            <motion.button
                onClick={onClick}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`group relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all ${isSelected
                    ? 'bg-white/[0.08] border-white/40'
                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
                    }`}
            >
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/20 group-hover:text-white/40 group-hover:border-white/20 transition-all">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
                <span className="text-xs font-medium text-white/40 group-hover:text-white/60">None</span>
                {isSelected && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                )}
            </motion.button>
        )
    }

    const rarityColor = getRarityColor(data.rarity)

    // Render preview content based on type
    const renderPreview = () => {
        switch (type) {
            case 'cursor':
                return (
                    <div className="w-1.5 h-10 rounded-full shadow-lg" style={{
                        backgroundColor: data.color === 'rainbow' ? '#ec4899' : data.color,
                        boxShadow: `0 0 16px ${data.glow}`
                    }} />
                )
            case 'effect':
                return <EffectIcon color={data.color} />
            case 'background':
                return (
                    <div className="absolute inset-0">
                        <img src={data.path} alt={data.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    </div>
                )
            case 'profile_effect':
                return (
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <AvatarDecoration
                            decorationType={EFFECT_TO_DECORATION[data.id] || 'default'}
                            size="100%"
                            animate={isUnlocked && isHovered}
                            className="absolute inset-0 pointer-events-none"
                        />
                        <div className="w-10 h-10 rounded-full bg-white/10" />
                    </div>
                )
            case 'border':
                return (
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <AvatarDecoration
                            decorationType={BORDER_TO_DECORATION[data.id] || 'default'}
                            size="100%"
                            animate={isUnlocked && isHovered}
                            className="absolute inset-0 pointer-events-none"
                        />
                        <div className="w-10 h-10 rounded-full bg-white/10" />
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <motion.button
            onClick={onClick}
            disabled={!isUnlocked}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={isUnlocked ? { y: -4 } : {}}
            whileTap={isUnlocked ? { scale: 0.98 } : {}}
            className={`group relative aspect-[4/5] rounded-2xl border overflow-hidden flex flex-col transition-all ${!isUnlocked
                ? 'opacity-40 grayscale cursor-not-allowed bg-white/[0.01] border-white/[0.02]'
                : isSelected
                    ? 'bg-gradient-to-b from-white/[0.08] to-white/[0.02] border-cyan-500/50 shadow-[0_0_20px_-10px_rgba(34,211,238,0.3)]'
                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
                }`}
        >
            {/* Preview Section */}
            <div className="flex-1 relative flex items-center justify-center w-full overflow-hidden bg-white/[0.01]">
                {renderPreview()}

                {/* Lock Overlay */}
                {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div className={`p-4 w-full border-t flex flex-col gap-1 items-start ${isSelected ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-white/[0.05] bg-white/[0.01]'
                }`}>
                <div className="flex items-center justify-between w-full">
                    <h3 className="text-xs font-semibold text-white/90 truncate max-w-[70%]">{data.name}</h3>
                    {count !== undefined && count > 0 && (
                        <span className="text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">x{count}</span>
                    )}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: rarityColor }}>
                    {data.rarity}
                </p>
            </div>

            {/* Selection Indicator */}
            {isSelected && (
                <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10 box-content border-2 border-[#0A0A0A]" />
            )}
        </motion.button>
    )
})
