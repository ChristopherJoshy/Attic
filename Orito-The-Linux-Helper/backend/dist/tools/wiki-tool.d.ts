interface WikiResult {
    title: string;
    snippet: string;
    url: string;
}
export declare function searchWikipedia(query: string, limit?: number): Promise<WikiResult[]>;
export declare function getWikiSummary(title: string): Promise<string>;
/** Returns cache stats for monitoring/debugging. */
export declare function getWikiCacheStats(): {
    search: import("../utils/ttl-cache.js").CacheStats;
    summary: import("../utils/ttl-cache.js").CacheStats;
};
export {};
//# sourceMappingURL=wiki-tool.d.ts.map