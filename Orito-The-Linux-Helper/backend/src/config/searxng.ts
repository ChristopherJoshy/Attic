/**
 * SearXNG Configuration Module
 * Handles configuration for SearXNG instance management
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// SearXNG configuration schema
const searxngConfigSchema = z.object({
    // Enable/disable SearXNG integration
    SEARXNG_ENABLED: z.coerce.boolean().default(true),
    
    // URL for SearXNG instance (local or remote)
    SEARXNG_URL: z.string().url().default('http://localhost:8080'),
    
    // Auto-start local Docker instance
    SEARXNG_AUTO_START: z.coerce.boolean().default(true),
    
    // Port for local SearXNG instance
    SEARXNG_PORT: z.coerce.number().default(8080),
    
    // Instance type: local (managed by us) or remote (user-provided)
    SEARXNG_INSTANCE_TYPE: z.enum(['local', 'remote']).default('local'),
    
    // Health check interval in milliseconds
    SEARXNG_HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
    
    // Health check timeout in milliseconds
    SEARXNG_HEALTH_CHECK_TIMEOUT: z.coerce.number().default(5000),
    
    // Maximum restart attempts before giving up
    SEARXNG_MAX_RESTART_ATTEMPTS: z.coerce.number().default(3),
    
    // Cooldown period between restarts in milliseconds
    SEARXNG_RESTART_COOLDOWN: z.coerce.number().default(5000),
});

const parsedConfig = searxngConfigSchema.safeParse(process.env);

if (!parsedConfig.success) {
    console.error('Invalid SearXNG environment variables:', parsedConfig.error.flatten().fieldErrors);
}

export interface SearXNGConfig {
    enabled: boolean;
    url: string;
    autoStart: boolean;
    port: number;
    instanceType: 'local' | 'remote';
    healthCheckInterval: number;
    healthCheckTimeout: number;
    maxRestartAttempts: number;
    restartCooldown: number;
}

export const searxngConfig: SearXNGConfig = {
    enabled: parsedConfig.success ? parsedConfig.data.SEARXNG_ENABLED : true,
    url: parsedConfig.success ? parsedConfig.data.SEARXNG_URL : 'http://localhost:8080',
    autoStart: parsedConfig.success ? parsedConfig.data.SEARXNG_AUTO_START : true,
    port: parsedConfig.success ? parsedConfig.data.SEARXNG_PORT : 8080,
    instanceType: parsedConfig.success ? parsedConfig.data.SEARXNG_INSTANCE_TYPE : 'local',
    healthCheckInterval: parsedConfig.success ? parsedConfig.data.SEARXNG_HEALTH_CHECK_INTERVAL : 30000,
    healthCheckTimeout: parsedConfig.success ? parsedConfig.data.SEARXNG_HEALTH_CHECK_TIMEOUT : 5000,
    maxRestartAttempts: parsedConfig.success ? parsedConfig.data.SEARXNG_MAX_RESTART_ATTEMPTS : 3,
    restartCooldown: parsedConfig.success ? parsedConfig.data.SEARXNG_RESTART_COOLDOWN : 5000,
};

// Runtime configuration that can be updated
let runtimeConfig: SearXNGConfig = { ...searxngConfig };

export function getSearXNGConfig(): SearXNGConfig {
    return { ...runtimeConfig };
}

export function updateSearXNGConfig(updates: Partial<SearXNGConfig>): SearXNGConfig {
    runtimeConfig = {
        ...runtimeConfig,
        ...updates,
    };
    return { ...runtimeConfig };
}

export function resetSearXNGConfig(): SearXNGConfig {
    runtimeConfig = { ...searxngConfig };
    return { ...runtimeConfig };
}

// Default SearXNG settings for Docker
export const SEARXNG_DOCKER_DEFAULTS = {
    image: 'searxng/searxng:latest',
    containerName: 'orito-searxng',
    internalPort: 8080,
    networkName: 'orito-network',
    volumeName: 'searxng_data',
} as const;

// SearXNG search categories
export const SEARXNG_CATEGORIES = {
    general: 'general',
    images: 'images',
    news: 'news',
    videos: 'videos',
    it: 'it', // IT/tech focused search
    science: 'science',
} as const;

// Default engines for better search results
export const SEARXNG_DEFAULT_ENGINES = [
    'google',
    'bing',
    'duckduckgo',
    'wikipedia',
    'stackoverflow', // For IT category
] as const;
