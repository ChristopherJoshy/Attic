/**
 * Embedding Cache Service
 * 
 * Caches embeddings for RAG operations to reduce redundant embedding API calls.
 * Supports similarity-based cache retrieval for approximate matching.
 */

import { TTLCache, cacheKey, CacheStats, CacheStrategy } from '../utils/ttl-cache.js';

/**
 * Configuration for the embedding cache
 */
export interface EmbeddingCacheConfig {
    enabled: boolean;
    defaultTtlMs: number;
    maxSize: number;
    strategy: CacheStrategy;
    similarityThreshold: number; // Threshold for similarity-based retrieval (0-1)
    embeddingDimension: number; // Expected embedding dimension
}

/**
 * Cached embedding entry
 */
export interface CachedEmbedding {
    embedding: number[];
    text: string;
    model: string;
    provider: string;
    cachedAt: number;
    tokenCount: number;
}

/**
 * Result of a similarity search
 */
export interface SimilarityResult {
    embedding: CachedEmbedding;
    similarity: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EmbeddingCacheConfig = {
    enabled: true,
    defaultTtlMs: 60 * 60 * 1000, // 1 hour (embeddings are more stable)
    maxSize: 5000,
    strategy: 'lfu', // LFU is better for embeddings as frequently used ones should stay cached
    similarityThreshold: 0.98, // Very high threshold for exact-ish matches
    embeddingDimension: 1536, // OpenAI default
};

/**
 * Embedding Cache Service
 * 
 * Singleton service for caching embeddings with support for:
 * - Exact text matching
 * - Similarity-based retrieval
 * - Batch operations
 * - Statistics and monitoring
 */
export class EmbeddingCacheService {
    private static instance: EmbeddingCacheService;
    private cache: TTLCache<CachedEmbedding>;
    private config: EmbeddingCacheConfig;
    private textToKey: Map<string, string> = new Map(); // For fast exact lookups

    private constructor(config: Partial<EmbeddingCacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cache = new TTLCache<CachedEmbedding>({
            ttl: this.config.defaultTtlMs,
            maxSize: this.config.maxSize,
            strategy: this.config.strategy,
            namespace: 'embeddings',
        });
    }

    /**
     * Get the singleton instance
     */
    static getInstance(config?: Partial<EmbeddingCacheConfig>): EmbeddingCacheService {
        if (!EmbeddingCacheService.instance) {
            EmbeddingCacheService.instance = new EmbeddingCacheService(config);
        }
        return EmbeddingCacheService.instance;
    }

