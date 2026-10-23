/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Types - Centralized type definitions and shared utilities.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * getRankColor: Returns color hex for rank.
 * getRankFromElo: Maps Elo to Rank.
 * getCaretIntensity: Visual style helper for caretaker.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * User, UserStats, Rank, GameMode: Core data models.
 * LeaderboardEntry: Leaderboard types.
 * MatchInfo, MatchResult, GameState: Gameplay types.
 * ClientMessageType, ServerMessageType: WebSocket protocol types.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * None
 */

// User & Authentication
export interface User {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
}

export interface UserStats {
  currentElo: number
  peakElo: number
  rank: Rank
  totalMatches: number
  wins: number
  losses: number
  avgWpm: number
  avgAccuracy: number
  bestWpm: number
}

export type Rank = 'Unranked' | 'Bronze' | 'Gold' | 'Platinum' | 'Ranker'

export type GameMode = 'ranked' | 'training' | 'friends'

// Leaderboard
export interface LeaderboardEntry {
  position: number
  user: {
    uid: string
    displayName: string
    photoURL: string | null
    currentElo: number  // Current Elo (for sorting)
    peakElo: number     // Peak Elo (for reference)
    rank: Rank
    bestWpm: number
    equippedBorder: string | null  // Profile customization
    equippedProfileEffect: string | null  // Profile effect
    equippedBackground: string | null  // Profile background
  }
}

// Match & Game
export interface MatchInfo {
  matchId: string
  opponentDisplayName: string
  opponentPhotoURL: string | null
  opponentRank: Rank
  opponentElo: number
  opponentIsBot: boolean
  words: string[]
  gameMode?: GameMode
  opponentCursor?: string
  opponentEffect?: string
}

export interface MatchResult {
  matchId: string
  duration: number
  gameMode?: GameMode
  yourWpm: number
  yourAccuracy: number
  yourScore: number
  yourEloBefore: number
  yourEloAfter: number
  yourEloChange: number
  opponentDisplayName: string
  opponentPhotoURL: string | null
  opponentIsBot: boolean
  opponentWpm: number
  opponentAccuracy: number
  opponentScore: number
  opponentRank: Rank
  opponentElo: number
  opponentEloChange: number
  opponentCursor?: string
  opponentEffect?: string
  result: 'win' | 'loss' | 'tie'
  coinsEarned?: number
  baseCoins?: number
  rankBonusCoins?: number
  leaderboardBonusCoins?: number
}

export interface GameState {
  status: 'idle' | 'queue' | 'waiting' | 'playing' | 'finished'
  gameMode: GameMode  // 'ranked' or 'training'
  matchInfo: MatchInfo | null
  result: MatchResult | null
  queueElapsed: number
  countdown: number
  timeRemaining: number
  words: string[]
  currentWordIndex: number
  currentCharIndex: number
  typedChars: string
  typedWords: string[]  // History of what was typed for each word
  errors: number
  wpm: number
  accuracy: number
  opponentCharIndex: number
  opponentWordIndex: number
  keyStats: Record<string, { total: number; errors: number }>
  startTime: number | null // Timestamp when game actually starts (for sync)
}

// WebSocket Messages
export type ClientMessageType =
  | { type: 'JOIN_QUEUE' }
  | { type: 'JOIN_TRAINING_QUEUE' }
  | { type: 'LEAVE_QUEUE' }
  | { type: 'KEYSTROKE'; char: string; timestamp: number; charIndex: number }
  | { type: 'WORD_COMPLETE'; word: string; wordIndex: number; timestamp: number }

export type ServerMessageType =
  | { type: 'QUEUE_UPDATE'; position: number; elapsed: number }
  | { type: 'MATCH_FOUND'; matchId: string; opponentDisplayName: string; opponentPhotoUrl: string | null; opponentRank: Rank; opponentIsBot: boolean; words: string[] }
  | { type: 'GAME_START'; timestamp: number; duration: number }
  | { type: 'OPPONENT_PROGRESS'; charIndex: number; wordIndex: number }
  | { type: 'GAME_END'; result: MatchResult }
  | { type: 'ONLINE_COUNT'; count: number }
  | { type: 'ONLINE_USERS'; users: Array<{ user_id: string; display_name: string; photo_url?: string; elo?: number }> }
  | { type: 'PUBLIC_MATCH_STARTED'; match_id: string; player1_name: string; player1_photo?: string; player2_name: string; player2_photo?: string; is_bot_match: boolean; game_mode: string }
  | { type: 'PUBLIC_MATCH_ENDED'; match_id: string; winner_name: string; winner_photo?: string; loser_name: string; loser_photo?: string; winner_wpm: number; loser_wpm: number; is_tie: boolean; game_mode: string }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'PONG'; server_time: number } // RTT measurement response

// UI Helpers
export const getRankColor = (rank: Rank): string => {
  switch (rank) {
    case 'Unranked':
      return '#71717a'
    case 'Bronze':
      return '#cd7f32'
    case 'Gold':
      return '#ffd700'
    case 'Platinum':
      return '#e5e4e2'
    case 'Ranker':
      return 'url(#ranker-gradient)'
    default:
      return '#71717a'
  }
}

