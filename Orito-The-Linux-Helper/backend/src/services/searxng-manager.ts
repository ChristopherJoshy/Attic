/**
 * SearXNG Service Manager
 * Manages SearXNG Docker instance lifecycle
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
    getSearXNGConfig,
    SEARXNG_DOCKER_DEFAULTS,
    type SearXNGConfig,
} from '../config/searxng.js';

const execAsync = promisify(exec);

export type SearXNGStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error' | 'unknown';

export interface SearXNGHealthCheck {
    status: 'healthy' | 'unhealthy' | 'unknown';
    latency: number;
    lastChecked: Date;
    error?: string;
}

export interface SearXNGInstanceInfo {
    status: SearXNGStatus;
    containerId?: string;
    containerName: string;
    port: number;
    url: string;
    uptime?: number;
    healthCheck: SearXNGHealthCheck;
    restartAttempts: number;
    lastStarted?: Date;
    lastStopped?: Date;
    error?: string;
}

// Global state for the SearXNG manager
let instanceInfo: SearXNGInstanceInfo = {
    status: 'unknown',
    containerName: SEARXNG_DOCKER_DEFAULTS.containerName,
    port: 8080,
    url: 'http://localhost:8080',
    healthCheck: {
        status: 'unknown',
        latency: 0,
        lastChecked: new Date(),
    },
    restartAttempts: 0,
};

let healthCheckInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;

/**
 * Execute a Docker command
 */
async function dockerCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
        console.log(`[SearXNG] Executing Docker command: ${command}`);
        const result = await execAsync(command, {
            timeout: 30000, // 30 second timeout
        });
        console.log(`[SearXNG] Docker command succeeded. stdout length: ${result.stdout.length}, stderr length: ${result.stderr.length}`);
        return result;
    } catch (error: unknown) {
        // Detailed error logging for debugging
        const err = error as Error & { stderr?: string; stdout?: string; code?: number };
        console.error(`[SearXNG] Docker command failed!`);
        console.error(`[SearXNG]   Command: ${command}`);
        console.error(`[SearXNG]   Error name: ${err?.constructor?.name || 'Unknown'}`);
        console.error(`[SearXNG]   Error message: ${err?.message || 'No message'}`);
        console.error(`[SearXNG]   Error code: ${err?.code || 'No code'}`);
        console.error(`[SearXNG]   stderr: ${err?.stderr || 'No stderr'}`);
        console.error(`[SearXNG]   stdout: ${err?.stdout || 'No stdout'}`);
        console.error(`[SearXNG]   Stack: ${err?.stack || 'No stack'}`);
        
        // Check for Docker permission denied error and provide helpful message
        const errorMsg = err?.message || '';
        const stderrMsg = err?.stderr || '';
        if (errorMsg.includes('permission denied') || stderrMsg.includes('permission denied')) {
            throw new Error(
                'Docker permission denied. Run \'sudo usermod -aG docker $USER\' and log out/in, or run the backend with sudo.'
            );
        }
        
        // If the command fails, throw with the error message
        throw new Error(`Docker command failed: ${err.message}${err.stderr ? ` (stderr: ${err.stderr})` : ''}`);
    }
}

/**
 * Check if Docker is available
 */
