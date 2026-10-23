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
 * Result type for tool execution
 */
export interface ToolResult {
    success: boolean;
    data: any;
    error?: string;
    durationMs?: number;
}

/**
 * Type for tool implementation functions
 */
export type ToolImplementation = (...args: any[]) => Promise<any> | any;

/**
 * Tool permission levels
 */
export type ToolPermission = 'read' | 'write' | 'execute' | 'system';

/**
 * Tool metadata including permissions
 */
interface ToolMetadata {
    implementation: ToolImplementation;
    permissions: ToolPermission[];
    description: string;
    category: 'search' | 'calculation' | 'validation' | 'system' | 'reference';
}

/**
 * Internal tool registry with metadata
 */
const toolMetadataRegistry: Record<string, ToolMetadata> = {
    web_search: {
        implementation: async (args: { query: string; userId?: string; sessionId?: string }) => {
            // Track search usage
            const identifier = args.userId || args.sessionId;
            const type = args.userId ? 'user' : 'session';

            if (identifier) {
                // Dynamically import to avoid circular dependencies if any
                const { incrementSearchCount } = await import('../models/usage.js');
                await incrementSearchCount(identifier, type).catch(err =>
                    console.error('Failed to increment search count:', err)
                );
            }

            // Handle both object and string (if legacy) calls
            const query = typeof args === 'string' ? args : args.query;
            return webSearch(query);
        },
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
        implementation: async (args: { expression: string }) => {
            return calculate(args.expression);
        },
        permissions: ['read'],
        description: 'Perform mathematical calculations',
        category: 'calculation'
    },

    convert_units: {
        implementation: async (args: { value: number; from: string; to: string }) => {
            return convertUnits(args.value, args.from, args.to);
        },
        permissions: ['read'],
        description: 'Convert between units of measurement',
        category: 'calculation'
    },

    validate_command: {
        implementation: async (args: { command: string; detectedPackageManager?: string | null }) => {
            const result = validateCommand(
                args.command,
                args.detectedPackageManager ?? null
            );
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
        implementation: async (args: { command: string }) => {
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
        implementation: async (args: { query: string; packageManager?: string | null }) => {
            // Map package manager to distro for package-tool
            const pmToDistro: Record<string, string> = {
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
        implementation: async (args: { command: string; section?: number | null }) => {
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
    },

    /**
     * asQuestion - Dynamic question tool for agent-user interaction
     * This is a special tool that pauses agent execution to get user input
     */
    asQuestion: {
        implementation: async (args: { 
            question: string; 
            header?: string; 
            purpose?: string;
            options?: Array<{ label: string; description?: string }>; 
            multiple?: boolean;
            allowCustom?: boolean;
        }) => {
            // This tool is handled specially by the agent - it doesn't execute directly
            // The agent's askUserQuestion method handles the actual question flow
            // This implementation just returns the structured question data
            return {
                question: args.question,
                header: args.header || args.question.substring(0, 30),
                purpose: args.purpose,
                options: args.options || [],
                multiple: args.multiple || false,
                allowCustom: args.allowCustom !== false, // Default to true
            };
        },
        permissions: ['read'],
        description: 'Ask the user a dynamic question with customizable options',
        category: 'system'
    }
};

/**
 * Simple registry mapping tool names to implementations
 */
export const toolRegistry: Record<string, ToolImplementation> = Object.fromEntries(
    Object.entries(toolMetadataRegistry).map(([name, meta]) => [name, meta.implementation])
);

/**
 * Get all available tool names
 */
export function getAvailableTools(): string[] {
    return Object.keys(toolMetadataRegistry);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ToolMetadata['category']): string[] {
    return Object.entries(toolMetadataRegistry)
        .filter(([, meta]) => meta.category === category)
        .map(([name]) => name);
}

/**
 * Get tool permissions
 */
export function getToolPermissions(name: string): ToolPermission[] {
    return toolMetadataRegistry[name]?.permissions ?? [];
}

/**
 * Check if a tool requires specific permission
 */
export function toolRequiresPermission(name: string, permission: ToolPermission): boolean {
    return toolMetadataRegistry[name]?.permissions.includes(permission) ?? false;
}

/**
 * Execute a tool by name with validation
 * @param name - Tool name to execute
 * @param args - Tool arguments
 * @param allowedTools - List of allowed tool names (permission check)
 * @returns Tool execution result
 */
export async function executeTool(
    name: string,
    args: Record<string, any>,
    allowedTools: string[]
): Promise<ToolResult> {
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
    } catch (error: any) {
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
export async function executeTools(
    toolCalls: Array<{ name: string; args: Record<string, any> }>,
    allowedTools: string[]
): Promise<ToolResult[]> {
    return Promise.all(
        toolCalls.map(call => executeTool(call.name, call.args, allowedTools))
    );
}

/**
 * Get tool information for debugging/monitoring
 */
export function getToolInfo(name: string): { name: string; description: string; category: string; permissions: string[] } | null {
    const meta = toolMetadataRegistry[name];
    if (!meta) return null;

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
export function getAllToolInfo(): Array<{ name: string; description: string; category: string; permissions: string[] }> {
    return Object.keys(toolMetadataRegistry).map(name => getToolInfo(name)!).filter(Boolean);
}