export const getRankFromElo = (elo: number): Rank => {
  if (elo < 1000) return 'Unranked'
  if (elo < 2000) return 'Bronze'
  if (elo < 3000) return 'Gold'
  if (elo < 10000) return 'Platinum'
  return 'Ranker'
}

export const getCaretIntensity = (wpm: number): string => {
  if (wpm < 40) return 'caret-intensity-low'
  if (wpm < 80) return 'caret-intensity-medium'
  if (wpm < 120) return 'caret-intensity-high'
  return 'caret-intensity-extreme'
}

// Cursor System Types
export type CursorRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'ultra' | 'divine' | 'mythical'

export interface CursorInfo {
  id: string
  name: string
  color: string
  glow: string
  rarity: CursorRarity
  fontColor?: string
}

// Effect System Types
export type EffectRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'ultra' | 'divine'

export interface EffectInfo {
  id: string
  name: string
  color: string
  rarity: EffectRarity
}

export interface SpinResult {
  type: 'cursor' | 'effect' | 'coins' | 'nothing'
  cursorId?: string
  cursorInfo?: CursorInfo
  effectId?: string
  effectInfo?: EffectInfo
  coinsWon?: number
  isNew?: boolean
  pityStreak?: number
  pityActivated?: boolean
}

export interface InventoryData {
  coins: number
  unlockedCursors: string[]
  equippedCursor: string
  unlockedEffects: string[]
  equippedEffect: string | null
  pityActive: boolean
  pityStreak: number
  cratesOpened: number
}

// Cursor color definitions - 39 Total (must match backend)
export const CURSORS: Record<string, CursorInfo> = {
  // Common (8)
  default: { id: 'default', name: 'Default', color: '#f43f5e', glow: '#f43f5e', rarity: 'common' },
  ocean: { id: 'ocean', name: 'Ocean Wave', color: '#06b6d4', glow: '#0891b2', rarity: 'common' },
  forest: { id: 'forest', name: 'Forest', color: '#22c55e', glow: '#16a34a', rarity: 'common' },
  crimson: { id: 'crimson', name: 'Crimson Blade', color: '#dc2626', glow: '#b91c1c', rarity: 'common' },
  mint: { id: 'mint', name: 'Fresh Mint', color: '#4ade80', glow: '#22c55e', rarity: 'common' },
  sky: { id: 'sky', name: 'Sky Blue', color: '#38bdf8', glow: '#0ea5e9', rarity: 'common' },
  steel: { id: 'steel', name: 'Steel Gray', color: '#64748b', glow: '#475569', rarity: 'common' },
  coral: { id: 'coral', name: 'Coral Reef', color: '#fb7185', glow: '#f43f5e', rarity: 'common' },
  // Uncommon (7)
  sunset: { id: 'sunset', name: 'Sunset', color: '#f97316', glow: '#ea580c', rarity: 'uncommon' },
  lavender: { id: 'lavender', name: 'Lavender', color: '#a78bfa', glow: '#8b5cf6', rarity: 'uncommon' },
  peach: { id: 'peach', name: 'Peach Blossom', color: '#fb923c', glow: '#f97316', rarity: 'uncommon' },
  sapphire: { id: 'sapphire', name: 'Sapphire', color: '#2563eb', glow: '#1d4ed8', rarity: 'uncommon' },
  rose: { id: 'rose', name: 'Rose Quartz', color: '#f472b6', glow: '#ec4899', rarity: 'uncommon' },
  lime: { id: 'lime', name: 'Electric Lime', color: '#a3e635', glow: '#84cc16', rarity: 'uncommon' },
  violet: { id: 'violet', name: 'Violet Dream', color: '#8b5cf6', glow: '#7c3aed', rarity: 'uncommon' },
  // Rare (7)
  galaxy: { id: 'galaxy', name: 'Galaxy', color: '#8b5cf6', glow: '#7c3aed', rarity: 'rare' },
  aurora: { id: 'aurora', name: 'Aurora', color: '#34d399', glow: '#10b981', rarity: 'rare' },
  amber: { id: 'amber', name: 'Amber Glow', color: '#fbbf24', glow: '#f59e0b', rarity: 'rare' },
  emerald: { id: 'emerald', name: 'Emerald', color: '#059669', glow: '#047857', rarity: 'rare' },
  ruby: { id: 'ruby', name: 'Ruby Flame', color: '#e11d48', glow: '#be123c', rarity: 'rare' },
  cyber: { id: 'cyber', name: 'Cyber Neon', color: '#00ff88', glow: '#00cc66', rarity: 'rare' },
  retro: { id: 'retro', name: 'Retro Pixel', color: '#ff0080', glow: '#cc0066', rarity: 'rare' },
  // Epic (5)
  amethyst: { id: 'amethyst', name: 'Amethyst Crystal', color: '#a855f7', glow: '#9333ea', rarity: 'epic' },
  diamond: { id: 'diamond', name: 'Diamond', color: '#e2e8f0', glow: '#cbd5e1', rarity: 'epic' },
  obsidian: { id: 'obsidian', name: 'Obsidian Dark', color: '#1f2937', glow: '#374151', rarity: 'epic' },
  blood_moon: { id: 'blood_moon', name: 'Blood Moon', color: '#991b1b', glow: '#7f1d1d', rarity: 'epic' },
  toxic: { id: 'toxic', name: 'Toxic Waste', color: '#65a30d', glow: '#4d7c0f', rarity: 'epic' },
  // Legendary (5)
  golden: { id: 'golden', name: 'Golden', color: '#fbbf24', glow: '#f59e0b', rarity: 'legendary' },
  plasma: { id: 'plasma', name: 'Plasma Core', color: '#22d3ee', glow: '#06b6d4', rarity: 'legendary' },
  inferno: { id: 'inferno', name: 'Inferno', color: '#f97316', glow: '#ea580c', rarity: 'legendary' },
  glacier: { id: 'glacier', name: 'Glacier Ice', color: '#67e8f9', glow: '#22d3ee', rarity: 'legendary' },
  hologram: { id: 'hologram', name: 'Hologram', color: '#38bdf8', glow: '#0ea5e9', rarity: 'legendary' },
  // Ultra (4)
  nebula: { id: 'nebula', name: 'Nebula', color: '#c084fc', glow: '#a855f7', rarity: 'ultra' },
  cosmos: { id: 'cosmos', name: 'Cosmic Ray', color: '#6366f1', glow: '#4f46e5', rarity: 'ultra' },
  phoenix: { id: 'phoenix', name: 'Phoenix Flame', color: '#ff6b35', glow: '#f97316', rarity: 'ultra' },
  quantum: { id: 'quantum', name: 'Quantum Flux', color: '#14b8a6', glow: '#0d9488', rarity: 'ultra' },
  // Divine (2)
  void: { id: 'void', name: 'Void Walker', color: '#18181b', glow: '#27272a', rarity: 'divine' },
  celestial: { id: 'celestial', name: 'Celestial', color: '#fef08a', glow: '#fde047', rarity: 'divine' },
  // Mythical (1)
  rainbow: { id: 'rainbow', name: 'Rainbow', color: 'rainbow', glow: '#ec4899', rarity: 'mythical' },
}

