/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * API Utils - Authenticated fetch wrapper and endpoint definitions.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * apiRequest: Generic authenticated request wrapper.
 * checkBackendHealth: Pings health endpoint.
 * verifyToken: Validates Firebase ID token.
 * getUserProfile: Fetches user profile.
 * getLeaderboard: Fetches leaderboard data.
 * getUserRank: Fetches user's rank.
 * getUserMatches: Fetches match history.
 * getUserPublicProfile: Fetches public profile.
 * sendFriendRequest: Sends friend request.
 * getFriends: Fetches friends list.
 * getFriendRequests: Fetches pending requests.
 * acceptFriendRequest: Accepts a request.
 * declineFriendRequest: Declines a request.
 * searchUsers: Searches for users.
 * removeFriend: Removes a friend.
 * claimAfkCoins: Claims AFK mode rewards.
 *  
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * API_ENDPOINTS: Map of API URLs.
 * ApiError: Error interface.
 * various interfaces: Response type definitions.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * None
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/health`,
  authVerify: `${API_BASE_URL}/api/auth/verify`,
  authMe: `${API_BASE_URL}/api/auth/me`,
  userProfile: `${API_BASE_URL}/api/user/profile`,
  userMatches: `${API_BASE_URL}/api/user/matches`,
  leaderboardTop: `${API_BASE_URL}/api/leaderboard/top`,
  leaderboardUser: `${API_BASE_URL}/api/leaderboard/user`,
  leaderboardStats: `${API_BASE_URL}/api/leaderboard/stats`,
  matchWs: API_BASE_URL.replace('http', 'ws') + '/api/match/ws',
}

export interface ApiError {
  status: number
  message: string
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  })

  if (!response.ok) {
    const error: ApiError = {
      status: response.status,
      message: `API Error: ${response.statusText}`,
    }
    try {
      const data = await response.json()
      error.message = data.detail || data.message || error.message
    } catch {
      // Ignore JSON parse errors
    }
    throw error
  }

  return response.json()
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(API_ENDPOINTS.health, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function verifyToken(idToken: string, referralCode?: string | null): Promise<{
  uid: string
  email: string
  display_name: string
  photo_url: string | null
  elo_rating: number
  rank: string
  referral_bonus_applied: boolean
  is_new_user: boolean
}> {
  return apiRequest(API_ENDPOINTS.authVerify, {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken, referral_code: referralCode }),
  })
}

export async function getUserProfile(token: string): Promise<{
  uid: string
  email: string
  display_name: string
  photo_url: string | null
  elo_rating: number
  peak_elo: number
  rank: string
  best_wpm: number
  avg_wpm: number
  avg_accuracy: number
  total_matches: number
  wins: number
  losses: number
  win_rate: number
  invited_count: number
}> {
  return apiRequest(API_ENDPOINTS.userProfile, {}, token)
}
export const redeemCode = async (token: string, code: string) => {
  const response = await fetch(`${API_BASE_URL}/api/earn/redeem`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to redeem code');
  }

  return response.json();
};

export async function getLeaderboard(limit: number = 10): Promise<{
  entries: Array<{
    position: number
    user: {
      uid: string
      display_name: string
      photo_url: string | null
      current_elo: number
      peak_elo: number
      rank: string
      best_wpm: number
      equipped_border: string | null
      equipped_profile_effect: string | null
      equipped_background: string | null
    }
  }>
  total_players: number
  last_updated: string
}> {
  return apiRequest(`${API_ENDPOINTS.leaderboardTop}?limit=${limit}`)
}

export async function getUserRank(userId: string, token: string): Promise<{
  position: number
  peak_elo: number
  rank: string
  percentile: number
  is_on_leaderboard: boolean
  potential_position: number | null
}> {
  return apiRequest(`${API_ENDPOINTS.leaderboardUser}/${userId}`, {}, token)
}

interface BackendMatchEntry {
  match_id: string
  opponent_name: string
  opponent_photo_url: string | null
  opponent_is_bot: boolean
  your_wpm: number
  opponent_wpm: number
  your_accuracy: number
  your_score: number
  elo_change: number
  result: string
  played_at: string
}

interface BackendMatchHistoryResponse {
  matches: BackendMatchEntry[]
  total_matches: number
  page: number
  limit: number
}

export async function getUserMatches(token: string, limit: number = 20): Promise<Array<{
  match_id: string
  played_at: string
  result: 'win' | 'loss' | 'tie'
  wpm: number
  accuracy: number
  elo_change: number
  elo_after: number
  opponent: {
    display_name: string
    photo_url: string | null
    is_bot: boolean
  }
}>> {
  const response = await apiRequest<BackendMatchHistoryResponse>(
    `${API_ENDPOINTS.userMatches}?limit=${limit}`,
    {},
    token
  )

  // Transform backend format to frontend format
  return (response.matches || []).map(m => ({
    match_id: m.match_id,
    played_at: m.played_at,
    result: m.result as 'win' | 'loss' | 'tie',
    wpm: m.your_wpm,
    accuracy: m.your_accuracy,
    elo_change: m.elo_change,
    elo_after: 0, // Note: Backend doesn't include elo_after, we'll compute from current elo
    opponent: {
      display_name: m.opponent_name,
      photo_url: m.opponent_photo_url,
      is_bot: m.opponent_is_bot
    }
  }))
}

// ============== FRIENDS API ==============

export interface PublicProfile {
  uid: string
  display_name: string
  photo_url: string | null
  elo_rating: number
  rank: string
  total_matches: number
  wins: number
  losses: number
  avg_wpm: number
  // Profile customization (for other users to see)
  equipped_background: string | null
  equipped_profile_effect: string | null
  equipped_border: string | null
}

export interface Friend {
  uid: string
  display_name: string
  photo_url: string | null
  elo_rating: number
  rank: string
  is_online: boolean
  added_at: string
}

export interface FriendRequest {
  id: string
  from_user: {
    uid: string
    display_name: string
    photo_url: string | null
    elo_rating: number
    rank: string
  }
  sent_at: string
}

export async function getUserPublicProfile(userId: string, token: string): Promise<PublicProfile> {
  return apiRequest(`${API_BASE_URL}/api/user/profile/${userId}`, {}, token)
}

export async function sendFriendRequest(toUserId: string, token: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`${API_BASE_URL}/api/friends/request`, {
    method: 'POST',
    body: JSON.stringify({ to_user_id: toUserId }),
  }, token)
}

export async function getFriends(token: string): Promise<Friend[]> {
  const response = await apiRequest<{ friends: Friend[] }>(`${API_BASE_URL}/api/friends`, {}, token)
  return response.friends || []
}

export async function getFriendRequests(token: string): Promise<FriendRequest[]> {
  const response = await apiRequest<{ requests: FriendRequest[] }>(`${API_BASE_URL}/api/friends/requests`, {}, token)
  return response.requests || []
}

export async function acceptFriendRequest(requestId: string, token: string): Promise<{ success: boolean }> {
  return apiRequest(`${API_BASE_URL}/api/friends/accept`, {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId }),
  }, token)
}

export async function declineFriendRequest(requestId: string, token: string): Promise<{ success: boolean }> {
  return apiRequest(`${API_BASE_URL}/api/friends/decline`, {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId }),
  }, token)
}

// ============== USER SEARCH API ==============

export interface UserSearchResult {
  uid: string
  display_name: string
  photo_url: string | null
  elo_rating: number
  rank: string
}

export async function searchUsers(query: string, token: string): Promise<UserSearchResult[]> {
  const response = await apiRequest<{ users: UserSearchResult[] }>(
    `${API_BASE_URL}/api/friends/search?query=${encodeURIComponent(query)}`,
    {},
    token
  )
  return response.users || []
}

export async function removeFriend(friendId: string, token: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`${API_BASE_URL}/api/friends/remove`, {
    method: 'POST',
    body: JSON.stringify({ friend_id: friendId }),
  }, token)
}

// ============== SHOP & INVENTORY API ==============

import type { CursorInfo, SpinResult, InventoryData, EffectInfo, EffectRarity, CursorRarity, ProfileBackgroundInfo, ProfileEffectInfo, ProfileBorderInfo, ProfileSpinResult, ProfileInventoryData } from '../types'

export async function getCursors(): Promise<CursorInfo[]> {
  return apiRequest(`${API_BASE_URL}/api/shop/cursors`)
}

export async function getEffects(): Promise<EffectInfo[]> {
  return apiRequest(`${API_BASE_URL}/api/shop/effects`)
}

export async function getInventory(token: string): Promise<InventoryData> {
  const response = await apiRequest<{
    coins: number
    unlocked_cursors: string[]
    equipped_cursor: string
    unlocked_effects: string[]
    equipped_effect: string | null
    pity_active: boolean
    pity_streak: number
    crates_opened: number
  }>(`${API_BASE_URL}/api/shop/inventory`, {
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  }, token)

  return {
    coins: response.coins,
    unlockedCursors: response.unlocked_cursors,
    equippedCursor: response.equipped_cursor,
    unlockedEffects: response.unlocked_effects || [],
    equippedEffect: response.equipped_effect || null,
    pityActive: response.pity_active || false,
    pityStreak: response.pity_streak || 0,
    cratesOpened: response.crates_opened || 0,
  }
}

export interface LeaderboardBonus {
  isTopPlayer: boolean
  isTop3: boolean
  position: number | null
  luckBonusPercent: number
  coinReductionPercent: number
  coinBonusPercent: number
  gachaOriginalCost: number
  gachaDiscountedCost: number
  profileOriginalCost: number
  profileDiscountedCost: number
}

export async function getLeaderboardBonus(token: string): Promise<LeaderboardBonus> {
  const response = await apiRequest<{
    is_top_player: boolean
    is_top_3: boolean
    position: number | null
    luck_bonus_percent: number
    coin_reduction_percent: number
    coin_bonus_percent: number
    gacha_original_cost: number
    gacha_discounted_cost: number
    profile_original_cost: number
    profile_discounted_cost: number
  }>(`${API_BASE_URL}/api/shop/leaderboard-bonus`, {}, token)

  return {
    isTopPlayer: response.is_top_player,
    isTop3: response.is_top_3,
    position: response.position,
    luckBonusPercent: response.luck_bonus_percent,
    coinReductionPercent: response.coin_reduction_percent,
    coinBonusPercent: response.coin_bonus_percent,
    gachaOriginalCost: response.gacha_original_cost,
    gachaDiscountedCost: response.gacha_discounted_cost,
    profileOriginalCost: response.profile_original_cost,
    profileDiscountedCost: response.profile_discounted_cost,
  }
}

export async function spinGacha(token: string): Promise<SpinResult> {
  const response = await apiRequest<{
    type: string
    cursor_id?: string
    cursor_info?: {
      id: string
      name: string
      color: string
      glow: string
      rarity: string
    }
    effect_id?: string
    effect_info?: {
      id: string
      name: string
      color: string
      rarity: string
    }
    coins_won?: number
    is_new?: boolean
    pity_activated?: boolean
    pity_streak?: number
  }>(`${API_BASE_URL}/api/shop/spin`, { method: 'POST' }, token)

  return {
    type: response.type as 'cursor' | 'coins' | 'effect',
    cursorId: response.cursor_id,
    cursorInfo: response.cursor_info ? {
      id: response.cursor_info.id,
      name: response.cursor_info.name,
      color: response.cursor_info.color,
      glow: response.cursor_info.glow,
      rarity: response.cursor_info.rarity as CursorRarity,
    } : undefined,
    effectId: response.effect_id,
    effectInfo: response.effect_info ? {
      id: response.effect_info.id,
      name: response.effect_info.name,
      color: response.effect_info.color,
      rarity: response.effect_info.rarity as EffectRarity,
    } : undefined,
    coinsWon: response.coins_won,
    isNew: response.is_new,
    pityActivated: response.pity_activated,
    pityStreak: response.pity_streak,
  }
}

export async function equipItem(itemId: string, type: 'cursor' | 'effect', token: string): Promise<{ status: string; equipped_item: string }> {
  return apiRequest(`${API_BASE_URL}/api/shop/equip`, {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId, item_type: type }),
  }, token)
}

export async function getItemStats(): Promise<{ cursor_counts: Record<string, number>; effect_counts: Record<string, number> }> {
  return apiRequest(`${API_BASE_URL}/api/shop/stats`)
}

// Legacy alias for backward compatibility or refactor
export const equipCursor = (cursorId: string, token: string) => equipItem(cursorId, 'cursor', token)

// ============== PROFILE CRATE API ==============

export async function getProfileInventory(token: string): Promise<ProfileInventoryData> {
  const response = await apiRequest<{
    unlocked_backgrounds: string[]
    equipped_background: string | null
    unlocked_profile_effects: string[]
    equipped_profile_effect: string | null
    unlocked_borders: string[]
    equipped_border: string | null
    profile_pity_active: boolean
    profile_pity_streak: number
    profile_crates_opened: number
  }>(`${API_BASE_URL}/api/shop/profile-inventory`, {
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  }, token)

  return {
    unlockedBackgrounds: response.unlocked_backgrounds || [],
    equippedBackground: response.equipped_background,
    unlockedProfileEffects: response.unlocked_profile_effects || [],
    equippedProfileEffect: response.equipped_profile_effect,
    unlockedBorders: response.unlocked_borders || [],
    equippedBorder: response.equipped_border,
    profilePityActive: response.profile_pity_active || false,
    profilePityStreak: response.profile_pity_streak || 0,
    profileCratesOpened: response.profile_crates_opened || 0,
  }
}

export async function spinProfileCrate(token: string): Promise<ProfileSpinResult> {
  const response = await apiRequest<{
    type: string
    item_id?: string
    background_info?: {
      id: string
      name: string
      path: string
      rarity: string
      text_color: string
    }
    effect_info?: {
      id: string
      name: string
      color: string
      animation: string
      rarity: string
    }
    border_info?: {
      id: string
      name: string
      style: string
      color?: string
      colors?: string[]
      width: number
      animation?: string
      rarity: string
    }
    is_new?: boolean
    pity_activated?: boolean
    pity_streak?: number
  }>(`${API_BASE_URL}/api/shop/profile-spin`, { method: 'POST' }, token)

  return {
    type: response.type as 'background' | 'profile_effect' | 'border',
    itemId: response.item_id,
    backgroundInfo: response.background_info ? {
      id: response.background_info.id,
      name: response.background_info.name,
      path: response.background_info.path,
      rarity: response.background_info.rarity as CursorRarity,
      textColor: (response.background_info.text_color || 'light') as 'light' | 'dark',
    } : undefined,
    effectInfo: response.effect_info ? {
      id: response.effect_info.id,
      name: response.effect_info.name,
      color: response.effect_info.color,
      animation: response.effect_info.animation,
      rarity: response.effect_info.rarity as CursorRarity,
    } : undefined,
    borderInfo: response.border_info ? {
      id: response.border_info.id,
      name: response.border_info.name,
      style: response.border_info.style,
      color: response.border_info.color,
      colors: response.border_info.colors,
      width: response.border_info.width,
      animation: response.border_info.animation,
      rarity: response.border_info.rarity as CursorRarity,
    } : undefined,
    isNew: response.is_new,
    pityActivated: response.pity_activated,
    pityStreak: response.pity_streak,
  }
}

export async function equipProfileItem(
  itemId: string,
  type: 'background' | 'profile_effect' | 'border',
  token: string
): Promise<{ status: string }> {
  return apiRequest(`${API_BASE_URL}/api/shop/profile-equip`, {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId, item_type: type }),
  }, token)
}

export async function claimRankRewards(token: string): Promise<{
  status: string,
  claimed_item?: string,
  message?: string
}> {
  return apiRequest(`${API_BASE_URL}/api/shop/claim-rank-rewards`, {
    method: 'POST',
  }, token)
}

// ============== QUESTS API ==============

export interface Quest {
  quest_id: string
  name: string
  description: string
  reward: number
  target: number
  progress: number
  category: string
  quest_type: string
  claimed: boolean
  is_complete: boolean
}

export interface QuestsResponse {
  daily_quests: Quest[]
  weekly_quests: Quest[]
  daily_reset_at: string
  weekly_reset_at: string
}

export interface ClaimQuestResponse {
  success: boolean
  coins_added: number
  new_balance: number
  message: string
}

export type ClaimResponse = ClaimQuestResponse


export async function getQuests(token: string): Promise<QuestsResponse> {
  return apiRequest(`${API_BASE_URL}/api/earn/quests`, {}, token)
}

export async function claimQuest(token: string, questId: string): Promise<ClaimQuestResponse> {
  return apiRequest(`${API_BASE_URL}/api/earn/quests/claim/${questId}`, {
    method: 'POST',
  }, token)
}

// ============== DAILY REWARDS API ==============

export interface DailyStatus {
  streak: number
  current_day: number
  can_claim: boolean
  next_reward: {
    type: string
    coins?: number
    effect?: string
    cursor?: string
    luck_boost?: number
  }
  hours_until_reset: number | null
  last_claim: string | null
}

export interface ClaimDailyResult {
  success: boolean
  reward: {
    type: string
    coins?: number
    effect?: string
    cursor?: string
    luck_boost?: number
  }
  new_streak: number
  coins_added: number
  new_balance: number
  effect_added: string | null
  cursor_added: string | null
  luck_boost_added: number
}

export async function getDailyStatus(token: string): Promise<DailyStatus> {
  return apiRequest(`${API_BASE_URL}/api/daily/status`, {}, token)
}

export async function claimDailyReward(token: string): Promise<ClaimDailyResult> {
  return apiRequest(`${API_BASE_URL}/api/daily/claim`, { method: 'POST' }, token)
}

export async function claimAfkCoins(token: string, amount: number): Promise<ClaimResponse> {
  return apiRequest(`${API_BASE_URL}/api/earn/afk`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }, token)
}
