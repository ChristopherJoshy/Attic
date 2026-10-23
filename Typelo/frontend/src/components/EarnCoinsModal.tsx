/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * EarnCoinsModal - Minimal design for quests, redeem codes, and invites.
 */

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../stores/authStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { redeemCode, getQuests, claimQuest, Quest } from '../config/api'

interface EarnCoinsModalProps {
    isOpen: boolean
    onClose: () => void
}

function QuestRow({ quest, onClaim, isClaimLoading }: { quest: Quest; onClaim: (questId: string) => void; isClaimLoading: boolean }) {
    const progressPercent = Math.min((quest.progress / quest.target) * 100, 100)
    const isComplete = quest.is_complete
    const isClaimed = quest.claimed

    return (
        <div className={`p-4 rounded-lg border ${isClaimed ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-white/[0.02] border-white/5'}`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className={`font-medium text-sm ${isClaimed ? 'text-white/40 line-through' : 'text-white'}`}>
                            {quest.name}
                        </h4>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{quest.description}</p>
                </div>

                {isClaimed ? (
                    <span className="px-2 py-1 text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 rounded">
                        Claimed
                    </span>
                ) : isComplete ? (
                    <button
                        onClick={() => onClaim(quest.quest_id)}
                        disabled={isClaimLoading}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded transition-colors disabled:opacity-50"
                    >
                        {isClaimLoading ? '...' : 'Claim'}
                    </button>
                ) : (
                    <span className="text-xs text-yellow-400 font-medium whitespace-nowrap">
                        +{quest.reward}
                    </span>
                )}
            </div>

            {!isClaimed && (
                <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                        <span>{quest.progress} / {quest.target}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-pink-500'}`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

function getTimeUntil(isoString: string): string {
    const target = new Date(isoString)
    const now = new Date()
    const diff = target.getTime() - now.getTime()
    if (diff <= 0) return 'Resetting...'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 24) {
        const days = Math.floor(hours / 24)
        return `${days}d ${hours % 24}h`
    }
    return `${hours}h ${minutes}m`
}

export default function EarnCoinsModal({ isOpen, onClose }: EarnCoinsModalProps) {
    const { idToken, user } = useAuthStore()
    const { fetchInventory } = useInventoryStore()

    const [activeTab, setActiveTab] = useState<'quests' | 'redeem' | 'invite'>('quests')
    const [questSubTab, setQuestSubTab] = useState<'daily' | 'weekly'>('daily')
    const [code, setCode] = useState('')
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')
    const [invitedCount, setInvitedCount] = useState(0)

    const [dailyQuests, setDailyQuests] = useState<Quest[]>([])
    const [weeklyQuests, setWeeklyQuests] = useState<Quest[]>([])
    const [dailyResetAt, setDailyResetAt] = useState('')
    const [weeklyResetAt, setWeeklyResetAt] = useState('')
    const [questsLoading, setQuestsLoading] = useState(false)
    const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null)
    const [resetCountdown, setResetCountdown] = useState({ daily: '', weekly: '' })

    const fetchQuestsData = useCallback(async () => {
        if (!idToken) return
        setQuestsLoading(true)
        try {
            const data = await getQuests(idToken)
            setDailyQuests(data.daily_quests)
            setWeeklyQuests(data.weekly_quests)
            setDailyResetAt(data.daily_reset_at)
            setWeeklyResetAt(data.weekly_reset_at)
        } catch (err) {
            console.error('Failed to fetch quests:', err)
        } finally {
            setQuestsLoading(false)
        }
    }, [idToken])

    useEffect(() => {
        if (isOpen && idToken) {
            fetchQuestsData()
            const fetchInvitedCount = async () => {
                try {
                    const { getUserProfile } = await import('../config/api')
                    const profile = await getUserProfile(idToken)
                    setInvitedCount(profile.invited_count || 0)
                } catch (err) {
                    console.error('Failed to fetch invited count:', err)
                }
            }
            fetchInvitedCount()
        }
    }, [isOpen, idToken, fetchQuestsData])

    useEffect(() => {
        if (!isOpen) return
        const updateCountdowns = () => {
            setResetCountdown({
                daily: dailyResetAt ? getTimeUntil(dailyResetAt) : '',
                weekly: weeklyResetAt ? getTimeUntil(weeklyResetAt) : ''
            })
        }
        updateCountdowns()
        const interval = setInterval(updateCountdowns, 60000)
        return () => clearInterval(interval)
    }, [isOpen, dailyResetAt, weeklyResetAt])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    useEffect(() => {
        if (!isOpen) {
            setCode('')
            setStatus('idle')
            setMessage('')
            setActiveTab('quests')
            setQuestSubTab('daily')
        }
    }, [isOpen])

    const handleRedeem = async () => {
        if (!code.trim() || !idToken) return
        setStatus('loading')
        setMessage('')
        try {
            const result = await redeemCode(idToken, code)
            setStatus('success')
            setMessage(`+${result.coins_added} Coins`)
            setCode('')
            fetchInventory(idToken)
        } catch (error: any) {
            setStatus('error')
            setMessage(error.message || 'Failed to redeem')
        }
    }

    const handleClaimQuest = async (questId: string) => {
        if (!idToken) return
        setClaimingQuestId(questId)
        try {
            await claimQuest(idToken, questId)
            fetchInventory(idToken)
            fetchQuestsData()
        } catch (error: any) {
            setMessage(error.message || 'Failed to claim')
            setStatus('error')
        } finally {
            setClaimingQuestId(null)
        }
    }

    const copyReferralLink = () => {
        if (!user?.uid) return
        const link = `${window.location.origin}/?ref=${user.uid}`
        navigator.clipboard.writeText(link)
        setMessage('Copied!')
        setStatus('success')
        setTimeout(() => { setMessage(''); setStatus('idle') }, 2000)
    }

    const rawQuests = questSubTab === 'daily' ? dailyQuests : weeklyQuests
    const currentQuests = [...rawQuests].sort((a, b) => {
        if (a.claimed && !b.claimed) return 1
        if (!a.claimed && b.claimed) return -1
        if (a.is_complete && !b.is_complete) return -1
        if (!a.is_complete && b.is_complete) return 1
        return 0
    })
    const currentResetTime = questSubTab === 'daily' ? resetCountdown.daily : resetCountdown.weekly
    const completedCount = currentQuests.filter(q => q.claimed).length
    const totalCount = currentQuests.length

    if (!isOpen) return null

    const modal = (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#0a0a0a] border border-white/10"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white">Earn Coins</h2>
                    <button onClick={onClose} className="p-1 text-white/40 hover:text-white transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5">
                    {(['quests', 'redeem', 'invite'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === tab ? 'text-white border-b-2 border-pink-500' : 'text-white/40 hover:text-white/60'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="max-h-[400px] overflow-y-auto">
                    {activeTab === 'quests' && (
                        <div className="p-4">
                            {/* Sub-tabs */}
                            <div className="flex gap-2 mb-4">
                                {(['daily', 'weekly'] as const).map((subTab) => (
                                    <button
                                        key={subTab}
                                        onClick={() => setQuestSubTab(subTab)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${questSubTab === subTab
                                            ? 'bg-pink-500 text-white'
                                            : 'bg-white/5 text-white/40 hover:text-white/60'
                                            }`}
                                    >
                                        {subTab}
                                    </button>
                                ))}
                            </div>

                            {/* Info row */}
                            <div className="flex items-center justify-between mb-4 text-xs text-white/40">
                                <span>Resets in {currentResetTime || '...'}</span>
                                <span>{completedCount}/{totalCount} done</span>
                            </div>

                            {/* Quest List */}
                            {questsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : currentQuests.length === 0 ? (
                                <div className="text-center py-12 text-white/40 text-sm">No quests available</div>
                            ) : (
                                <div className="space-y-2">
                                    {currentQuests.map((quest) => (
                                        <QuestRow
                                            key={quest.quest_id}
                                            quest={quest}
                                            onClaim={handleClaimQuest}
                                            isClaimLoading={claimingQuestId === quest.quest_id}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'redeem' && (
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-white/50 text-center">Enter a promo code</p>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => { setCode(e.target.value.toUpperCase()); setStatus('idle'); setMessage('') }}
                                placeholder="CODE"
                                className="w-full px-4 py-3 bg-white/5 rounded-lg border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500 text-center font-mono uppercase"
                            />
                            <button
                                onClick={handleRedeem}
                                disabled={status === 'loading' || !code.trim()}
                                className={`w-full py-3 rounded-lg font-bold uppercase text-sm transition-colors ${status === 'loading' || !code.trim()
                                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                    : 'bg-pink-500 text-white hover:bg-pink-600'
                                    }`}
                            >
                                {status === 'loading' ? 'Redeeming...' : 'Redeem'}
                            </button>
                            {message && (
                                <p className={`text-sm text-center font-medium ${status === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {message}
                                </p>
                            )}
                        </div>
                    )}

                    {activeTab === 'invite' && (
                        <div className="p-5 space-y-4">
                            <div className="text-center py-4">
                                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Invited</p>
                                <p className="text-3xl font-bold text-white">{invitedCount}</p>
                            </div>

                            <div className="text-center text-sm space-y-1">
                                <p><span className="text-emerald-400 font-medium">+10</span> <span className="text-white/50">for you</span></p>
                                <p><span className="text-yellow-400 font-medium">+5</span> <span className="text-white/50">for friend</span></p>
                            </div>

                            <div className="relative">
                                <input
                                    readOnly
                                    value={user?.uid ? `${window.location.origin}/?ref=${user.uid}` : '...'}
                                    className="w-full px-3 py-2.5 pr-16 bg-white/5 rounded-lg border border-white/10 text-white/50 font-mono text-xs truncate"
                                />
                                <button
                                    onClick={copyReferralLink}
                                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-white/10 hover:bg-white/20 rounded text-xs font-bold text-white transition-colors"
                                >
                                    {status === 'success' && activeTab === 'invite' ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )

    return createPortal(modal, document.body)
}