// Effects - 46 Total (must match backend)
export const EFFECTS: Record<string, EffectInfo> = {
  // Common (5)
  bubble: { id: 'bubble', name: 'Bubble Pop', color: '#60a5fa', rarity: 'common' },
  leaf: { id: 'leaf', name: 'Autumn Leaves', color: '#84cc16', rarity: 'common' },
  dust: { id: 'dust', name: 'Pixie Dust', color: '#fcd34d', rarity: 'common' },
  sparkle_mini: { id: 'sparkle_mini', name: 'Mini Sparkles', color: '#fbbf24', rarity: 'common' },
  dots: { id: 'dots', name: 'Floating Dots', color: '#a78bfa', rarity: 'common' },
  // Uncommon (6)
  ripple: { id: 'ripple', name: 'Water Ripple', color: '#06b6d4', rarity: 'uncommon' },
  snow: { id: 'snow', name: 'Snowflake', color: '#e0f2fe', rarity: 'uncommon' },
  hearts: { id: 'hearts', name: 'Love Hearts', color: '#f472b6', rarity: 'uncommon' },
  star: { id: 'star', name: 'Starfall', color: '#fbbf24', rarity: 'uncommon' },
  music: { id: 'music', name: 'Music Notes', color: '#8b5cf6', rarity: 'uncommon' },
  feather: { id: 'feather', name: 'Feather Float', color: '#e0e7ff', rarity: 'uncommon' },
  // Rare (6)
  wind: { id: 'wind', name: 'Wind Gust', color: '#94a3b8', rarity: 'rare' },
  thunder: { id: 'thunder', name: 'Thunder Strike', color: '#facc15', rarity: 'rare' },
  neon: { id: 'neon', name: 'Neon Glow', color: '#e879f9', rarity: 'rare' },
  shadow: { id: 'shadow', name: 'Shadow Trail', color: '#374151', rarity: 'rare' },
  pixel: { id: 'pixel', name: 'Pixel Trail', color: '#22c55e', rarity: 'rare' },
  glitch: { id: 'glitch', name: 'Glitch Effect', color: '#ef4444', rarity: 'rare' },
  // Epic (6)
  ice: { id: 'ice', name: 'Frost Trail', color: '#7dd3fc', rarity: 'epic' },
  lava: { id: 'lava', name: 'Molten Lava', color: '#f59e0b', rarity: 'epic' },
  poison: { id: 'poison', name: 'Toxic Cloud', color: '#a3e635', rarity: 'epic' },
  crystal: { id: 'crystal', name: 'Crystal Shard', color: '#c4b5fd', rarity: 'epic' },
  plasma_trail: { id: 'plasma_trail', name: 'Plasma Stream', color: '#22d3ee', rarity: 'epic' },
  ember: { id: 'ember', name: 'Ember Sparks', color: '#fb923c', rarity: 'epic' },
  // Legendary (11)
  sparkle: { id: 'sparkle', name: 'Sparkle Trail', color: '#fbbf24', rarity: 'legendary' },
  smoke: { id: 'smoke', name: 'Smoke Trail', color: '#9ca3af', rarity: 'legendary' },
  fire: { id: 'fire', name: 'Fire Trail', color: '#ef4444', rarity: 'legendary' },
  electric: { id: 'electric', name: 'Electric Trail', color: '#3b82f6', rarity: 'legendary' },
  confetti: { id: 'confetti', name: 'Confetti Party', color: '#ec4899', rarity: 'legendary' },
  matrix: { id: 'matrix', name: 'Matrix Code', color: '#22c55e', rarity: 'legendary' },
  aurora_trail: { id: 'aurora_trail', name: 'Aurora Wave', color: '#2dd4bf', rarity: 'legendary' },
  galaxy_trail: { id: 'galaxy_trail', name: 'Galaxy Swirl', color: '#8b5cf6', rarity: 'legendary' },
  cherry: { id: 'cherry', name: 'Cherry Blossom', color: '#fda4af', rarity: 'legendary' },
  gold_trail: { id: 'gold_trail', name: 'Golden Path', color: '#f59e0b', rarity: 'legendary' },
  dragon: { id: 'dragon', name: 'Dragon Breath', color: '#ef4444', rarity: 'legendary' },
  // Ultra (7)
  cosmic_dust: { id: 'cosmic_dust', name: 'Cosmic Dust', color: '#a78bfa', rarity: 'ultra' },
  lightning: { id: 'lightning', name: 'Chain Lightning', color: '#60a5fa', rarity: 'ultra' },
  supernova: { id: 'supernova', name: 'Supernova', color: '#fef08a', rarity: 'ultra' },
  void_rift: { id: 'void_rift', name: 'Void Rift', color: '#3f3f46', rarity: 'ultra' },
  spirit: { id: 'spirit', name: 'Spirit Flame', color: '#22d3ee', rarity: 'ultra' },
  cyberpunk: { id: 'cyberpunk', name: 'Cyber Circuit', color: '#00ff88', rarity: 'ultra' },
  timeshift: { id: 'timeshift', name: 'Time Warp', color: '#6366f1', rarity: 'ultra' },
  // Divine (5)
  divine_light: { id: 'divine_light', name: 'Divine Light', color: '#fffbeb', rarity: 'divine' },
  reality_tear: { id: 'reality_tear', name: 'Reality Tear', color: '#f0abfc', rarity: 'divine' },
  infinity: { id: 'infinity', name: 'Infinity Loop', color: '#818cf8', rarity: 'divine' },
  godray: { id: 'godray', name: 'God Ray', color: '#fef3c7', rarity: 'divine' },
  singularity: { id: 'singularity', name: 'Singularity', color: '#18181b', rarity: 'divine' },
}

