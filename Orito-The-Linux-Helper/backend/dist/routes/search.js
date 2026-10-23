import { config } from '../config/index.js';
import { searchQuerySchema, validateOrThrow } from '../validation/schemas.js';
const SEARCH_TIMEOUT_MS = 15000; // 15 second timeout for search requests
/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(url, options, timeoutMs = SEARCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    }
    finally {
        clearTimeout(timeout);
    }
}
export async function searchRoutes(app) {
    app.get('/api/v1/search', { preHandler: [app.authenticate] }, async (request, reply) => {
        // Input validation
        let validatedQuery;
        try {
            const validated = validateOrThrow(searchQuerySchema, { querystring: request.query });
            validatedQuery = validated.querystring;
        }
        catch (err) {
            app.log.warn({
                event: 'search_validation_error',
                error: err.message,
                ip: request.ip
            }, 'Search validation failed');
            return reply.code(400).send({ error: err.message });
        }
        const { q } = validatedQuery;
        const { userId, sessionId } = request.user;
        const startTime = Date.now();
        try {
            if (config.SEARCH_PROVIDER === 'searxng') {
                try {
                    const result = await searchSearXNG(q);
                    const duration = Date.now() - startTime;
                    app.log.info({
                        event: 'search_success',
                        query: q.substring(0, 100), // Truncate for logging
                        provider: 'searxng',
                        results: { count: result.results.length },
                        user: { userId, sessionId },
                        performance: { durationMs: duration }
                    }, 'Search completed');
                    return result;
                }
                catch (err) {
                    app.log.warn({
                        event: 'search_provider_fallback',
                        error: { message: err.message },
                        query: q.substring(0, 100),
                        fromProvider: 'searxng',
                        toProvider: 'tavily'
                    }, 'SearXNG search failed, falling back to Tavily');
                    if (config.TAVILY_API_KEY) {
                        const result = await searchTavily(q);
                        const duration = Date.now() - startTime;
                        app.log.info({
                            event: 'search_success',
                            query: q.substring(0, 100),
                            provider: 'tavily',
                            fallback: true,
                            results: { count: result.results.length },
                            user: { userId, sessionId },
                            performance: { durationMs: duration }
                        }, 'Search completed with fallback');
                        return result;
                    }
                    throw new Error('Search unavailable');
                }
            }
            const result = await searchTavily(q);
            const duration = Date.now() - startTime;
            app.log.info({
                event: 'search_success',
                query: q.substring(0, 100),
                provider: 'tavily',
                results: { count: result.results.length },
                user: { userId, sessionId },
                performance: { durationMs: duration }
            }, 'Search completed');
            return result;
        }
        catch (err) {
            const duration = Date.now() - startTime;
            // Handle timeout errors specifically
            const isTimeout = err.name === 'AbortError' || err.message?.includes('abort');
            app.log.error({
                event: 'search_error',
                error: {
                    message: err.message,
                    stack: err.stack,
                    isTimeout
                },
                query: q.substring(0, 100),
                user: { userId, sessionId },
                performance: { durationMs: duration }
            }, isTimeout ? 'Search timed out' : 'Search failed');
            if (isTimeout) {
                return reply.code(504).send({ error: 'Search request timed out. Please try again.' });
            }
            return reply.code(500).send({ error: 'Search unavailable' });
        }
    });
}
async function searchSearXNG(query) {
    const url = new URL('/search', config.SEARXNG_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', 'general,it');
    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) {
        if (config.TAVILY_API_KEY)
            return await searchTavily(query);
        throw new Error('SearXNG unavailable');
    }
    const data = await response.json();
    return {
        results: (data.results || []).slice(0, 20).map((r) => ({
            title: String(r.title || '').substring(0, 500),
            url: String(r.url || ''),
            excerpt: String(r.content || '').substring(0, 1000),
            source: String(r.engine || 'searxng'),
        })),
        totalResults: data.number_of_results || 0,
    };
}
async function searchTavily(query) {
    if (!config.TAVILY_API_KEY)
        throw new Error('No search provider available');
    const response = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: config.TAVILY_API_KEY,
            query,
            search_depth: 'advanced',
            max_results: 20,
            include_answer: false,
        }),
    });
    if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
    }
    const data = await response.json();
    return {
        results: (data.results || []).map((r) => ({
            title: String(r.title || '').substring(0, 500),
            url: String(r.url || ''),
            excerpt: String(r.content || '').substring(0, 1000),
            source: 'tavily',
        })),
        totalResults: data.results?.length || 0,
    };
}
//# sourceMappingURL=search.js.map