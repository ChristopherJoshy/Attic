/**
 * Represents a parsed Linux man page
 */
export interface ManPageInfo {
    command: string;
    section?: number;
    synopsis: string;
    description: string;
    options?: {
        flag: string;
        description: string;
    }[];
    examples?: string[];
}
/**
 * Looks up a Linux man page for a given command.
 * Fetches from online sources (man7.org, die.net, tldr.sh) and parses the content.
 * Results are cached for 5 minutes to improve performance.
 *
 * @param command - The command name to look up (e.g., "ls", "grep", "nginx")
 * @param section - Optional man page section number (e.g., 1 for commands, 5 for files)
 * @returns ManPageInfo object with parsed sections
 * @throws Error if the man page cannot be found
 *
 * @example
 * ```typescript
 * const manpage = await lookupManpage('ls', 1);
 * // Returns: { command: "ls", synopsis: "ls [OPTION]... [FILE]...", ... }
 * ```
 */
export declare function lookupManpage(command: string, section?: number): Promise<ManPageInfo>;
/**
 * Returns cache statistics for monitoring/debugging
 * @returns CacheStats object with hit rate and size info
 */
export declare function getManpageCacheStats(): import("../utils/ttl-cache.js").CacheStats;
/**
 * Clears the man page cache (useful for testing or forcing fresh lookups)
 */
export declare function clearManpageCache(): void;
//# sourceMappingURL=manpage-tool.d.ts.map