import { TTLCache, cacheKey, type CacheStats } from '../utils/ttl-cache.js';
import { toolConfig } from '../config/tool-config.js';

// Configuration from centralized config
const WIKI_API = toolConfig.wiki.apiUrl;
const WIKI_TIMEOUT_MS = toolConfig.wiki.timeoutMs;

interface WikiResult {
    title: string;
    snippet: string;
    url: string;
}

// Enhanced TTL cache with namespacing and strategy support
const wikiSearchCache = new TTLCache<WikiResult[]>({
    maxSize: toolConfig.wiki.cacheMaxEntries,
    ttl: toolConfig.wiki.cacheTtlMs,
    namespace: 'wiki-search',
    strategy: 'lru',
});

const wikiSummaryCache = new TTLCache<string>({
    maxSize: toolConfig.wiki.cacheMaxEntries,
    ttl: toolConfig.wiki.cacheTtlMs,
    namespace: 'wiki-summary',
    strategy: 'lfu', // Use LFU for summaries as popular ones are accessed often
});

export async function searchWikipedia(query: string, limit: number = 5): Promise<WikiResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    // Check cache
    const key = cacheKey('wiki-search', normalizedQuery, limit);
    const cached = wikiSearchCache.get(key);
    if (cached) return cached;

    const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: String(limit),
        format: 'json',
        origin: '*',
    });

    try {
        const res = await fetch(`${WIKI_API}?${params}`, {
            signal: AbortSignal.timeout(WIKI_TIMEOUT_MS),
        });
        if (!res.ok) return [];

        const data = await res.json();
        const results: WikiResult[] = (data.query?.search || []).map((item: any) => ({
            title: item.title,
            snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ''),
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        }));

        // Cache successful results
        if (results.length > 0) {
            wikiSearchCache.set(key, results);
        }

        return results;
    } catch (err) {
        // Timeout or network error — return empty rather than crashing the agent
        console.error(`Wikipedia search failed for "${query}":`, err instanceof Error ? err.message : err);
        return [];
    }
}

export async function getWikiSummary(title: string): Promise<string> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return '';

    // Check cache
    const key = cacheKey('wiki-summary', normalizedTitle);
    const cached = wikiSummaryCache.get(key);
    if (cached) return cached;

    const params = new URLSearchParams({
        action: 'query',
        titles: title,
        prop: 'extracts',
        exintro: '1',
        explaintext: '1',
        format: 'json',
        origin: '*',
    });

    try {
        const res = await fetch(`${WIKI_API}?${params}`, {
            signal: AbortSignal.timeout(WIKI_TIMEOUT_MS),
        });
        if (!res.ok) return '';

        const data = await res.json();
        const pages = data.query?.pages || {};
        const page = Object.values(pages)[0] as any;
        const summary = page?.extract || '';

        // Cache non-empty summaries
        if (summary) {
            wikiSummaryCache.set(key, summary);
        }

        return summary;
    } catch (err) {
        console.error(`Wikipedia summary failed for "${title}":`, err instanceof Error ? err.message : err);
        return '';
    }
}

/** Returns cache stats for monitoring/debugging. */
export function getWikiCacheStats() {
    return {
        search: wikiSearchCache.stats(),
        summary: wikiSummaryCache.stats(),
    };
}
