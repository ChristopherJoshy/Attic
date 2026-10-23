import { TTLCache, cacheKey } from '../utils/ttl-cache.js';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_TIMEOUT_MS = 8000; // 8 second timeout for Wikipedia API calls
// 30-minute TTL — Wikipedia content changes infrequently, and we often
// hit the same articles across research + sub-research agents.
const wikiSearchCache = new TTLCache({
    maxEntries: 300,
    defaultTtlMs: 30 * 60 * 1000, // 30 minutes
});
const wikiSummaryCache = new TTLCache({
    maxEntries: 300,
    defaultTtlMs: 30 * 60 * 1000, // 30 minutes
});
export async function searchWikipedia(query, limit = 5) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery)
        return [];
    // Check cache
    const key = cacheKey('wiki-search', normalizedQuery, limit);
    const cached = wikiSearchCache.get(key);
    if (cached)
        return cached;
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
        if (!res.ok)
            return [];
        const data = await res.json();
        const results = (data.query?.search || []).map((item) => ({
            title: item.title,
            snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ''),
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        }));
        // Cache successful results
        if (results.length > 0) {
            wikiSearchCache.set(key, results);
        }
        return results;
    }
    catch (err) {
        // Timeout or network error — return empty rather than crashing the agent
        console.error(`Wikipedia search failed for "${query}":`, err instanceof Error ? err.message : err);
        return [];
    }
}
export async function getWikiSummary(title) {
    const normalizedTitle = title.trim();
    if (!normalizedTitle)
        return '';
    // Check cache
    const key = cacheKey('wiki-summary', normalizedTitle);
    const cached = wikiSummaryCache.get(key);
    if (cached)
        return cached;
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
        if (!res.ok)
            return '';
        const data = await res.json();
        const pages = data.query?.pages || {};
        const page = Object.values(pages)[0];
        const summary = page?.extract || '';
        // Cache non-empty summaries
        if (summary) {
            wikiSummaryCache.set(key, summary);
        }
        return summary;
    }
    catch (err) {
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
//# sourceMappingURL=wiki-tool.js.map