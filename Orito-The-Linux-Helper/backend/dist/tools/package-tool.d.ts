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
export declare function searchPackages(query: string, distro?: string): Promise<PackageInfo[]>;
//# sourceMappingURL=package-tool.d.ts.map