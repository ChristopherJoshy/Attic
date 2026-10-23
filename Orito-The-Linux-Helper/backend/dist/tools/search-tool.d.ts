interface SearchResult {
    title: string;
    url: string;
    excerpt: string;
    source: string;
}
interface SearchResponse {
    results: SearchResult[];
    totalResults: number;
}
export declare function webSearch(query: string): Promise<SearchResponse>;
/** Returns cache stats for monitoring/debugging. */
export declare function getSearchCacheStats(): import("../utils/ttl-cache.js").CacheStats;
export {};
//# sourceMappingURL=search-tool.d.ts.map