import { config } from '../config/index.js';
import { TTLCache, cacheKey, cacheManager, type CacheStats } from '../utils/ttl-cache.js';
import { toolConfig } from '../config/tool-config.js';
import { getSearXNGConfig, type SearXNGConfig } from '../config/searxng.js';
import { getSearXNGInstanceInfo } from '../services/searxng-manager.js';

interface SearchResult {
    title: string;
    url: string;
    excerpt: string;
    source: string;
}

interface SearchResponse {
    results: SearchResult[];
    totalResults: number;
    provider: 'searxng' | 'tavily' | 'fallback';
}

// Enhanced TTL cache for search results with namespacing and strategy support
const searchCache = new TTLCache<SearchResponse>({
    maxSize: toolConfig.search.cacheMaxEntries,
    ttl: toolConfig.search.cacheTtlMs,
    namespace: 'search',
    strategy: 'lru',
});

/**
 * Check if SearXNG is available and healthy
 */
function isSearXNGAvailable(): boolean {
    const searxngConfig = getSearXNGConfig();
    if (!searxngConfig.enabled) {
        return false;
    }
    
    const instanceInfo = getSearXNGInstanceInfo();
    return instanceInfo.status === 'running' && instanceInfo.healthCheck.status === 'healthy';
}

/**
 * Get the effective SearXNG URL (from instance info or config)
 */
function getSearXNGUrl(): string {
    const instanceInfo = getSearXNGInstanceInfo();
    if (instanceInfo.status === 'running') {
        return instanceInfo.url;
    }
    return getSearXNGConfig().url;
}

/**
 * Perform web search with automatic provider selection
 */
export async function webSearch(query: string): Promise<SearchResponse> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return { results: [], totalResults: 0, provider: 'fallback' };
    }

    // Check cache first
    const key = cacheKey('search', normalizedQuery);
    const cached = searchCache.get(key);
    if (cached) {
        return cached;
    }

    let response: SearchResponse;
    const searxngConfig = getSearXNGConfig();

    // Determine which provider to use
    if (config.SEARCH_PROVIDER === 'searxng' && searxngConfig.enabled) {
        try {
            // Check if SearXNG is available
            if (isSearXNGAvailable()) {
                response = await searxngSearch(query);
            } else if (config.TAVILY_API_KEY) {
                // Fallback to Tavily if SearXNG is unavailable
                console.log('[Search] SearXNG unavailable, falling back to Tavily');
                response = await tavilySearch(query);
            } else {
                throw new Error('SearXNG is unavailable and no fallback API key configured');
            }
        } catch (error) {
            console.error('[Search] SearXNG error:', error);
            if (config.TAVILY_API_KEY) {
                console.log('[Search] Falling back to Tavily');
                response = await tavilySearch(query);
            } else {
                throw new Error('Search unavailable - SearXNG failed and no fallback configured');
            }
        }
    } else if (config.SEARCH_PROVIDER === 'tavily' || config.TAVILY_API_KEY) {
        response = await tavilySearch(query);
    } else {
        throw new Error('No search provider configured');
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

/**
 * Get search provider status
 */
export function getSearchProviderStatus(): {
    primary: 'searxng' | 'tavily';
    searxng: {
        enabled: boolean;
        available: boolean;
        status: string;
        healthCheck: string;
    };
    tavily: {
        configured: boolean;
    };
} {
    const searxngConfig = getSearXNGConfig();
    const instanceInfo = getSearXNGInstanceInfo();
    
    return {
        primary: config.SEARCH_PROVIDER,
        searxng: {
            enabled: searxngConfig.enabled,
            available: isSearXNGAvailable(),
            status: instanceInfo.status,
            healthCheck: instanceInfo.healthCheck.status,
        },
        tavily: {
            configured: !!config.TAVILY_API_KEY,
        },
    };
}

/**
 * Search using SearXNG instance
 */
async function searxngSearch(query: string): Promise<SearchResponse> {
    const searxngUrl = getSearXNGUrl();
    const searxngConfig = getSearXNGConfig();
    
    const url = new URL('/search', searxngUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', toolConfig.search.searxngCategories.join(','));
    url.searchParams.set('engines', toolConfig.search.searxngEngines.join(','));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), toolConfig.search.searxngTimeoutMs);

    try {
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`SearXNG returned ${response.status}`);
        }

        const data = await response.json() as any;

        return {
            results: (data.results || []).slice(0, toolConfig.search.defaultMaxResults).map((r: any) => ({
                title: r.title || '',
                url: r.url || '',
                excerpt: r.content || '',
                source: r.engine || 'searxng',
            })),
            totalResults: data.number_of_results || data.results?.length || 0,
            provider: 'searxng',
        };
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Search using Tavily API
 */
async function tavilySearch(query: string): Promise<SearchResponse> {
    if (!config.TAVILY_API_KEY) throw new Error('Tavily API key not configured');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), toolConfig.search.tavilyTimeoutMs);

    try {
        const response = await fetch(`${toolConfig.search.tavilyApiUrl}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: config.TAVILY_API_KEY,
                query,
                search_depth: 'advanced',
                max_results: toolConfig.search.defaultMaxResults,
                include_answer: false,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json() as any;

        return {
            results: (data.results || []).map((r: any) => ({
                title: r.title || '',
                url: r.url || '',
                excerpt: r.content || '',
                source: 'tavily',
            })),
            totalResults: data.results?.length || 0,
            provider: 'tavily',
        };
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