export const getRarityColor = (rarity: CursorRarity | EffectRarity): string => {
  switch (rarity) {
    case 'common': return '#9ca3af'
    case 'uncommon': return '#22c55e'
    case 'rare': return '#3b82f6'
    case 'epic': return '#a855f7'
    case 'legendary': return '#fbbf24'
    case 'ultra': return '#c084fc'
    case 'divine': return '#fef08a'
    case 'mythical': return '#ec4899'
    default: return '#9ca3af'
  }
}

export const getCursorInfo = (cursorId: string): CursorInfo => {
  return CURSORS[cursorId] || CURSORS.default
}

export const getEffectInfo = (effectId: string | null): EffectInfo | null => {
  if (!effectId) return null
  return EFFECTS[effectId] || null
}

// ============================================================================
// PROFILE CRATE SYSTEM TYPES
// ============================================================================

export interface ProfileBackgroundInfo {
  id: string
  name: string
  path: string
  rarity: CursorRarity
  textColor: 'light' | 'dark'
}

export interface ProfileEffectInfo {
  id: string
  name: string
  color: string
  animation: string
  rarity: CursorRarity
}

export interface ProfileBorderInfo {
  id: string
  name: string
  style: string
  color?: string
  colors?: string[]
  width: number
  animation?: string
  rarity: CursorRarity
}

export interface ProfileSpinResult {
  type: 'background' | 'profile_effect' | 'border' | 'nothing'
  itemId?: string
  backgroundInfo?: ProfileBackgroundInfo
  effectInfo?: ProfileEffectInfo
  borderInfo?: ProfileBorderInfo
  isNew?: boolean
  pityStreak?: number
  pityActivated?: boolean
}

export interface ProfileInventoryData {
  unlockedBackgrounds: string[]
  equippedBackground: string | null
  unlockedProfileEffects: string[]
  equippedProfileEffect: string | null
  unlockedBorders: string[]
  equippedBorder: string | null
  profilePityActive: boolean
  profilePityStreak: number
  profileCratesOpened: number
}

