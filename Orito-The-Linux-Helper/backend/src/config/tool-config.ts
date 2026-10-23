/**
 * Tool Configuration - Centralized configuration for all tools
 * All hardcoded values are moved here and can be overridden via environment variables
 */

import { z } from 'zod';

// Tool configuration schema
const toolConfigSchema = z.object({
    // Calculator tool settings
    calculator: z.object({
        maxExpressionLength: z.number().default(1000),
    }).default({}),

    // Manpage tool settings
    manpage: z.object({
        timeoutMs: z.number().default(10000),
        cacheMaxEntries: z.number().default(200),
        cacheTtlMs: z.number().default(5 * 60 * 1000), // 5 minutes
        sources: z.array(z.string()).default([
            'https://man7.org/linux/man-pages',
            'https://linux.die.net/man',
            'https://tldr.sh',
        ]),
    }).default({}),

    // Wiki tool settings
    wiki: z.object({
        apiUrl: z.string().default('https://en.wikipedia.org/w/api.php'),
        timeoutMs: z.number().default(8000),
        cacheMaxEntries: z.number().default(300),
        cacheTtlMs: z.number().default(30 * 60 * 1000), // 30 minutes
        defaultSearchLimit: z.number().default(5),
    }).default({}),

    // Search tool settings
    search: z.object({
        searxngTimeoutMs: z.number().default(10000),
        tavilyTimeoutMs: z.number().default(15000),
        cacheMaxEntries: z.number().default(200),
        cacheTtlMs: z.number().default(5 * 60 * 1000), // 5 minutes
        defaultMaxResults: z.number().default(20),
        searxngEngines: z.array(z.string()).default(['google', 'duckduckgo', 'bing']),
        searxngCategories: z.array(z.string()).default(['general', 'it']),
        tavilyApiUrl: z.string().default('https://api.tavily.com'),
    }).default({}),

    // Package tool settings
    package: z.object({
        maxResults: z.number().default(5),
        defaultPackageManager: z.string().default('apt'),
        cacheMaxEntries: z.number().default(200),
        cacheTtlMs: z.number().default(30 * 60 * 1000), // 30 minutes
    }).default({}),

    // Date tool settings
    date: z.object({
        // Days and months are standard, but can be localized if needed
        days: z.array(z.string()).default(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
        months: z.array(z.string()).default([
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]),
    }).default({}),
});

// Agent configuration schema
const agentConfigSchema = z.object({
    // Circuit breaker settings
    circuitBreaker: z.object({
        failureThreshold: z.number().default(5),
        resetTimeoutMs: z.number().default(60000), // 1 minute
    }).default({}),

    // Default agent settings
    agent: z.object({
        timeoutMs: z.number().default(120000), // 2 minutes
        maxRetries: z.number().default(2),
        retryDelayMs: z.number().default(1000),
    }).default({}),

    // Orchestrator settings
    orchestrator: z.object({
        maxRetries: z.number().default(2),
        retryDelayMs: z.number().default(1000),
        agentTimeoutMs: z.number().default(120000), // 2 minutes
        enableGracefulDegradation: z.boolean().default(true),
        enableModelSelection: z.boolean().default(true),
    }).default({}),

    // Research agent settings
    research: z.object({
        maxSubResearch: z.number().default(1),
        sourceWeights: z.record(z.string(), z.number()).default({
            'docs.kernel.org': 0.95,
            'man7.org': 0.98,
            'wiki.archlinux.org': 0.85,
            'docs.fedoraproject.org': 1.0,
            'wiki.debian.org': 1.0,
            'ubuntu.com': 1.0,
            'access.redhat.com': 1.0,
            'github.com': 0.9,
            'developer.nvidia.com': 0.85,
            'intel.com': 0.85,
            'stackoverflow.com': 0.6,
            'superuser.com': 0.6,
            'askubuntu.com': 0.7,
            'reddit.com': 0.4,
            'en.wikipedia.org': 0.75,
            'linuxhandbook.com': 0.7,
            'linuxize.com': 0.7,
            'digitalocean.com': 0.8,
            'linode.com': 0.8,
            'tecmint.com': 0.65,
            'nixos.org': 0.9,
            'gentoo.org': 0.9,
        }),
        defaultSourceWeight: z.number().default(0.5),
        strategyMaxResults: z.object({
            quick: z.number().default(3),
            deep: z.number().default(8),
            adaptive: z.number().default(5),
        }).default({}),
    }).default({}),
});

// Package manager definitions - centralized and configurable
const packageManagerSchema = z.object({
    managers: z.record(z.string(), z.object({
        manager: z.string(),
        installCmd: z.string(),
    })).default({
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
    }),
    defaultManager: z.object({
        manager: z.string().default('apt'),
        installCmd: z.string().default('sudo apt install'),
    }).default({}),
});

// Parse environment variables for tool configuration
function parseToolConfig() {
    const envOverrides: Record<string, unknown> = {};

    // Allow environment variable overrides
    if (process.env.TOOL_MANPAGE_TIMEOUT_MS) {
        envOverrides.manpage = { 
            ...(envOverrides.manpage as object || {}),
            timeoutMs: parseInt(process.env.TOOL_MANPAGE_TIMEOUT_MS, 10) 
        };
    }
    if (process.env.TOOL_WIKI_TIMEOUT_MS) {
        envOverrides.wiki = { 
            ...(envOverrides.wiki as object || {}),
            timeoutMs: parseInt(process.env.TOOL_WIKI_TIMEOUT_MS, 10) 
        };
    }
    if (process.env.TOOL_SEARCH_TIMEOUT_MS) {
        envOverrides.search = { 
            ...(envOverrides.search as object || {}),
            searxngTimeoutMs: parseInt(process.env.TOOL_SEARCH_TIMEOUT_MS, 10),
            tavilyTimeoutMs: parseInt(process.env.TOOL_SEARCH_TIMEOUT_MS, 10),
        };
    }
    if (process.env.TOOL_CACHE_TTL_MS) {
        const ttl = parseInt(process.env.TOOL_CACHE_TTL_MS, 10);
        envOverrides.manpage = { 
            ...(envOverrides.manpage as object || {}),
            cacheTtlMs: ttl 
        };
        envOverrides.wiki = { 
            ...(envOverrides.wiki as object || {}),
            cacheTtlMs: ttl 
        };
        envOverrides.search = { 
            ...(envOverrides.search as object || {}),
            cacheTtlMs: ttl 
        };
    }

    return toolConfigSchema.parse(envOverrides);
}

function parseAgentConfig() {
    const envOverrides: Record<string, unknown> = {};

    if (process.env.AGENT_TIMEOUT_MS) {
        envOverrides.agent = { 
            ...(envOverrides.agent as object || {}),
            timeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS, 10) 
        };
    }
    if (process.env.AGENT_MAX_RETRIES) {
        envOverrides.agent = { 
            ...(envOverrides.agent as object || {}),
            maxRetries: parseInt(process.env.AGENT_MAX_RETRIES, 10) 
        };
    }
    if (process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
        envOverrides.circuitBreaker = { 
            ...(envOverrides.circuitBreaker as object || {}),
            failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 10) 
        };
    }
    if (process.env.CIRCUIT_BREAKER_RESET_MS) {
        envOverrides.circuitBreaker = { 
            ...(envOverrides.circuitBreaker as object || {}),
            resetTimeoutMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_MS, 10) 
        };
    }

    return agentConfigSchema.parse(envOverrides);
}

function parsePackageManagerConfig() {
    return packageManagerSchema.parse({});
}

// Exported configuration objects
export const toolConfig = parseToolConfig();
export const agentConfig = parseAgentConfig();
export const packageManagerConfig = parsePackageManagerConfig();

// Type exports
export type ToolConfig = z.infer<typeof toolConfigSchema>;
export type AgentConfigSettings = z.infer<typeof agentConfigSchema>;
export type PackageManagerConfig = z.infer<typeof packageManagerSchema>;
