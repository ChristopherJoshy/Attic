import { config } from '../config/index.js';
import { TTLCache, cacheKey } from '../utils/ttl-cache.js';
// 5-minute TTL cache for search results — avoids hammering search providers
// with identical queries within a short window (common in multi-agent flows
// where research + sub-research may search overlapping terms).
const searchCache = new TTLCache({
    maxEntries: 200,
    defaultTtlMs: 5 * 60 * 1000, // 5 minutes
});
export async function webSearch(query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return { results: [], totalResults: 0 };
    }
    // Check cache first
    const key = cacheKey('search', normalizedQuery);
    const cached = searchCache.get(key);
    if (cached) {
        return cached;
    }
    let response;
    if (config.SEARCH_PROVIDER === 'searxng') {
        try {
            response = await searxngSearch(query);
        }
        catch {
            if (config.TAVILY_API_KEY) {
                response = await tavilySearch(query);
            }
            else {
                throw new Error('Search unavailable');
            }
        }
    }
    else {
        response = await tavilySearch(query);
    }
    // Cache successful results (only if we got results)
    if (response.results.length > 0) {
        searchCache.set(key, response);
    }
    return response;
}
/** Returns cache stats for monitoring/debugging. */
export function getSearchCacheStats() {
    return searchCache.stats();
}
async function searxngSearch(query) {
    const url = new URL('/search', config.SEARXNG_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', 'general,it');
    url.searchParams.set('engines', 'google,duckduckgo,bing');
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!response.ok)
        throw new Error(`SearXNG returned ${response.status}`);
    const data = await response.json();
    return {
        results: (data.results || []).slice(0, 20).map((r) => ({
            title: r.title || '',
            url: r.url || '',
            excerpt: r.content || '',
            source: r.engine || 'searxng',
        })),
        totalResults: data.number_of_results || data.results?.length || 0,
    };
}
async function tavilySearch(query) {
    if (!config.TAVILY_API_KEY)
        throw new Error('Tavily API key not configured');
    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: config.TAVILY_API_KEY,
            query,
            search_depth: 'advanced',
            max_results: 20,
            include_answer: false,
        }),
        signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    return {
        results: (data.results || []).map((r) => ({
            title: r.title || '',
            url: r.url || '',
            excerpt: r.content || '',
            source: 'tavily',
        })),
        totalResults: data.results?.length || 0,
    };
}
//# sourceMappingURL=search-tool.js.map