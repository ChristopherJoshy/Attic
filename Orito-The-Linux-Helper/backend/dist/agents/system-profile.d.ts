/**
 * System Profile Auto-Detection Module
 *
 * This module provides functionality for automatic system profile detection
 * through interactive user questions. It's used by the Curious Agent and
 * Orchestrator to collect system information when command-based discovery
 * is not available or as a preferred user-friendly alternative.
 *
 * Features:
 * - Question-based profile collection with rich UI options
 * - Auto-detection of package managers based on distribution
 * - Profile persistence to chat context and database
 * - Graceful handling of missing or incomplete data
 */
import type { SystemProfile, AgentQuestion } from '../types.js';
import type { IChat } from '../models/chat.js';
export interface SystemProfileData {
    distro: string;
    version: string;
    packageManager: string;
    shell: string;
    desktopEnvironment: string;
    detectedAt: Date;
}
/**
 * Check if system profile exists and is complete
 * Returns the profile if complete, null if not
 */
export declare function getExistingSystemProfile(chat: IChat): SystemProfileData | null;
/**
 * Check if profile exists and ask confirmation if needed
 * Returns the profile or triggers question flow
 */
export declare function ensureSystemProfile(chat: IChat, userId: string, askUserQuestion: (question: string, options: string[], allowCustom: boolean) => Promise<string>): Promise<SystemProfileData | null>;
/**
 * Collect system profile via questions
 * Returns the collected profile
 */
export declare function collectSystemProfile(chat: IChat, userId: string, askUserQuestions: (questions: AgentQuestion[]) => Promise<Record<string, string | string[]>>, saveToDatabase: (chatId: string, profile: SystemProfileData) => Promise<void>): Promise<SystemProfileData>;
/**
 * Convert SystemProfileData to the legacy SystemProfile format
 */
export declare function convertToLegacyProfile(profile: SystemProfileData): SystemProfile;
/**
 * Format system profile for display in prompts
 */
export declare function formatSystemProfileForPrompt(profile: SystemProfileData): string;
/**
 * Check if system profile is incomplete (needs collection)
 */
export declare function isProfileIncomplete(chat: IChat): boolean;
/**
 * Get partial profile data if available (for progressive enhancement)
 */
export declare function getPartialProfile(chat: IChat): Partial<SystemProfileData>;
//# sourceMappingURL=system-profile.d.ts.map