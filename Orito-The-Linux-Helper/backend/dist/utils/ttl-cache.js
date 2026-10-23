import { createHash } from 'crypto';
export class TTLCache {
    cache = new Map();
    hits = 0;
    misses = 0;
    maxEntries;
    defaultTtlMs;
    cleanupInterval;
    constructor(options) {
        this.maxEntries = options?.maxEntries ?? 500;
        this.defaultTtlMs = options?.defaultTtlMs ?? 5 * 60 * 1000; // 5 minutes
        const cleanupMs = options?.cleanupIntervalMs ?? 60_000; // 1 minute
        this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);
        // Allow the process to exit even if the interval is still running
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return undefined;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }
        entry.accessedAt = Date.now();
        this.hits++;
        return entry.value;
    }
    set(key, value, ttlMs) {
        // Evict LRU entries if at capacity
        if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
            this.evictLRU();
        }
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
            accessedAt: Date.now(),
        });
    }
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
    stats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%',
            maxEntries: this.maxEntries,
            defaultTtlMs: this.defaultTtlMs,
        };
    }
    destroy() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
    evictLRU() {
        let oldestKey = null;
        let oldestAccess = Infinity;
        for (const [key, entry] of this.cache) {
            if (entry.accessedAt < oldestAccess) {
                oldestAccess = entry.accessedAt;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
}
/**
 * Generate a stable cache key from arbitrary input (messages array, strings, objects).
 * Uses SHA-256 for fast, collision-resistant hashing.
 */
export function cacheKey(...parts) {
    const hash = createHash('sha256');
    for (const part of parts) {
        if (typeof part === 'string') {
            hash.update(part);
        }
        else {
            hash.update(JSON.stringify(part));
        }
    }
    return hash.digest('hex');
}
//# sourceMappingURL=ttl-cache.js.map