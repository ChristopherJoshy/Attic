import { createHash } from 'crypto';

/**
 * Cache strategy types
 */
export type CacheStrategy = 'lru' | 'lfu' | 'simple';

/**
 * Options for configuring a cache instance
 */
export interface CacheOptions {
    ttl?: number; // TTL in milliseconds
    namespace?: string;
    strategy?: CacheStrategy;
    maxSize?: number;
    cleanupIntervalMs?: number;
}

/**
 * Internal cache entry with metadata for different strategies
 */
interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    accessedAt: number;
    accessCount: number; // For LFU strategy
    createdAt: number;
    key: string;
}

/**
 * Extended cache statistics
 */
export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
    evictions: number;
    namespace: string;
    strategy: CacheStrategy;
    memoryUsage?: number; // Estimated memory usage in bytes
    oldestEntry?: number; // Timestamp of oldest entry
    newestEntry?: number; // Timestamp of newest entry
}

/**
 * Cache manager for tracking all cache instances
 */
class CacheManager {
    private static instance: CacheManager;
    private caches: Map<string, TTLCache<any>> = new Map();
    private globalHits = 0;
    private globalMisses = 0;

    static getInstance(): CacheManager {
        if (!CacheManager.instance) {
            CacheManager.instance = new CacheManager();
        }
        return CacheManager.instance;
    }

    register(namespace: string, cache: TTLCache<any>): void {
        this.caches.set(namespace, cache);
    }

    unregister(namespace: string): void {
        this.caches.delete(namespace);
    }

    get(namespace: string): TTLCache<any> | undefined {
        return this.caches.get(namespace);
    }

    getAll(): Map<string, TTLCache<any>> {
        return this.caches;
    }

    recordHit(): void {
        this.globalHits++;
    }

    recordMiss(): void {
        this.globalMisses++;
    }

    getGlobalStats(): { hits: number; misses: number; hitRate: number } {
        const total = this.globalHits + this.globalMisses;
        return {
            hits: this.globalHits,
            misses: this.globalMisses,
            hitRate: total > 0 ? this.globalHits / total : 0,
        };
    }

    clearAll(): void {
        for (const cache of this.caches.values()) {
            cache.clear();
        }
        this.globalHits = 0;
        this.globalMisses = 0;
    }

    clearNamespace(namespace: string): boolean {
        const cache = this.caches.get(namespace);
        if (cache) {
            cache.clear();
            return true;
        }
        return false;
    }

    getAllStats(): Record<string, CacheStats> {
        const stats: Record<string, CacheStats> = {};
        for (const [namespace, cache] of this.caches) {
            stats[namespace] = cache.stats();
        }
        return stats;
    }
}

export const cacheManager = CacheManager.getInstance();

/**
 * Enhanced TTL Cache with support for LRU, LFU, and simple strategies.
 * Supports namespacing, statistics tracking, and pattern-based invalidation.
 */