// Profile Backgrounds - 9 Total
export const PROFILE_BACKGROUNDS: Record<string, ProfileBackgroundInfo> = {
  // Common (3)
  space: { id: 'space', name: 'Space', path: '/Profile-bg/Space.webp', rarity: 'common', textColor: 'light' },
  sky: { id: 'sky', name: 'Sky', path: '/Profile-bg/Sky.webp', rarity: 'common', textColor: 'light' },
  mountain: { id: 'mountain', name: 'Mountain', path: '/Profile-bg/Mountain.webp', rarity: 'common', textColor: 'light' },
  // Uncommon (2)
  landscape_dawn: { id: 'landscape_dawn', name: 'Landscape Dawn', path: '/Profile-bg/Lanscape_dawn.webp', rarity: 'mythical', textColor: 'light' },
  scary_night: { id: 'scary_night', name: 'Scary Night', path: '/Profile-bg/Scary-night.webp', rarity: 'mythical', textColor: 'light' },
  // Rare (2)
  empty_roads: { id: 'empty_roads', name: 'Empty Roads', path: '/Profile-bg/Empty_Roads.webp', rarity: 'mythical', textColor: 'light' },
  anime_waterfall: { id: 'anime_waterfall', name: 'Anime Waterfall', path: '/Profile-bg/anime-waterfall-scene.webp', rarity: 'mythical', textColor: 'light' },
  // Epic (1)
  fantasy_galaxy: { id: 'fantasy_galaxy', name: 'Fantasy Galaxy', path: '/Profile-bg/fantasy-style-galaxy-background.webp', rarity: 'mythical', textColor: 'light' },
  // Legendary (1)
  mythical_dragon: { id: 'mythical_dragon', name: 'Mythical Dragon', path: '/Profile-bg/mythical-dragon-beast-anime-style.webp', rarity: 'mythical', textColor: 'light' },
  // Rank Rewards
  rank_bronze: { id: 'rank_bronze', name: 'Bronze Banner', path: '/Profile-bg/rank_bronze.png', rarity: 'common', textColor: 'light' },
  rank_gold: { id: 'rank_gold', name: 'Gold Banner', path: '/Profile-bg/rank_gold.png', rarity: 'rare', textColor: 'light' },
  rank_platinum: { id: 'rank_platinum', name: 'Platinum Banner', path: '/Profile-bg/rank_platinum.png', rarity: 'epic', textColor: 'light' },
  rank_ranker: { id: 'rank_ranker', name: 'Ranker Banner', path: '/Profile-bg/rank_ranker.png', rarity: 'legendary', textColor: 'light' },
}

