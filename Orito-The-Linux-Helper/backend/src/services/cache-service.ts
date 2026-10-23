/**
 * Response Caching Service
 * 
 * Provides intelligent caching for LLM responses to reduce token consumption
 * and optimize for minimal latency and instant response delivery.
 */

import { TTLCache, cacheKey, CacheStats, CacheStrategy, cacheManager } from '../utils/ttl-cache.js';

/**
 * Configuration for the response cache
 */
export interface ResponseCacheConfig {
    enabled: boolean;
    defaultTtlMs: number;
    maxSize: number;
    strategy: CacheStrategy;
    semanticSimilarityThreshold?: number; // For optional semantic matching
}

/**
 * Cached LLM response
 */
export interface CachedResponse {
    content: string;
    model: string;
    provider: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    cachedAt: number;
    responseTime: number; // Original response time in ms
}

/**
 * Request parameters for cache key generation
 */
export interface CacheKeyParams {
    messages: Array<{ role: string; content: string }>;
    model: string;
    provider?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    tools?: unknown[];
    toolChoice?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ResponseCacheConfig = {
    enabled: true,
    defaultTtlMs: 30 * 60 * 1000, // 30 minutes
    maxSize: 1000,
    strategy: 'lru',
    semanticSimilarityThreshold: 0.95,
};

/**
 * Response Cache Service
 * 
 * Singleton service for caching LLM responses with support for:
 * - Configurable TTL per cache type
 * - Cache key generation based on messages, model, and parameters
 * - Optional semantic similarity matching
 * - Statistics and monitoring
 */
export class ResponseCacheService {
    private static instance: ResponseCacheService;
    private cache: TTLCache<CachedResponse>;
    private config: ResponseCacheConfig;
    private semanticCache: TTLCache<{ embedding: number[]; response: CachedResponse }> | null = null;

    private constructor(config: Partial<ResponseCacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cache = new TTLCache<CachedResponse>({
            ttl: this.config.defaultTtlMs,
            maxSize: this.config.maxSize,
            strategy: this.config.strategy,
            namespace: 'llm-responses',
        });
    }

    /**
     * Get the singleton instance
     */
    static getInstance(config?: Partial<ResponseCacheConfig>): ResponseCacheService {
        if (!ResponseCacheService.instance) {
            ResponseCacheService.instance = new ResponseCacheService(config);
        }
        return ResponseCacheService.instance;
    }

    /**
     * Initialize or reconfigure the cache
     */
    configure(config: Partial<ResponseCacheConfig>): void {
        this.config = { ...this.config, ...config };
        
        // Recreate cache with new settings
        this.cache.destroy();
        this.cache = new TTLCache<CachedResponse>({
            ttl: this.config.defaultTtlMs,
            maxSize: this.config.maxSize,
            strategy: this.config.strategy,
            namespace: 'llm-responses',
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

    /**
     * Generate a cache key from request parameters
     */
    generateCacheKey(params: CacheKeyParams): string {
        // Normalize and sort messages for consistent hashing
        const normalizedMessages = params.messages.map(m => ({
            role: m.role.toLowerCase().trim(),
            content: m.content.trim(),
        }));

        // Include relevant parameters in the key
        const keyData = {
            messages: normalizedMessages,
            model: params.model.toLowerCase().trim(),
            provider: params.provider?.toLowerCase().trim() || 'default',
            temperature: params.temperature ?? 1.0,
            maxTokens: params.maxTokens ?? 4096,
            systemPrompt: params.systemPrompt?.trim() || '',
            hasTools: !!params.tools?.length,
            toolChoice: params.toolChoice || 'auto',
        };

        return cacheKey('llm-response', keyData);
    }

    /**
     * Get a cached response
     */
    get(params: CacheKeyParams): CachedResponse | null {
        if (!this.config.enabled) {
            return null;
        }

        const key = this.generateCacheKey(params);
        const cached = this.cache.get(key);

        if (cached) {
            return {
                ...cached,
                // Mark as cached for client awareness
                cachedAt: cached.cachedAt,
            };
        }

        return null;
    }

    /**
     * Store a response in the cache
     */
    set(
        params: CacheKeyParams,
        response: Omit<CachedResponse, 'cachedAt'>,
        ttlMs?: number
    ): void {
        if (!this.config.enabled) {
            return;
        }

        // Don't cache empty or error responses
        if (!response.content || response.content.trim().length === 0) {
            return;
        }

        const key = this.generateCacheKey(params);
        const cachedResponse: CachedResponse = {
            ...response,
            cachedAt: Date.now(),
        };

        this.cache.set(key, cachedResponse, ttlMs ?? this.config.defaultTtlMs);
    }

    /**
     * Get or compute a response
     */
    async getOrCompute(
        params: CacheKeyParams,
        compute: () => Promise<Omit<CachedResponse, 'cachedAt'>>,
        ttlMs?: number
    ): Promise<CachedResponse> {
        const cached = this.get(params);
        if (cached) {
            return cached;
        }

        const response = await compute();
        this.set(params, response, ttlMs);
        
        return {
            ...response,
            cachedAt: Date.now(),
        };
    }

    /**
     * Invalidate cache entries matching a pattern
     */
    invalidate(pattern: string): number {
        return this.cache.invalidatePattern(pattern);
    }

    /**
     * Invalidate all entries for a specific model
     */
    invalidateModel(model: string): number {
        // This is a best-effort invalidation since we hash the keys
        // We would need to track model->keys mapping for precise invalidation
        const stats = this.cache.stats();
        this.cache.clear();
        return stats.size;
    }

    /**
     * Clear all cached responses
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return this.cache.stats();
    }

    /**
     * Get estimated token savings from cache hits
     */
    getTokenSavings(): { promptTokens: number; completionTokens: number; totalTokens: number } {
        const stats = this.cache.stats();
        // This is an approximation - actual savings would need tracking
        // Average token usage per cached response
        return {
            promptTokens: 0, // Would need to track this
            completionTokens: 0,
            totalTokens: 0,
        };
    }

    /**
     * Destroy the cache and cleanup resources
     */
    destroy(): void {
        this.cache.destroy();
        if (this.semanticCache) {
            this.semanticCache.destroy();
        }
    }
}

// Export singleton instance
export const responseCache = ResponseCacheService.getInstance();

/**
 * Initialize the response cache with configuration
 */
export function initResponseCache(config: Partial<ResponseCacheConfig>): void {
    ResponseCacheService.getInstance().configure(config);
}
