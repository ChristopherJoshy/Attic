import { webSearch } from './search-tool.js';
import { packageManagerConfig, toolConfig } from '../config/tool-config.js';
import { TTLCache, cacheKey, type CacheStats } from '../utils/ttl-cache.js';

/**
 * Represents information about a Linux package
 */
export interface PackageInfo {
    name: string;
    description: string;
    version?: string;
    installationCommand: string;
    packageManager: string;
}

// Enhanced TTL cache for package searches with namespacing and strategy support
const packageCache = new TTLCache<PackageInfo[]>({
    maxSize: toolConfig.package.cacheMaxEntries,
    ttl: toolConfig.package.cacheTtlMs,
    namespace: 'package',
    strategy: 'lfu', // Use LFU as popular packages are searched often
});

/**
 * Detects the package manager based on the distribution name
 * Uses centralized configuration from tool-config.ts
 * @param distro - The Linux distribution name
 * @returns The package manager info or defaults to configured default
 */
function getPackageManager(distro?: string): { manager: string; installCmd: string } {
    if (!distro) {
        return packageManagerConfig.defaultManager;
    }

    const normalizedDistro = distro.toLowerCase().trim();
    return packageManagerConfig.managers[normalizedDistro] || packageManagerConfig.defaultManager;
}

/**
 * Extracts package information from search result text
 * @param text - The search result text
 * @param query - The original search query
 * @param packageManager - The package manager info
 * @returns Array of parsed PackageInfo objects
 */
function parsePackageResults(text: string, query: string, packageManager: { manager: string; installCmd: string }): PackageInfo[] {
    const packages: PackageInfo[] = [];
    const seenPackages = new Set<string>();

    // Common patterns for package names in search results
    const patterns = [
        /(?:install|package)\s+['"`]?([a-z0-9][a-z0-9\-._]+)['"]?/gi,
        /([a-z0-9][a-z0-9\-._]+)\s*(?:package|deb|rpm)/gi,
        new RegExp(`(${query}[a-z0-9\-._]*)`, 'gi'),
    ];

    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            const pkgName = match[1].toLowerCase().trim();

            // Filter out common false positives
            if (
                pkgName.length < 2 ||
                pkgName.length > 50 ||
                seenPackages.has(pkgName) ||
                /^(the|and|for|with|using|install|sudo|apt|dnf|yum|pacman|zypper)$/.test(pkgName)
            ) {
                continue;
            }

            seenPackages.add(pkgName);

            // Try to extract description from surrounding context
            const contextStart = Math.max(0, (match.index || 0) - 100);
            const contextEnd = Math.min(text.length, (match.index || 0) + 200);
            const context = text.slice(contextStart, contextEnd);

            // Extract a description (look for sentences mentioning the package)
            const descMatch = context.match(/(?:is|provides|for|–|-)\s+([^.,]{10,200})/i);
            const description = descMatch
                ? descMatch[1].trim()
                : `${pkgName} package for ${query}`;

            packages.push({
                name: pkgName,
                description: description.charAt(0).toUpperCase() + description.slice(1),
                installationCommand: `${packageManager.installCmd} ${pkgName}`,
                packageManager: packageManager.manager,
            });

            // Limit to configured max results
            if (packages.length >= toolConfig.package.maxResults) break;
        }

        if (packages.length >= toolConfig.package.maxResults) break;
    }

    return packages;
}

/**
 * Searches for Linux packages and returns installation information.
 * Uses web search to find package names and commands for the specified distribution.
 * Results are cached to reduce redundant searches.
 *
 * @param query - The package name or search term (e.g., "nginx", "nodejs")
 * @param distro - Optional Linux distribution (e.g., "Ubuntu", "Fedora", "Arch")
 * @returns Array of PackageInfo objects with installation details
 *
 * @example
 * ```typescript
 * const packages = await searchPackages('nginx', 'Ubuntu');
 * // Returns: [{ name: "nginx", installationCommand: "sudo apt install nginx", ... }]
 * ```
 */
export async function searchPackages(query: string, distro?: string): Promise<PackageInfo[]> {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const normalizedDistro = distro?.trim().toLowerCase() || 'linux';
    const packageManager = getPackageManager(distro);

    // Check cache first
    const cacheKeyStr = cacheKey('package', normalizedQuery, normalizedDistro);
    const cached = packageCache.get(cacheKeyStr);
    if (cached) {
        return cached;
    }

    try {
        // Build search query for package installation
        const searchQuery = `${normalizedDistro} ${normalizedQuery} package install command`;
        const searchResults = await webSearch(searchQuery);

        let packages: PackageInfo[];

        if (!searchResults.results || searchResults.results.length === 0) {
            // Fallback: return a generic package suggestion
            packages = [{
                name: normalizedQuery,
                description: `${normalizedQuery} package`,
                installationCommand: `${packageManager.installCmd} ${normalizedQuery}`,
                packageManager: packageManager.manager,
            }];
        } else {
            // Combine all search result excerpts for parsing
            const combinedText = searchResults.results
                .map(r => `${r.title} ${r.excerpt}`)
                .join(' ');

            packages = parsePackageResults(combinedText, normalizedQuery, packageManager);

            // If no packages found through parsing, provide a fallback
            if (packages.length === 0) {
                packages = [{
                    name: normalizedQuery,
                    description: `${normalizedQuery} package for ${normalizedDistro}`,
                    installationCommand: `${packageManager.installCmd} ${normalizedQuery}`,
                    packageManager: packageManager.manager,
                }];
            }
        }

        // Cache successful results
        if (packages.length > 0) {
            packageCache.set(cacheKeyStr, packages);
        }

        return packages;
    } catch (error) {
        console.error(`Package search failed for "${query}" on ${normalizedDistro}:`, error instanceof Error ? error.message : error);

        // Return fallback suggestion on error
        return [{
            name: normalizedQuery,
            description: `${normalizedQuery} package (search failed)`,
            installationCommand: `${packageManager.installCmd} ${normalizedQuery}`,
            packageManager: packageManager.manager,
        }];
    }
}

/**
 * Returns cache statistics for monitoring/debugging
 * @returns CacheStats object with hit rate and size info
 */
export function getPackageCacheStats(): CacheStats {
    return packageCache.stats();
}

/**
 * Clears the package cache (useful for testing or forcing fresh searches)
 */
export function clearPackageCache(): void {
    packageCache.clear();
}
