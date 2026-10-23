export interface CacheStats {
    size: number;
    hits: number;
    misses: number;
    hitRate: string;
    maxEntries: number;
    defaultTtlMs: number;
}
export declare class TTLCache<T = unknown> {
    private cache;
    private hits;
    private misses;
    private readonly maxEntries;
    private readonly defaultTtlMs;
    private cleanupInterval;
    constructor(options?: {
        maxEntries?: number;
        defaultTtlMs?: number;
        cleanupIntervalMs?: number;
    });
    get(key: string): T | undefined;
    set(key: string, value: T, ttlMs?: number): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    stats(): CacheStats;
    destroy(): void;
    private cleanup;
    private evictLRU;
}
/**
 * Generate a stable cache key from arbitrary input (messages array, strings, objects).
 * Uses SHA-256 for fast, collision-resistant hashing.
 */
export declare function cacheKey(...parts: unknown[]): string;
//# sourceMappingURL=ttl-cache.d.ts.map