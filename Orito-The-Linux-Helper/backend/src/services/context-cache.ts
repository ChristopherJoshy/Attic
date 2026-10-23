/**
 * Conversation Context Cache Service
 * 
 * Caches conversation context for quick resumption, stores frequently used
 * context snippets, and pre-computes context for common queries.
 */

import { TTLCache, cacheKey, CacheStats, CacheStrategy } from '../utils/ttl-cache.js';

/**
 * Configuration for the context cache
 */
export interface ContextCacheConfig {
    enabled: boolean;
    defaultTtlMs: number;
    maxSize: number;
    strategy: CacheStrategy;
    maxContextSize: number; // Maximum context size in characters
    precomputeCommonQueries: boolean;
}

/**
 * Cached conversation context
 */
export interface CachedContext {
    sessionId: string;
    userId: string;
    messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: number;
    }>;
    metadata: {
        messageCount: number;
        totalTokens: number;
        lastActivity: number;
        createdAt: number;
    };
    summary?: string; // Optional summary for long conversations
}

/**
 * Pre-computed context for common queries
 */
export interface PrecomputedContext {
    query: string;
    context: string;
    sources: string[];
    computedAt: number;
    hitCount: number;
}

/**
 * Context snippet for frequently used content
 */
export interface ContextSnippet {
    id: string;
    content: string;
    category: string;
    tags: string[];
    usageCount: number;
    lastUsed: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ContextCacheConfig = {
    enabled: true,
    defaultTtlMs: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 500,
    strategy: 'lru',
    maxContextSize: 100000, // ~100k characters
    precomputeCommonQueries: true,
};

/**
 * Common query patterns for pre-computation
 */
const COMMON_QUERY_PATTERNS = [
    'hello',
    'hi',
    'help',
    'what can you do',
    'how does this work',
    'explain',
    'summarize',
];

/**
 * Context Cache Service
 * 
 * Singleton service for caching conversation context with support for:
 * - Session context caching for quick resumption
 * - Frequently used context snippets
 * - Pre-computed context for common queries
 * - Statistics and monitoring
 */
export class ContextCacheService {
    private static instance: ContextCacheService;
    private sessionCache: TTLCache<CachedContext>;
    private snippetCache: TTLCache<ContextSnippet>;
    private precomputedCache: TTLCache<PrecomputedContext>;
    private config: ContextCacheConfig;

    private constructor(config: Partial<ContextCacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        this.sessionCache = new TTLCache<CachedContext>({
            ttl: this.config.defaultTtlMs,
            maxSize: this.config.maxSize,
            strategy: this.config.strategy,
            namespace: 'context-sessions',
        });

        this.snippetCache = new TTLCache<ContextSnippet>({
            ttl: 7 * 24 * 60 * 60 * 1000, // 7 days for snippets
            maxSize: 1000,
            strategy: 'lfu', // Use LFU for snippets
            namespace: 'context-snippets',
        });

        this.precomputedCache = new TTLCache<PrecomputedContext>({
            ttl: this.config.defaultTtlMs,
            maxSize: 100,
            strategy: 'lfu',
            namespace: 'context-precomputed',
        });
    }

    /**
     * Get the singleton instance
     */
    static getInstance(config?: Partial<ContextCacheConfig>): ContextCacheService {
        if (!ContextCacheService.instance) {
            ContextCacheService.instance = new ContextCacheService(config);
        }
        return ContextCacheService.instance;
    }

    /**
     * Initialize or reconfigure the cache
     */
    configure(config: Partial<ContextCacheConfig>): void {
        this.config = { ...this.config, ...config };
        
        // Recreate caches with new settings
        this.sessionCache.destroy();
        this.snippetCache.destroy();
        this.precomputedCache.destroy();

        this.sessionCache = new TTLCache<CachedContext>({
            ttl: this.config.defaultTtlMs,
            maxSize: this.config.maxSize,
            strategy: this.config.strategy,
            namespace: 'context-sessions',
        });

        this.snippetCache = new TTLCache<ContextSnippet>({
            ttl: 7 * 24 * 60 * 60 * 1000,
            maxSize: 1000,
            strategy: 'lfu',
            namespace: 'context-snippets',
        });

        this.precomputedCache = new TTLCache<PrecomputedContext>({
            ttl: this.config.defaultTtlMs,
            maxSize: 100,
            strategy: 'lfu',
            namespace: 'context-precomputed',
        });
    }