export async function isDockerAvailable(): Promise<boolean> {
    try {
        await execAsync('docker --version', { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if the SearXNG container exists
 */
export async function containerExists(): Promise<boolean> {
    try {
        const { stdout } = await dockerCommand(
            `docker ps -a --filter "name=${SEARXNG_DOCKER_DEFAULTS.containerName}" --format "{{.Names}}"`
        );
        return stdout.trim() === SEARXNG_DOCKER_DEFAULTS.containerName;
    } catch {
        return false;
    }
}

/**
 * Check if the SearXNG container is running
 */
export async function isContainerRunning(): Promise<boolean> {
    try {
        const { stdout } = await dockerCommand(
            `docker ps --filter "name=${SEARXNG_DOCKER_DEFAULTS.containerName}" --format "{{.Names}}"`
        );
        return stdout.trim() === SEARXNG_DOCKER_DEFAULTS.containerName;
    } catch {
        return false;
    }
}

/**
 * Get container ID
 */
export async function getContainerId(): Promise<string | undefined> {
    try {
        const { stdout } = await dockerCommand(
            `docker ps --filter "name=${SEARXNG_DOCKER_DEFAULTS.containerName}" --format "{{.ID}}"`
        );
        return stdout.trim() || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Perform health check on SearXNG instance
 */
export async function performHealthCheck(config: SearXNGConfig = getSearXNGConfig()): Promise<SearXNGHealthCheck> {
    const startTime = Date.now();
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.healthCheckTimeout);
        
        const response = await fetch(`${config.url}/healthz`, {
            method: 'GET',
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const latency = Date.now() - startTime;
        
        if (response.ok) {
            return {
                status: 'healthy',
                latency,
                lastChecked: new Date(),
            };
        } else {
            return {
                status: 'unhealthy',
                latency,
                lastChecked: new Date(),
                error: `Health check returned ${response.status}`,
            };
        }
    } catch (error: any) {
        const latency = Date.now() - startTime;
        return {
            status: 'unhealthy',
            latency,
            lastChecked: new Date(),
            error: error.message || 'Health check failed',
        };
    }
}

/**
 * Start the SearXNG container
 */
export async function startSearXNG(config: SearXNGConfig = getSearXNGConfig()): Promise<SearXNGInstanceInfo> {
    console.log(`[SearXNG] startSearXNG called with config:`, {
        enabled: config.enabled,
        url: config.url,
        port: config.port,
        instanceType: config.instanceType,
        autoStart: config.autoStart,
    });
    
    if (instanceInfo.status === 'starting') {
        console.log(`[SearXNG] Already starting, returning current instance info`);
        return instanceInfo;
    }
    
    instanceInfo = {
        ...instanceInfo,
        status: 'starting',
        port: config.port,
        url: config.url,
    };
    
    try {
        // Check if Docker is available
        console.log(`[SearXNG] Checking if Docker is available...`);
        const dockerAvailable = await isDockerAvailable();
        console.log(`[SearXNG] Docker available: ${dockerAvailable}`);
        
        if (!dockerAvailable) {
            throw new Error('Docker is not available. Please ensure Docker is installed and running.');
        }
        
        // Check if container already exists
        console.log(`[SearXNG] Checking if container exists...`);
        const exists = await containerExists();
        console.log(`[SearXNG] Container exists: ${exists}`);
        
        if (exists) {
            // Start existing container
            console.log(`[SearXNG] Starting existing container: ${SEARXNG_DOCKER_DEFAULTS.containerName}`);
            await dockerCommand(`docker start ${SEARXNG_DOCKER_DEFAULTS.containerName}`);
        } else {
            // Create and start new container
            console.log(`[SearXNG] Creating new container with image: ${SEARXNG_DOCKER_DEFAULTS.image}`);
            await dockerCommand(
                `docker run -d ` +
                `--name ${SEARXNG_DOCKER_DEFAULTS.containerName} ` +
                `-p ${config.port}:${SEARXNG_DOCKER_DEFAULTS.internalPort} ` +
                `-v ${SEARXNG_DOCKER_DEFAULTS.volumeName}:/etc/searxng ` +
                `--restart unless-stopped ` +
                `${SEARXNG_DOCKER_DEFAULTS.image}`
            );
        }
        
        // Wait for container to be healthy
        console.log(`[SearXNG] Waiting for container to become healthy...`);
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max
        
        while (attempts < maxAttempts) {
            const healthCheck = await performHealthCheck(config);
            console.log(`[SearXNG] Health check attempt ${attempts + 1}/${maxAttempts}: ${healthCheck.status}`);
            if (healthCheck.status === 'healthy') {
                instanceInfo = {
                    ...instanceInfo,
                    status: 'running',
                    containerId: await getContainerId(),
                    healthCheck,
                    lastStarted: new Date(),
                    restartAttempts: 0,
                    error: undefined,
                };
                
                // Start health check monitoring
                startHealthCheckMonitoring(config);
                
                console.log(`[SearXNG] Container started successfully!`);
                return instanceInfo;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        
        throw new Error('SearXNG container started but health check failed after 30 seconds. The container may still be initializing.');
        
    } catch (error: unknown) {
        const err = error as Error;
        console.error(`[SearXNG] Failed to start SearXNG:`);
        console.error(`[SearXNG]   Error name: ${err?.constructor?.name || 'Unknown'}`);
        console.error(`[SearXNG]   Error message: ${err?.message || 'No message'}`);
        console.error(`[SearXNG]   Stack: ${err?.stack || 'No stack'}`);
        
        instanceInfo = {
            ...instanceInfo,
            status: 'error',
            error: err.message,
        };
        throw error;
    }
}

/**
 * Stop the SearXNG container
 */
export async function stopSearXNG(): Promise<SearXNGInstanceInfo> {
    if (instanceInfo.status === 'stopping') {
        return instanceInfo;
    }
    
    instanceInfo = {
        ...instanceInfo,
        status: 'stopping',
    };
    
    // Stop health check monitoring
    stopHealthCheckMonitoring();
    
    try {
        if (await isContainerRunning()) {
            await dockerCommand(`docker stop ${SEARXNG_DOCKER_DEFAULTS.containerName}`);
        }
        
        instanceInfo = {
            ...instanceInfo,
            status: 'stopped',
            containerId: undefined,
            lastStopped: new Date(),
            error: undefined,
        };
        
        return instanceInfo;
    } catch (error: any) {
        instanceInfo = {
            ...instanceInfo,
            status: 'error',
            error: error.message,
        };
        throw error;
    }
}

/**
 * Restart the SearXNG container
 */
export async function restartSearXNG(config: SearXNGConfig = getSearXNGConfig()): Promise<SearXNGInstanceInfo> {
    const previousAttempts = instanceInfo.restartAttempts;
    
    try {
        // Stop if running
        if (await isContainerRunning()) {
            await stopSearXNG();
            
            // Cooldown period
            await new Promise(resolve => setTimeout(resolve, config.restartCooldown));
        }
        
        // Start
        instanceInfo.restartAttempts = previousAttempts + 1;
        return await startSearXNG(config);
    } catch (error: any) {
        instanceInfo = {
            ...instanceInfo,
            status: 'error',
            error: error.message,
        };
        throw error;
    }
}

/**
 * Remove the SearXNG container (for cleanup)
 */
export async function removeSearXNGContainer(): Promise<void> {
    stopHealthCheckMonitoring();
    
    try {
        if (await containerExists()) {
            await dockerCommand(`docker rm -f ${SEARXNG_DOCKER_DEFAULTS.containerName}`);
        }
        
        instanceInfo = {
            status: 'stopped',
            containerName: SEARXNG_DOCKER_DEFAULTS.containerName,
            port: 8080,
            url: 'http://localhost:8080',
            healthCheck: {
                status: 'unknown',
                latency: 0,
                lastChecked: new Date(),
            },
            restartAttempts: 0,
        };
    } catch (error: any) {
        throw new Error(`Failed to remove SearXNG container: ${error.message}`);
    }
}

/**
 * Start health check monitoring
 */
function startHealthCheckMonitoring(config: SearXNGConfig): void {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }
    
    healthCheckInterval = setInterval(async () => {
        if (isShuttingDown) return;
        
        try {
            const healthCheck = await performHealthCheck(config);
            instanceInfo.healthCheck = healthCheck;
            
            // Auto-restart if unhealthy and auto-start is enabled
            if (healthCheck.status === 'unhealthy' && config.autoStart) {
                const running = await isContainerRunning();
                
                if (!running && instanceInfo.restartAttempts < config.maxRestartAttempts) {
                    console.log('[SearXNG] Container not running, attempting restart...');
                    await restartSearXNG(config);
                }
            }
        } catch (error) {
            console.error('[SearXNG] Health check monitoring error:', error);
        }
    }, config.healthCheckInterval);
}

/**
 * Stop health check monitoring
 */
function stopHealthCheckMonitoring(): void {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }
}

/**
 * Get current instance info
 */
export function getSearXNGInstanceInfo(): SearXNGInstanceInfo {
    return { ...instanceInfo };
}

/**
 * Initialize SearXNG manager
 */
export async function initializeSearXNGManager(config: SearXNGConfig = getSearXNGConfig()): Promise<SearXNGInstanceInfo> {
    if (!config.enabled) {
        return {
            status: 'stopped',
            containerName: SEARXNG_DOCKER_DEFAULTS.containerName,
            port: config.port,
            url: config.url,
            healthCheck: {
                status: 'unknown',
                latency: 0,
                lastChecked: new Date(),
            },
            restartAttempts: 0,
            error: 'SearXNG is disabled',
        };
    }
    
    // For remote instances, just do a health check
    if (config.instanceType === 'remote') {
        const healthCheck = await performHealthCheck(config);
        return {
            status: healthCheck.status === 'healthy' ? 'running' : 'error',
            containerName: SEARXNG_DOCKER_DEFAULTS.containerName,
            port: config.port,
            url: config.url,
            healthCheck,
            restartAttempts: 0,
        };
    }
    
    // For local instances, check if container is running
    const running = await isContainerRunning();
    
    if (running) {
        const healthCheck = await performHealthCheck(config);
        instanceInfo = {
            status: 'running',
            containerId: await getContainerId(),
            containerName: SEARXNG_DOCKER_DEFAULTS.containerName,
            port: config.port,
            url: config.url,
            healthCheck,
            restartAttempts: 0,
        };
        
        startHealthCheckMonitoring(config);
        return instanceInfo;
    }
    
    // Auto-start if configured
    if (config.autoStart) {
        try {
            return await startSearXNG(config);
        } catch (error) {
            console.error('[SearXNG] Failed to auto-start:', error);
            return {
                ...instanceInfo,
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to start',
            };
        }
    }
    
    return {
        status: 'stopped',
        containerName: SEARXNG_DOCKER_DEFAULTS.containerName,
        port: config.port,
        url: config.url,
        healthCheck: {
            status: 'unknown',
            latency: 0,
            lastChecked: new Date(),
        },
        restartAttempts: 0,
    };
}

/**
 * Shutdown SearXNG manager
 */
export async function shutdownSearXNGManager(): Promise<void> {
    isShuttingDown = true;
    stopHealthCheckMonitoring();
    
    // Don't stop the container on shutdown - let Docker manage it
    // This allows the container to restart automatically if configured
    console.log('[SearXNG] Manager shutdown complete');
}

// Handle process shutdown
process.on('SIGTERM', async () => {
    await shutdownSearXNGManager();
});

process.on('SIGINT', async () => {
    await shutdownSearXNGManager();
});
