import mongoose from 'mongoose';
import { UserApiKey, type APIKeyProvider } from '../models/user-api-keys.js';
import { config } from '../config/index.js';

/**
 * Result of API key resolution
 */
export interface ApiKeyResolutionResult {
    /** The API key to use */
    apiKey: string;
    /** Whether this is a user's personal key */
    isUserKey: boolean;
    /** The provider the key was resolved for */
    provider: APIKeyProvider;
}

/**
 * Resolves the appropriate API key for a user, falling back to system defaults.
 * 
 * Priority:
 * 1. User's personal API key for the provider
 * 2. System default API key (if configured)
 * 
 * @param userId - The user's ID (can be string or ObjectId)
 * @param provider - The provider to get the key for
 * @returns The API key resolution result
 */
export async function resolveApiKey(
    userId: string | mongoose.Types.ObjectId | null | undefined,
    provider: APIKeyProvider
): Promise<ApiKeyResolutionResult> {
    // If user is authenticated, check for their personal key first
    if (userId) {
        try {
            const userObjectId = typeof userId === 'string' 
                ? new mongoose.Types.ObjectId(userId) 
                : userId;
            
            const userKey = await UserApiKey.getDecryptedKey(userObjectId, provider);
            
            if (userKey) {
                return {
                    apiKey: userKey,
                    isUserKey: true,
                    provider
                };
            }
        } catch (error) {
            console.error(`Error fetching user API key for ${provider}:`, error);
            // Continue to fallback
        }
    }
    
    // Fall back to system default key
    const systemKey = getSystemDefaultKey(provider);
    
    if (!systemKey) {
        throw new Error(`No API key available for provider ${provider}. User must configure their own key or system default must be set.`);
    }
    
    return {
        apiKey: systemKey,
        isUserKey: false,
        provider
    };
}

/**
 * Get the system default API key for a provider
 * Only OpenRouter is supported
 */
function getSystemDefaultKey(provider: APIKeyProvider): string | null {
    if (provider === 'openrouter') {
        return config.OPENROUTER_API_KEY || null;
    }
    return null;
}

/**
 * Check if a user has their own API key configured for a provider
 */
export async function hasUserApiKey(
    userId: string | mongoose.Types.ObjectId | null | undefined,
    provider: APIKeyProvider
): Promise<boolean> {
    if (!userId) {
        return false;
    }
    
    try {
        const userObjectId = typeof userId === 'string' 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
        
        const userKey = await UserApiKey.getDecryptedKey(userObjectId, provider);
        return !!userKey;
    } catch {
        return false;
    }
}

/**
 * Get the effective API key for OpenRouter operations
 * This is a convenience function for the most common use case
 */
export async function getOpenRouterApiKey(
    userId: string | mongoose.Types.ObjectId | null | undefined
): Promise<ApiKeyResolutionResult> {
    return resolveApiKey(userId, 'openrouter');
}
