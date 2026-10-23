import { webSearch } from './search-tool.js';
/**
 * Supported Linux distributions and their package managers
 */
const DISTRO_PACKAGE_MANAGERS = {
    ubuntu: { manager: 'apt', installCmd: 'sudo apt install' },
    debian: { manager: 'apt', installCmd: 'sudo apt install' },
    fedora: { manager: 'dnf', installCmd: 'sudo dnf install' },
    arch: { manager: 'pacman', installCmd: 'sudo pacman -S' },
    manjaro: { manager: 'pacman', installCmd: 'sudo pacman -S' },
    opensuse: { manager: 'zypper', installCmd: 'sudo zypper install' },
    suse: { manager: 'zypper', installCmd: 'sudo zypper install' },
    centos: { manager: 'yum', installCmd: 'sudo yum install' },
    rhel: { manager: 'dnf', installCmd: 'sudo dnf install' },
    alpine: { manager: 'apk', installCmd: 'sudo apk add' },
    gentoo: { manager: 'emerge', installCmd: 'sudo emerge' },
    nixos: { manager: 'nix', installCmd: 'nix-env -iA' },
};
/**
 * Detects the package manager based on the distribution name
 * @param distro - The Linux distribution name
 * @returns The package manager info or defaults to apt
 */
function getPackageManager(distro) {
    if (!distro) {
        return { manager: 'apt', installCmd: 'sudo apt install' };
    }
    const normalizedDistro = distro.toLowerCase().trim();
    return DISTRO_PACKAGE_MANAGERS[normalizedDistro] || { manager: 'apt', installCmd: 'sudo apt install' };
}
/**
 * Extracts package information from search result text
 * @param text - The search result text
 * @param query - The original search query
 * @param packageManager - The package manager info
 * @returns Array of parsed PackageInfo objects
 */
function parsePackageResults(text, query, packageManager) {
    const packages = [];
    const seenPackages = new Set();
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
            if (pkgName.length < 2 ||
                pkgName.length > 50 ||
                seenPackages.has(pkgName) ||
                /^(the|and|for|with|using|install|sudo|apt|dnf|yum|pacman|zypper)$/.test(pkgName)) {
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
            // Limit to top 5 results
            if (packages.length >= 5)
                break;
        }
        if (packages.length >= 5)
            break;
    }
    return packages;
}
/**
 * Searches for Linux packages and returns installation information.
 * Uses web search to find package names and commands for the specified distribution.
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
export async function searchPackages(query, distro) {
    if (!query || query.trim().length === 0) {
        return [];
    }
    const normalizedQuery = query.trim();
    const normalizedDistro = distro?.trim() || 'Linux';
    const packageManager = getPackageManager(distro);
    try {
        // Build search query for package installation
        const searchQuery = `${normalizedDistro} ${normalizedQuery} package install command`;
        const searchResults = await webSearch(searchQuery);
        if (!searchResults.results || searchResults.results.length === 0) {
            // Fallback: return a generic package suggestion
            return [{
                    name: normalizedQuery.toLowerCase(),
                    description: `${normalizedQuery} package`,
                    installationCommand: `${packageManager.installCmd} ${normalizedQuery.toLowerCase()}`,
                    packageManager: packageManager.manager,
                }];
        }
        // Combine all search result excerpts for parsing
        const combinedText = searchResults.results
            .map(r => `${r.title} ${r.excerpt}`)
            .join(' ');
        const packages = parsePackageResults(combinedText, normalizedQuery, packageManager);
        // If no packages found through parsing, provide a fallback
        if (packages.length === 0) {
            return [{
                    name: normalizedQuery.toLowerCase(),
                    description: `${normalizedQuery} package for ${normalizedDistro}`,
                    installationCommand: `${packageManager.installCmd} ${normalizedQuery.toLowerCase()}`,
                    packageManager: packageManager.manager,
                }];
        }
        return packages;
    }
    catch (error) {
        console.error(`Package search failed for "${query}" on ${normalizedDistro}:`, error instanceof Error ? error.message : error);
        // Return fallback suggestion on error
        return [{
                name: normalizedQuery.toLowerCase(),
                description: `${normalizedQuery} package (search failed)`,
                installationCommand: `${packageManager.installCmd} ${normalizedQuery.toLowerCase()}`,
                packageManager: packageManager.manager,
            }];
    }
}
//# sourceMappingURL=package-tool.js.map