    /**
     * Check if caching is enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Enable or disable caching
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    // ============================================
    // Session Context Methods
    // ============================================

    /**
     * Generate a cache key for a session
     */
    private sessionKey(sessionId: string, userId: string): string {
        return cacheKey('session', sessionId, userId);
    }

    /**
     * Get cached session context
     */
    getSession(sessionId: string, userId: string): CachedContext | null {
        if (!this.config.enabled) {
            return null;
        }

        const key = this.sessionKey(sessionId, userId);
        return this.sessionCache.get(key) || null;
    }

    /**
     * Store session context
     */
    setSession(
        sessionId: string,
        userId: string,
        messages: CachedContext['messages'],
        summary?: string,
        ttlMs?: number
    ): void {
        if (!this.config.enabled) {
            return;
        }

        const key = this.sessionKey(sessionId, userId);
        const now = Date.now();

        // Truncate if too large
        let truncatedMessages = messages;
        let totalSize = messages.reduce((sum, m) => sum + m.content.length, 0);
        
        if (totalSize > this.config.maxContextSize) {
            // Keep the most recent messages that fit
            truncatedMessages = [];
            let currentSize = 0;
            for (let i = messages.length - 1; i >= 0; i--) {
                if (currentSize + messages[i].content.length > this.config.maxContextSize) {
                    break;
                }
                truncatedMessages.unshift(messages[i]);
                currentSize += messages[i].content.length;
            }
        }

        const context: CachedContext = {
            sessionId,
            userId,
            messages: truncatedMessages,
            metadata: {
                messageCount: truncatedMessages.length,
                totalTokens: Math.ceil(totalSize / 4), // Approximate
                lastActivity: now,
                createdAt: now,
            },
            summary,
        };

        this.sessionCache.set(key, context, ttlMs ?? this.config.defaultTtlMs);
    }

    /**
     * Update session with new message
     */
    appendToSession(
        sessionId: string,
        userId: string,
        message: { role: 'user' | 'assistant' | 'system'; content: string }
    ): void {
        if (!this.config.enabled) {
            return;
        }

        const existing = this.getSession(sessionId, userId);
        if (existing) {
            existing.messages.push({
                ...message,
                timestamp: Date.now(),
            });
            existing.metadata.messageCount++;
            existing.metadata.lastActivity = Date.now();
            
            // Re-cache with updated content
            this.setSession(
                sessionId,
                userId,
                existing.messages,
                existing.summary
            );
        }
    }

    /**
     * Delete a session from cache
     */
    deleteSession(sessionId: string, userId: string): boolean {
        const key = this.sessionKey(sessionId, userId);
        return this.sessionCache.delete(key);
    }

    // ============================================
    // Snippet Methods
    // ============================================

    /**
     * Store a context snippet
     */
    setSnippet(snippet: Omit<ContextSnippet, 'usageCount' | 'lastUsed'>): void {
        if (!this.config.enabled) {
            return;
        }

        const entry: ContextSnippet = {
            ...snippet,
            usageCount: 0,
            lastUsed: Date.now(),
        };

        this.snippetCache.set(snippet.id, entry);
    }

    /**
     * Get a context snippet by ID
     */
    getSnippet(id: string): ContextSnippet | null {
        if (!this.config.enabled) {
            return null;
        }

        const snippet = this.snippetCache.get(id);
        if (snippet) {
            // Update usage stats
            snippet.usageCount++;
            snippet.lastUsed = Date.now();
        }
        return snippet || null;
    }

