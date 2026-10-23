/**
 * Tool Registry - Maps tool names to their implementations
 * Provides centralized access to all tool functions with permission validation
 */
import { webSearch } from './search-tool.js';
import { searchWikipedia, getWikiSummary } from './wiki-tool.js';
import { calculate, convertUnits } from './calculator-tool.js';
import { validateCommand, getDryRunEquivalent } from './command-validator.js';
import { getCurrentDateTime } from './date-tool.js';
import { lookupManpage } from './manpage-tool.js';
import { searchPackages } from './package-tool.js';
/**
 * Internal tool registry with metadata
 */
const toolMetadataRegistry = {
    web_search: {
        implementation: webSearch,
        permissions: ['read'],
        description: 'Search the web for Linux information',
        category: 'search'
    },
    search_wikipedia: {
        implementation: searchWikipedia,
        permissions: ['read'],
        description: 'Search Wikipedia for Linux concepts',
        category: 'search'
    },
    get_wiki_summary: {
        implementation: getWikiSummary,
        permissions: ['read'],
        description: 'Get detailed Wikipedia article summary',
        category: 'search'
    },
    calculate: {
        implementation: async (args) => {
            return calculate(args.expression);
        },
        permissions: ['read'],
        description: 'Perform mathematical calculations',
        category: 'calculation'
    },
    convert_units: {
        implementation: async (args) => {
            return convertUnits(args.value, args.from, args.to);
        },
        permissions: ['read'],
        description: 'Convert between units of measurement',
        category: 'calculation'
    },
    validate_command: {
        implementation: async (args) => {
            const result = validateCommand(args.command, args.detectedPackageManager ?? null);
            return {
                isValid: !result.blocked,
                blocked: result.blocked,
                risk: result.risk,
                reason: result.reason,
                incompatiblePM: result.incompatiblePM
            };
        },
        permissions: ['read', 'system'],
        description: 'Validate Linux command safety',
        category: 'validation'
    },
    get_dry_run_equivalent: {
        implementation: async (args) => {
            const dryRun = getDryRunEquivalent(args.command);
            return {
                original: args.command,
                dryRun: dryRun,
                available: dryRun !== null
            };
        },
        permissions: ['read', 'system'],
        description: 'Get dry-run version of package command',
        category: 'validation'
    },
    search_packages: {
        implementation: async (args) => {
            // Map package manager to distro for package-tool
            const pmToDistro = {
                'apt': 'Ubuntu',
                'dnf': 'Fedora',
                'pacman': 'Arch',
                'zypper': 'openSUSE',
                'emerge': 'Gentoo',
                'nix': 'NixOS'
            };
            const distro = args.packageManager ? pmToDistro[args.packageManager] : undefined;
            const packages = await searchPackages(args.query, distro);
            return {
                query: args.query,
                packageManager: args.packageManager || 'auto-detected',
                packages: packages,
                totalResults: packages.length
            };
        },
        permissions: ['read'],
        description: 'Search for packages across package managers',
        category: 'search'
    },
    lookup_manpage: {
        implementation: async (args) => {
            const manpage = await lookupManpage(args.command, args.section || undefined);
            return manpage;
        },
        permissions: ['read'],
        description: 'Lookup man page for Linux commands',
        category: 'reference'
    },
    get_current_datetime: {
        implementation: async () => {
            return getCurrentDateTime();
        },
        permissions: ['read', 'system'],
        description: 'Get current date and time',
        category: 'system'
    }
};
/**
 * Simple registry mapping tool names to implementations
 */
export const toolRegistry = Object.fromEntries(Object.entries(toolMetadataRegistry).map(([name, meta]) => [name, meta.implementation]));
/**
 * Get all available tool names
 */
export function getAvailableTools() {
    return Object.keys(toolMetadataRegistry);
}
/**
 * Get tools by category
 */
export function getToolsByCategory(category) {
    return Object.entries(toolMetadataRegistry)
        .filter(([, meta]) => meta.category === category)
        .map(([name]) => name);
}
/**
 * Get tool permissions
 */
export function getToolPermissions(name) {
    return toolMetadataRegistry[name]?.permissions ?? [];
}
/**
 * Check if a tool requires specific permission
 */
export function toolRequiresPermission(name, permission) {
    return toolMetadataRegistry[name]?.permissions.includes(permission) ?? false;
}
/**
 * Execute a tool by name with validation
 * @param name - Tool name to execute
 * @param args - Tool arguments
 * @param allowedTools - List of allowed tool names (permission check)
 * @returns Tool execution result
 */
export async function executeTool(name, args, allowedTools) {
    const startTime = Date.now();
    // Check if tool exists
    if (!toolMetadataRegistry[name]) {
        return {
            success: false,
            data: null,
            error: `Unknown tool: ${name}`,
            durationMs: Date.now() - startTime
        };
    }
    // Check permission
    if (!allowedTools.includes(name)) {
        return {
            success: false,
            data: null,
            error: `Tool '${name}' is not in the allowed tools list`,
            durationMs: Date.now() - startTime
        };
    }
    const metadata = toolMetadataRegistry[name];
    try {
        // Execute the tool
        const result = await metadata.implementation(args);
        return {
            success: true,
            data: result,
            durationMs: Date.now() - startTime
        };
    }
    catch (error) {
        return {
            success: false,
            data: null,
            error: error?.message || `Tool execution failed: ${name}`,
            durationMs: Date.now() - startTime
        };
    }
}
/**
 * Batch execute multiple tools
 * @param toolCalls - Array of {name, args} objects
 * @param allowedTools - List of allowed tool names
 * @returns Array of results in same order
 */
export async function executeTools(toolCalls, allowedTools) {
    return Promise.all(toolCalls.map(call => executeTool(call.name, call.args, allowedTools)));
}
/**
 * Get tool information for debugging/monitoring
 */
export function getToolInfo(name) {
    const meta = toolMetadataRegistry[name];
    if (!meta)
        return null;
    return {
        name,
        description: meta.description,
        category: meta.category,
        permissions: meta.permissions
    };
}
/**
 * Get all tool information
 */
export function getAllToolInfo() {
    return Object.keys(toolMetadataRegistry).map(name => getToolInfo(name)).filter(Boolean);
}
//# sourceMappingURL=tool-registry.js.map