export class TTLCache<T = unknown> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private hits = 0;
    private misses = 0;
    private evictions = 0;
    private readonly maxEntries: number;
    private readonly defaultTtlMs: number;
    private readonly namespace: string;
    private readonly strategy: CacheStrategy;
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor(options?: CacheOptions) {
        this.maxEntries = options?.maxSize ?? 500;
        this.defaultTtlMs = options?.ttl ?? 5 * 60 * 1000; // 5 minutes
        this.namespace = options?.namespace ?? 'default';
        this.strategy = options?.strategy ?? 'lru';
        const cleanupMs = options?.cleanupIntervalMs ?? 60_000; // 1 minute

        this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);
        // Allow the process to exit even if the interval is still running
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }

        // Register with cache manager
        cacheManager.register(this.namespace, this);
    }

    /**
     * Get a value from the cache
     */
    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            cacheManager.recordMiss();
            return undefined;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            cacheManager.recordMiss();
            return undefined;
        }
        // Update access metadata
        entry.accessedAt = Date.now();
        entry.accessCount++;
        this.hits++;
        cacheManager.recordHit();
        return entry.value;
    }

    /**
     * Set a value in the cache
     */
    set(key: string, value: T, ttlMs?: number): void {
        // Evict entries if at capacity
        if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
            this.evict();
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
            accessedAt: Date.now(),
            accessCount: 0,
            createdAt: Date.now(),
            key,
        });
    }

    /**
     * Check if a key exists in the cache (without updating access metadata)
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Delete a specific key from the cache
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all entries in this cache
     */
    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }

    /**
     * Get the number of entries in the cache
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Get all keys in the cache
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Invalidate entries matching a pattern
     * Supports wildcards using * (e.g., "user:*" matches "user:123", "user:profile")
     */
    invalidatePattern(pattern: string): number {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        let count = 0;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Invalidate entries that have been idle for longer than the specified duration
     */
    invalidateIdle(maxIdleMs: number): number {
        const threshold = Date.now() - maxIdleMs;
        let count = 0;
        for (const [key, entry] of this.cache) {
            if (entry.accessedAt < threshold) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Get extended cache statistics
     */
    stats(): CacheStats {
        const total = this.hits + this.misses;
        
        // Calculate memory usage estimate
        let memoryUsage = 0;
        let oldestEntry: number | undefined;
        let newestEntry: number | undefined;
        
        for (const entry of this.cache.values()) {
            // Rough estimate: base overhead + value size approximation
            memoryUsage += 200; // Base entry overhead
            if (typeof entry.value === 'string') {
                memoryUsage += entry.value.length * 2;
            } else if (typeof entry.value === 'object' && entry.value !== null) {
                try {
                    memoryUsage += JSON.stringify(entry.value).length * 2;
                } catch {
                    memoryUsage += 1000; // Fallback estimate
                }
            }
            
            if (!oldestEntry || entry.createdAt < oldestEntry) {
                oldestEntry = entry.createdAt;
            }
            if (!newestEntry || entry.createdAt > newestEntry) {
                newestEntry = entry.createdAt;
            }
        }

        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            size: this.cache.size,
            maxSize: this.maxEntries,
            evictions: this.evictions,
            namespace: this.namespace,
            strategy: this.strategy,
            memoryUsage,
            oldestEntry,
            newestEntry,
        };
    }

    /**
     * Get the raw entry (for debugging/inspection)
     */
    getEntry(key: string): CacheEntry<T> | undefined {
        return this.cache.get(key);
    }

    /**
     * Destroy the cache and cleanup resources
     */
    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
        cacheManager.unregister(this.namespace);
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Evict entries based on the configured strategy
     */
    private evict(): void {
        switch (this.strategy) {
            case 'lru':
                this.evictLRU();
                break;
            case 'lfu':
                this.evictLFU();
                break;
            case 'simple':
                this.evictOldest();
                break;
        }
    }

    /**
     * Evict the least recently used entry
     */
    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestAccess = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.accessedAt < oldestAccess) {
                oldestAccess = entry.accessedAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.evictions++;
        }
    }

    /**
     * Evict the least frequently used entry
     */
    private evictLFU(): void {
        let leastUsedKey: string | null = null;
        let leastCount = Infinity;
        let oldestAccess = Infinity;

        for (const [key, entry] of this.cache) {
            // First compare by access count, then by access time for tie-breaking
            if (entry.accessCount < leastCount || 
                (entry.accessCount === leastCount && entry.accessedAt < oldestAccess)) {
                leastCount = entry.accessCount;
                oldestAccess = entry.accessedAt;
                leastUsedKey = key;
            }
        }

        if (leastUsedKey) {
            this.cache.delete(leastUsedKey);
            this.evictions++;
        }
    }

    /**
     * Evict the oldest entry (simple FIFO-like strategy)
     */
    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestCreated = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.createdAt < oldestCreated) {
                oldestCreated = entry.createdAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.evictions++;
        }
    }
}

/**
 * Generate a stable cache key from arbitrary input (messages array, strings, objects).
 * Uses SHA-256 for fast, collision-resistant hashing.
 */
export function cacheKey(...parts: unknown[]): string {
    const hash = createHash('sha256');
    for (const part of parts) {
        if (typeof part === 'string') {
            hash.update(part);
        } else if (part === null) {
            hash.update('null');
        } else if (part === undefined) {
            hash.update('undefined');
        } else if (typeof part === 'number' || typeof part === 'boolean') {
            hash.update(String(part));
        } else {
            try {
                hash.update(JSON.stringify(part));
            } catch {
                hash.update(String(part));
            }
        }
    }
    return hash.digest('hex');
}

/**
 * Generate a cache key with a namespace prefix
 */
export function namespacedKey(namespace: string, ...parts: unknown[]): string {
    return `${namespace}:${cacheKey(...parts)}`;
}

/**
 * Create a cache with default options from config
 */
export function createCache<T>(options?: CacheOptions): TTLCache<T> {
    return new TTLCache<T>(options);
}