    /**
     * Initialize or reconfigure the cache
     */
    configure(config: Partial<EmbeddingCacheConfig>): void {
        this.config = { ...this.config, ...config };
        
        // Recreate cache with new settings
        this.cache.destroy();
        this.textToKey.clear();
        this.cache = new TTLCache<CachedEmbedding>({
            ttl: this.config.defaultTtlMs,
            maxSize: this.config.maxSize,
            strategy: this.config.strategy,
            namespace: 'embeddings',
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
     * Normalize text for consistent caching
     */
    private normalizeText(text: string): string {
        return text.trim().toLowerCase().replace(/\s+/g, ' ');
    }

    /**
     * Generate a cache key for text
     */
    generateCacheKey(text: string, model: string, provider: string): string {
        const normalizedText = this.normalizeText(text);
        return cacheKey('embedding', normalizedText, model.toLowerCase(), provider.toLowerCase());
    }

    /**
     * Get an embedding by exact text match
     */
    get(text: string, model: string, provider: string): CachedEmbedding | null {
        if (!this.config.enabled) {
            return null;
        }

        const key = this.generateCacheKey(text, model, provider);
        const cached = this.cache.get(key);

        return cached || null;
    }

    /**
     * Store an embedding in the cache
     */
    set(
        text: string,
        embedding: number[],
        model: string,
        provider: string,
        tokenCount?: number,
        ttlMs?: number
    ): void {
        if (!this.config.enabled) {
            return;
        }

        // Don't cache empty or invalid embeddings
        if (!embedding || embedding.length === 0) {
            return;
        }

        const key = this.generateCacheKey(text, model, provider);
        const normalizedText = this.normalizeText(text);

        const cachedEmbedding: CachedEmbedding = {
            embedding,
            text: normalizedText,
            model: model.toLowerCase(),
            provider: provider.toLowerCase(),
            cachedAt: Date.now(),
            tokenCount: tokenCount ?? this.estimateTokenCount(text),
        };

        this.cache.set(key, cachedEmbedding, ttlMs ?? this.config.defaultTtlMs);
        this.textToKey.set(normalizedText, key);
    }

    /**
     * Get or compute an embedding
     */
    async getOrCompute(
        text: string,
        model: string,
        provider: string,
        compute: () => Promise<{ embedding: number[]; tokenCount?: number }>,
        ttlMs?: number
    ): Promise<CachedEmbedding> {
        const cached = this.get(text, model, provider);
        if (cached) {
            return cached;
        }

        const result = await compute();
        this.set(text, result.embedding, model, provider, result.tokenCount, ttlMs);

        return {
            embedding: result.embedding,
            text: this.normalizeText(text),
            model: model.toLowerCase(),
            provider: provider.toLowerCase(),
            cachedAt: Date.now(),
            tokenCount: result.tokenCount ?? this.estimateTokenCount(text),
        };
    }

    /**
     * Batch get embeddings
     */
    getBatch(
        texts: string[],
        model: string,
        provider: string
    ): Map<number, CachedEmbedding> {
        const results = new Map<number, CachedEmbedding>();
        
        texts.forEach((text, index) => {
            const cached = this.get(text, model, provider);
            if (cached) {
                results.set(index, cached);
            }
        });

        return results;
    }

    /**
     * Batch set embeddings
     */
    setBatch(
        items: Array<{
            text: string;
            embedding: number[];
            model: string;
            provider: string;
            tokenCount?: number;
        }>,
        ttlMs?: number
    ): void {
        items.forEach(item => {
            this.set(item.text, item.embedding, item.model, item.provider, item.tokenCount, ttlMs);
        });
    }

    /**
     * Find similar embeddings in the cache
     * Uses cosine similarity for comparison
     */
    findSimilar(
        embedding: number[],
        model: string,
        provider: string,
        threshold?: number
    ): SimilarityResult[] {
        if (!this.config.enabled) {
            return [];
        }

        const results: SimilarityResult[] = [];
        const effectiveThreshold = threshold ?? this.config.similarityThreshold;

        // Get all cached entries (this is expensive for large caches)
        const stats = this.cache.stats();
        
        // Only do similarity search if cache is reasonably sized
        if (stats.size > 10000) {
            console.warn('[EmbeddingCache] Cache too large for similarity search, skipping');
            return [];
        }

        // Iterate through cache entries
        for (const key of this.cache.keys()) {
            const entry = this.cache.getEntry(key);
            if (!entry || entry.value.model !== model.toLowerCase() || 
                entry.value.provider !== provider.toLowerCase()) {
                continue;
            }

            const similarity = this.cosineSimilarity(embedding, entry.value.embedding);
            
            if (similarity >= effectiveThreshold) {
                results.push({
                    embedding: entry.value,
                    similarity,
                });
            }
        }

        // Sort by similarity descending
        results.sort((a, b) => b.similarity - a.similarity);

        return results;
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Estimate token count for a text
     * Simple approximation: ~4 characters per token
     */
    private estimateTokenCount(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /**
     * Clear all cached embeddings
     */
    clear(): void {
        this.cache.clear();
        this.textToKey.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return this.cache.stats();
    }

    /**
     * Get estimated API call savings
     */
    getSavings(): { apiCallsSaved: number; tokensSaved: number } {
        const stats = this.cache.stats();
        // Each hit represents a saved API call
        return {
            apiCallsSaved: stats.hits,
            tokensSaved: 0, // Would need to track this per entry
        };
    }

    /**
     * Destroy the cache and cleanup resources
     */
    destroy(): void {
        this.cache.destroy();
        this.textToKey.clear();
    }
}

// Export singleton instance
export const embeddingCache = EmbeddingCacheService.getInstance();

/**
 * Initialize the embedding cache with configuration
 */
export function initEmbeddingCache(config: Partial<EmbeddingCacheConfig>): void {
    EmbeddingCacheService.getInstance().configure(config);
}