// Profile Effects - 50 Total (Improved with creative themes)
export const PROFILE_EFFECTS: Record<string, ProfileEffectInfo> = {
  // Common (12) - Nature & Basic Elements
  glow_soft: { id: 'glow_soft', name: 'Moonlit Aura', color: '#e2e8f0', animation: 'glow', rarity: 'common' },
  pulse_slow: { id: 'pulse_slow', name: 'Heartbeat', color: '#f87171', animation: 'pulse', rarity: 'common' },
  shimmer_light: { id: 'shimmer_light', name: 'Morning Dew', color: '#a5f3fc', animation: 'shimmer', rarity: 'common' },
  fade_cycle: { id: 'fade_cycle', name: 'Twilight Fade', color: '#c4b5fd', animation: 'fade', rarity: 'common' },
  sparkle_mini: { id: 'sparkle_mini', name: 'Firefly Dance', color: '#fde047', animation: 'sparkle', rarity: 'common' },
  wave_gentle: { id: 'wave_gentle', name: 'Ocean Breeze', color: '#38bdf8', animation: 'wave', rarity: 'common' },
  float_dots: { id: 'float_dots', name: 'Dandelion Seeds', color: '#faf5ff', animation: 'float', rarity: 'common' },
  blink_soft: { id: 'blink_soft', name: 'Starlight Wink', color: '#fef9c3', animation: 'blink', rarity: 'common' },
  rotate_slow: { id: 'rotate_slow', name: 'Compass Rose', color: '#f0abfc', animation: 'rotate', rarity: 'common' },
  scale_breath: { id: 'scale_breath', name: 'Living Breath', color: '#86efac', animation: 'scale', rarity: 'common' },
  bounce_light: { id: 'bounce_light', name: 'Pebble Skip', color: '#93c5fd', animation: 'bounce', rarity: 'common' },
  sway_gentle: { id: 'sway_gentle', name: 'Willow Sway', color: '#4ade80', animation: 'sway', rarity: 'common' },
  // Uncommon (10) - Enhanced Nature & Elements
  sparkle_gold: { id: 'sparkle_gold', name: 'Golden Pollen', color: '#fbbf24', animation: 'sparkle', rarity: 'uncommon' },
  pulse_neon: { id: 'pulse_neon', name: 'Bioluminescent', color: '#4ade80', animation: 'pulse', rarity: 'uncommon' },
  glow_rainbow: { id: 'glow_rainbow', name: 'Prism Light', color: 'rainbow', animation: 'rainbow', rarity: 'uncommon' },
  shimmer_ocean: { id: 'shimmer_ocean', name: 'Coral Reef', color: '#22d3ee', animation: 'shimmer', rarity: 'uncommon' },
  wave_electric: { id: 'wave_electric', name: 'Tidal Wave', color: '#3b82f6', animation: 'wave', rarity: 'uncommon' },
  float_stars: { id: 'float_stars', name: 'Stardust Trail', color: '#fef08a', animation: 'float', rarity: 'uncommon' },
  pulse_fire: { id: 'pulse_fire', name: 'Ember Heart', color: '#f97316', animation: 'fire', rarity: 'uncommon' },
  sparkle_cosmic: { id: 'sparkle_cosmic', name: 'Nebula Dust', color: '#e879f9', animation: 'sparkle', rarity: 'uncommon' },
  glow_sunset: { id: 'glow_sunset', name: 'Sunset Blaze', color: '#fb923c', animation: 'glow', rarity: 'uncommon' },
  shimmer_aurora: { id: 'shimmer_aurora', name: 'Northern Lights', color: '#2dd4bf', animation: 'aurora', rarity: 'uncommon' },
  // Rare (10) - Mystical & Magical
  particle_storm: { id: 'particle_storm', name: 'Fairy Swarm', color: '#c084fc', animation: 'particles', rarity: 'rare' },
  ring_expand: { id: 'ring_expand', name: 'Sonic Bloom', color: '#06b6d4', animation: 'rings', rarity: 'rare' },
  lightning_flash: { id: 'lightning_flash', name: 'Storm Caller', color: '#facc15', animation: 'lightning', rarity: 'rare' },
  fire_outline: { id: 'fire_outline', name: 'Flame Wreath', color: '#ef4444', animation: 'fire', rarity: 'rare' },
  ice_crystals: { id: 'ice_crystals', name: 'Frost Crown', color: '#7dd3fc', animation: 'ice', rarity: 'rare' },
  smoke_trail: { id: 'smoke_trail', name: 'Mist Veil', color: '#d1d5db', animation: 'smoke', rarity: 'rare' },
  glitch_effect: { id: 'glitch_effect', name: 'Digital Ghost', color: '#34d399', animation: 'glitch', rarity: 'rare' },
  matrix_rain: { id: 'matrix_rain', name: 'Code Rain', color: '#22c55e', animation: 'matrix', rarity: 'rare' },
  neon_outline: { id: 'neon_outline', name: 'Neon Halo', color: '#f472b6', animation: 'neon', rarity: 'rare' },
  pixel_burst: { id: 'pixel_burst', name: 'Retro Wave', color: '#fb7185', animation: 'pixels', rarity: 'rare' },
  // Epic (8) - Elemental Forces
  plasma_field: { id: 'plasma_field', name: 'Plasma Core', color: '#14b8a6', animation: 'plasma', rarity: 'epic' },
  gravity_warp: { id: 'gravity_warp', name: 'Gravity Well', color: '#6366f1', animation: 'warp', rarity: 'epic' },
  energy_sphere: { id: 'energy_sphere', name: 'Spirit Orb', color: '#a855f7', animation: 'sphere', rarity: 'epic' },
  aurora_dance: { id: 'aurora_dance', name: 'Aurora Crown', color: '#2dd4bf', animation: 'aurora', rarity: 'epic' },
  fire_storm: { id: 'fire_storm', name: 'Inferno Ring', color: '#ea580c', animation: 'firestorm', rarity: 'epic' },
  ice_shatter: { id: 'ice_shatter', name: 'Glacier Break', color: '#67e8f9', animation: 'shatter', rarity: 'epic' },
  thunder_strike: { id: 'thunder_strike', name: 'Thunder God', color: '#fcd34d', animation: 'thunder', rarity: 'epic' },
  shadow_shift: { id: 'shadow_shift', name: 'Shadow Walker', color: '#3f3f46', animation: 'shadow', rarity: 'epic' },
  // Legendary (6) - Cosmic & Divine
  supernova: { id: 'supernova', name: 'Supernova Burst', color: '#fef08a', animation: 'supernova', rarity: 'legendary' },
  void_rift: { id: 'void_rift', name: 'Void Embrace', color: '#27272a', animation: 'void', rarity: 'legendary' },
  galaxy_swirl: { id: 'galaxy_swirl', name: 'Galaxy Spiral', color: '#8b5cf6', animation: 'galaxy', rarity: 'legendary' },
  phoenix_rise: { id: 'phoenix_rise', name: 'Phoenix Ascent', color: '#f97316', animation: 'phoenix', rarity: 'legendary' },
  divine_radiance: { id: 'divine_radiance', name: 'Celestial Glow', color: '#fef3c7', animation: 'divine', rarity: 'legendary' },
  cosmic_explosion: { id: 'cosmic_explosion', name: 'Cosmic Storm', color: '#d946ef', animation: 'cosmic', rarity: 'legendary' },
  // Ultra (3) - Reality-Bending
  reality_tear: { id: 'reality_tear', name: 'Reality Fracture', color: '#f0abfc', animation: 'rift', rarity: 'ultra' },
  time_warp: { id: 'time_warp', name: 'Chrono Shift', color: '#818cf8', animation: 'quantum', rarity: 'ultra' },
  singularity: { id: 'singularity', name: 'Black Hole', color: '#18181b', animation: 'void', rarity: 'ultra' },
  // Divine (1) - Ultimate
  transcendence: { id: 'transcendence', name: 'Transcendence', color: '#fef9c3', animation: 'halo', rarity: 'divine' },
}

