/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Global Constants - Shared configuration values for Frontend.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * None
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * DEFAULT_ELO: Starting Elo.
 * MAX_ELO_CHANGE_PER_MATCH: Cap on Elo change.
 * MATCH_TIMEOUT_MS: Match auto-cleanup timeout.
 * QUEUE_UPDATE_INTERVAL_MS: Polling/Update rate for queue.
 * WS_RECONNECT_BASE_DELAY_MS: WebSocket reconnect backoff start.
 * WS_RECONNECT_MAX_DELAY_MS: WebSocket reconnect backoff max.
 * GAME_COUNTDOWN_SECONDS: Pre-game timer.
 * DEFAULT_GAME_DURATION_SECONDS: Length of a match.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * None
 */

export const DEFAULT_ELO = 1000
export const MAX_ELO_CHANGE_PER_MATCH = 50
export const MATCH_TIMEOUT_MS = 15000
export const QUEUE_UPDATE_INTERVAL_MS = 1000
export const WS_RECONNECT_BASE_DELAY_MS = 3000
export const WS_RECONNECT_MAX_DELAY_MS = 30000
export const GAME_COUNTDOWN_SECONDS = 5
export const DEFAULT_GAME_DURATION_SECONDS = 30