    /**
     * Get snippets by category
     */
    getSnippetsByCategory(category: string): ContextSnippet[] {
        const results: ContextSnippet[] = [];
        
        for (const key of this.snippetCache.keys()) {
            const snippet = this.snippetCache.get(key);
            if (snippet && snippet.category === category) {
                results.push(snippet);
            }
        }

        return results.sort((a, b) => b.usageCount - a.usageCount);
    }

    /**
     * Get snippets by tags
     */
    getSnippetsByTags(tags: string[]): ContextSnippet[] {
        const results: ContextSnippet[] = [];
        
        for (const key of this.snippetCache.keys()) {
            const snippet = this.snippetCache.get(key);
            if (snippet && tags.some(tag => snippet.tags.includes(tag))) {
                results.push(snippet);
            }
        }

        return results.sort((a, b) => b.usageCount - a.usageCount);
    }

    // ============================================
    // Pre-computed Context Methods
    // ============================================

    /**
     * Check if a query matches a common pattern
     */
    isCommonQuery(query: string): boolean {
        const normalized = query.toLowerCase().trim();
        return COMMON_QUERY_PATTERNS.some(pattern => 
            normalized.includes(pattern) || pattern.includes(normalized)
        );
    }

    /**
     * Get pre-computed context for a query
     */
    getPrecomputed(query: string): PrecomputedContext | null {
        if (!this.config.enabled || !this.config.precomputeCommonQueries) {
            return null;
        }

        const normalized = query.toLowerCase().trim();
        const key = cacheKey('precomputed', normalized);
        
        const cached = this.precomputedCache.get(key);
        if (cached) {
            // Update hit count
            cached.hitCount++;
        }
        return cached || null;
    }

    /**
     * Store pre-computed context
     */
    setPrecomputed(
        query: string,
        context: string,
        sources: string[],
        ttlMs?: number
    ): void {
        if (!this.config.enabled || !this.config.precomputeCommonQueries) {
            return;
        }

        const normalized = query.toLowerCase().trim();
        const key = cacheKey('precomputed', normalized);

        const precomputed: PrecomputedContext = {
            query: normalized,
            context,
            sources,
            computedAt: Date.now(),
            hitCount: 0,
        };

        this.precomputedCache.set(key, precomputed, ttlMs ?? this.config.defaultTtlMs);
    }

    // ============================================
    // Utility Methods
    // ============================================

    /**
     * Clear all caches
     */
    clearAll(): void {
        this.sessionCache.clear();
        this.snippetCache.clear();
        this.precomputedCache.clear();
    }

    /**
     * Clear session cache only
     */
    clearSessions(): void {
        this.sessionCache.clear();
    }

    /**
     * Clear snippets cache only
     */
    clearSnippets(): void {
        this.snippetCache.clear();
    }

    /**
     * Clear pre-computed cache only
     */
    clearPrecomputed(): void {
        this.precomputedCache.clear();
    }

    /**
     * Get combined statistics
     */
    getStats(): {
        sessions: CacheStats;
        snippets: CacheStats;
        precomputed: CacheStats;
    } {
        return {
            sessions: this.sessionCache.stats(),
            snippets: this.snippetCache.stats(),
            precomputed: this.precomputedCache.stats(),
        };
    }

    /**
     * Get total cache size
     */
    getTotalSize(): number {
        const sessionStats = this.sessionCache.stats();
        const snippetStats = this.snippetCache.stats();
        const precomputedStats = this.precomputedCache.stats();

        return sessionStats.size + snippetStats.size + precomputedStats.size;
    }

    /**
     * Destroy all caches and cleanup resources
     */
    destroy(): void {
        this.sessionCache.destroy();
        this.snippetCache.destroy();
        this.precomputedCache.destroy();
    }
}

// Export singleton instance
export const contextCache = ContextCacheService.getInstance();

/**
 * Initialize the context cache with configuration
 */
export function initContextCache(config: Partial<ContextCacheConfig>): void {
    ContextCacheService.getInstance().configure(config);
}