// Profile Borders - 50 Total (Improved with organic/creative themes)
export const PROFILE_BORDERS: Record<string, ProfileBorderInfo> = {
  // Common (12) - Nature & Basic Shapes
  solid_white: { id: 'solid_white', name: 'Moonstone Ring', style: 'solid', color: '#e2e8f0', width: 3, rarity: 'common' },
  solid_gray: { id: 'solid_gray', name: 'Iron Band', style: 'solid', color: '#71717a', width: 3, rarity: 'common' },
  solid_blue: { id: 'solid_blue', name: 'Ocean Ring', style: 'solid', color: '#3b82f6', width: 3, rarity: 'common' },
  solid_green: { id: 'solid_green', name: 'Vine Wrap', style: 'solid', color: '#22c55e', width: 3, animation: 'glow', rarity: 'common' },
  solid_red: { id: 'solid_red', name: 'Rose Thorn', style: 'solid', color: '#ef4444', width: 3, rarity: 'common' },
  solid_purple: { id: 'solid_purple', name: 'Lavender Ring', style: 'solid', color: '#a855f7', width: 3, rarity: 'common' },
  solid_pink: { id: 'solid_pink', name: 'Sakura Petals', style: 'solid', color: '#f472b6', width: 3, rarity: 'common' },
  solid_orange: { id: 'solid_orange', name: 'Autumn Leaf', style: 'solid', color: '#f97316', width: 3, rarity: 'common' },
  solid_cyan: { id: 'solid_cyan', name: 'Ice Crystal', style: 'solid', color: '#22d3ee', width: 3, rarity: 'common' },
  solid_yellow: { id: 'solid_yellow', name: 'Sunflower', style: 'solid', color: '#facc15', width: 3, rarity: 'common' },
  dashed_white: { id: 'dashed_white', name: 'Stitch Pattern', style: 'dashed', color: '#f5f5f5', width: 3, rarity: 'common' },
  dotted_white: { id: 'dotted_white', name: 'Pearl String', style: 'dotted', color: '#fafafa', width: 3, rarity: 'common' },
  // Uncommon (10) - Enhanced Nature & Organic
  double_gold: { id: 'double_gold', name: 'Wheat Crown', style: 'double', color: '#fbbf24', width: 4, rarity: 'uncommon' },
  double_silver: { id: 'double_silver', name: 'Silver Fern', style: 'double', color: '#e2e8f0', width: 4, rarity: 'uncommon' },
  gradient_sunset: { id: 'gradient_sunset', name: 'Hibiscus Ring', style: 'gradient', colors: ['#fb923c', '#ec4899'], width: 4, rarity: 'uncommon' },
  gradient_ocean: { id: 'gradient_ocean', name: 'Seaweed Flow', style: 'gradient', colors: ['#06b6d4', '#3b82f6'], width: 4, rarity: 'uncommon' },
  gradient_forest: { id: 'gradient_forest', name: 'Moss Garden', style: 'gradient', colors: ['#22c55e', '#14b8a6'], width: 4, rarity: 'uncommon' },
  gradient_royal: { id: 'gradient_royal', name: 'Orchid Bloom', style: 'gradient', colors: ['#8b5cf6', '#ec4899'], width: 4, rarity: 'uncommon' },
  thick_neon: { id: 'thick_neon', name: 'Bamboo Ring', style: 'solid', color: '#4ade80', width: 5, animation: 'glow', rarity: 'uncommon' },
  thick_violet: { id: 'thick_violet', name: 'Wisteria Vine', style: 'solid', color: '#a855f7', width: 5, animation: 'pulse', rarity: 'uncommon' },
  ridge_gold: { id: 'ridge_gold', name: 'Honeycomb', style: 'ridge', color: '#fbbf24', width: 4, rarity: 'uncommon' },
  groove_blue: { id: 'groove_blue', name: 'Wave Crest', style: 'groove', color: '#3b82f6', width: 4, rarity: 'uncommon' },
  // Rare (10) - Mystical & Magical Organic
  glow_cyan: { id: 'glow_cyan', name: 'Jellyfish Glow', style: 'glow', color: '#22d3ee', width: 4, animation: 'aurora', rarity: 'rare' },
  glow_pink: { id: 'glow_pink', name: 'Cherry Blossom', style: 'glow', color: '#f472b6', width: 4, animation: 'sparkle', rarity: 'rare' },
  glow_green: { id: 'glow_green', name: 'Firefly Ring', style: 'glow', color: '#4ade80', width: 4, animation: 'pulse', rarity: 'rare' },
  glow_gold: { id: 'glow_gold', name: 'Sunbeam Crown', style: 'glow', color: '#facc15', width: 4, animation: 'glow', rarity: 'rare' },
  gradient_fire: { id: 'gradient_fire', name: 'Maple Blaze', style: 'gradient', colors: ['#ef4444', '#fb923c', '#fbbf24'], width: 4, animation: 'fire', rarity: 'rare' },
  gradient_ice: { id: 'gradient_ice', name: 'Frost Crystals', style: 'gradient', colors: ['#67e8f9', '#22d3ee', '#3b82f6'], width: 4, animation: 'ice', rarity: 'rare' },
  gradient_cosmic: { id: 'gradient_cosmic', name: 'Nebula Dust', style: 'gradient', colors: ['#8b5cf6', '#c084fc', '#f0abfc'], width: 4, animation: 'galaxy', rarity: 'rare' },
  animated_pulse: { id: 'animated_pulse', name: 'Heartwood', style: 'animated', animation: 'pulse', color: '#a855f7', width: 4, rarity: 'rare' },
  animated_glow: { id: 'animated_glow', name: 'Moonflower', style: 'animated', animation: 'glow', color: '#faf5ff', width: 4, rarity: 'rare' },
  pixelated: { id: 'pixelated', name: 'Digital Ivy', style: 'pixelated', color: '#22c55e', width: 4, animation: 'matrix', rarity: 'rare' },
  // Epic (8) - Elemental & Powerful
  rainbow_solid: { id: 'rainbow_solid', name: 'Butterfly Wings', style: 'rainbow', width: 5, animation: 'rainbow', rarity: 'epic' },
  rainbow_animated: { id: 'rainbow_animated', name: 'Peacock Feather', style: 'rainbow_animated', width: 5, animation: 'rainbow', rarity: 'epic' },
  plasma_border: { id: 'plasma_border', name: 'DNA Helix', style: 'animated', animation: 'plasma', color: '#14b8a6', width: 5, rarity: 'epic' },
  fire_border: { id: 'fire_border', name: 'Phoenix Feathers', style: 'animated', animation: 'fire', color: '#f97316', width: 5, rarity: 'epic' },
  ice_border: { id: 'ice_border', name: 'Snowflake Crown', style: 'animated', animation: 'ice', color: '#67e8f9', width: 5, rarity: 'epic' },
  electric_border: { id: 'electric_border', name: 'Lightning Bolt', style: 'animated', animation: 'electric', color: '#facc15', width: 5, rarity: 'epic' },
  neon_animated: { id: 'neon_animated', name: 'Neon Lotus', style: 'animated', animation: 'neon', color: '#4ade80', width: 5, rarity: 'epic' },
  shadow_border: { id: 'shadow_border', name: 'Shadow Thorns', style: 'shadow', color: '#27272a', width: 5, animation: 'void', rarity: 'epic' },
  // Legendary (6) - Cosmic & Divine Organic
  galaxy_border: { id: 'galaxy_border', name: 'Celestial Vines', style: 'animated', animation: 'galaxy', color: '#8b5cf6', width: 6, rarity: 'legendary' },
  aurora_border: { id: 'aurora_border', name: 'Northern Bloom', style: 'animated', animation: 'aurora', colors: ['#22c55e', '#06b6d4', '#8b5cf6'], width: 6, rarity: 'legendary' },
  supernova_border: { id: 'supernova_border', name: 'Starlight Halo', style: 'animated', animation: 'supernova', color: '#fef08a', width: 6, rarity: 'legendary' },
  phoenix_border: { id: 'phoenix_border', name: 'Flame Feathers', style: 'animated', animation: 'phoenix', color: '#f97316', width: 6, rarity: 'legendary' },
  dragon_border: { id: 'dragon_border', name: 'Dragon Scales', style: 'animated', animation: 'dragon', color: '#dc2626', width: 6, rarity: 'legendary' },
  crystal_border: { id: 'crystal_border', name: 'Amethyst Crown', style: 'animated', animation: 'crystal', color: '#c4b5fd', width: 6, rarity: 'legendary' },
  // Ultra (3) - Reality-Bending
  void_border: { id: 'void_border', name: 'Abyss Tendrils', style: 'animated', animation: 'void', color: '#18181b', width: 7, rarity: 'ultra' },
  cosmic_rift: { id: 'cosmic_rift', name: 'Quantum Weave', style: 'animated', animation: 'rift', color: '#e879f9', width: 7, rarity: 'ultra' },
  quantum_border: { id: 'quantum_border', name: 'Infinity Loop', style: 'animated', animation: 'quantum', color: '#818cf8', width: 7, rarity: 'ultra' },
  // Divine (1) - Ultimate
  divine_halo: { id: 'divine_halo', name: 'Angel Wings', style: 'animated', animation: 'halo', color: '#fef9c3', width: 8, rarity: 'divine' },
}

export const getProfileBackgroundInfo = (bgId: string | null): ProfileBackgroundInfo | null => {
  if (!bgId) return null
  return PROFILE_BACKGROUNDS[bgId] || null
}

export const getProfileEffectInfo = (effectId: string | null): ProfileEffectInfo | null => {
  if (!effectId) return null
  return PROFILE_EFFECTS[effectId] || null
}

export const getProfileBorderInfo = (borderId: string | null): ProfileBorderInfo | null => {
  if (!borderId) return null
  return PROFILE_BORDERS[borderId] || null
}
