import { OpenRouter } from '@openrouter/sdk';
import { config } from '../config/index.js';
import { TTLCache, cacheKey } from '../utils/ttl-cache.js';
import { getDateContext } from '../tools/date-tool.js';
import { getOptimalParams, shouldEnableTools, type TaskContext } from './model-selector.js';
import { DEFAULT_MODEL } from '../config/models.js';
import type { SystemProfile } from '../types.js';
import type { SystemProfileData } from '../agents/system-profile.js';
import { trackApiCall, type AgentType } from '../services/usage-tracker.js';

// Context for usage tracking
export interface UsageTrackingContext {
    userId: string;
    sessionId?: string;
    agentType: AgentType | string;
    apiKeyType: 'user' | 'system';
}

const client = new OpenRouter({
    apiKey: config.OPENROUTER_API_KEY,
});

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

// --- Response cache for openRouterComplete ---
const completionCache = new TTLCache<string>({
    maxSize: config.CACHE_MAX_SIZE,
    ttl: config.CACHE_DEFAULT_TTL * 1000,
    namespace: 'openrouter-completions',
    strategy: 'lru',
});

export class LLMError extends Error {
    public readonly attempts: number;
    public readonly lastError: Error;

    constructor(message: string, attempts: number, lastError: Error) {
        super(message);
        this.name = 'LLMError';
        this.attempts = attempts;
        this.lastError = lastError;
    }
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    let attempt = 0;
    let lastError: Error = new Error('Unknown error');

    while (attempt < MAX_RETRIES) {
        try {
            return await fn();
        } catch (err: unknown) {
            attempt++;
            lastError = err instanceof Error ? err : new Error(String(err));

            if (attempt >= MAX_RETRIES) {
                console.error(`[OpenRouter] ${label} failed after ${attempt} attempts. Last error: ${lastError.message}`);
                throw new LLMError(
                    `${label} failed after ${attempt} attempts: ${lastError.message}`,
                    attempt,
                    lastError
                );
            }

            // Exponential backoff with jitter
            const baseDelay = Math.min(INITIAL_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
            const jitter = Math.random() * 0.3 * baseDelay; // Add 0-30% jitter
            const delay = Math.floor(baseDelay + jitter);

            console.warn(`[OpenRouter] ${label} attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    // This should never be reached, but TypeScript needs it
    throw new LLMError(`${label} failed after ${attempt} attempts`, attempt, lastError);
}

// --- Tool type definitions ---

export interface ToolParameter {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
}

export interface Tool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: ToolParameter;
    };
}

export interface ToolChoice {
    type: 'none' | 'auto' | 'required' | 'function';
    function?: {
        name: string;
    };
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface CompletionResult {
    content: string;
    toolCalls?: ToolCall[];
    modelUsed: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// --- Linux-only system prompt ---

const LINUX_SYSTEM_PROMPT = `You are Orito, an expert Linux assistant dedicated to helping users with all aspects of Linux systems and open-source technologies.

# Expertise Areas
- Linux distributions (Ubuntu, Fedora, Arch, Debian, openSUSE, Gentoo, NixOS, and more)
- System administration and configuration
- Command-line tools, shell scripting (Bash, Zsh, Fish, etc.)
- Package management (apt, dnf, pacman, zypper, emerge, nix, etc.)
- System services, systemd, init systems
- Networking, firewalls, DNS, SSH, VPN
- File systems, permissions, storage, LVM, RAID, Btrfs, ZFS
- Containerization (Docker, Podman, LXC, Kubernetes)
- DevOps tools (Ansible, Terraform, CI/CD pipelines)
- Security (SELinux, AppArmor, hardening, cryptography)
- Kernel configuration, modules, compilation
- Desktop environments (GNOME, KDE, XFCE, etc.) and display servers (X11, Wayland)
- Troubleshooting and performance optimization

# Constraints
- ONLY respond to Linux, system administration, and open-source technology questions
- If asked about non-technical topics (cooking, poetry, creative writing, general trivia, homework, etc.) or non-Linux systems (Windows, macOS-specific), politely decline: "I'm Orito, a Linux-specialized assistant. I can help with Linux, system administration, and open-source topics. Try asking me about [suggest a relevant Linux topic]."

# Response Style
- Be precise, practical, and current with your knowledge
- Always explain what commands do and note any risks
- Prefer distro-agnostic solutions; note when something is distro-specific
- For destructive operations, always warn and suggest dry-run or backup alternatives
- If unsure, acknowledge uncertainty rather than guessing
- Provide context-aware answers based on the user's distribution when known

# Tool Usage Philosophy
- Only use tools when necessary for the task at hand
- Prefer direct answers for straightforward questions
- Use search_packages when the user asks about specific package availability or details
- Use execute_command only when the user explicitly requests command execution or when you need to propose a command for their approval

# Command Proposals
When proposing commands for execution:
- Clearly explain the purpose and expected outcome
- Note any prerequisites or dependencies
- Warn about potential side effects or risks
- Suggest verification steps
- For multi-step operations, break them into logical, safe increments`;

/**
 * Format system profile for inclusion in system prompt
 */
function formatSystemProfile(profile: SystemProfile | SystemProfileData | null): string {
    if (!profile) {
        return '';
    }

    // Handle both SystemProfile and SystemProfileData formats
    const distro = (profile as any).distro;
    const version = (profile as any).distroVersion ?? (profile as any).version;
    const packageManager = (profile as any).packageManager;
    const shell = (profile as any).shell;
    const desktopEnv = (profile as any).windowManager ?? (profile as any).desktopEnvironment;

    if (!distro) {
        return '';
    }

    return `\n\n## User's System Profile
- Distribution: ${distro} ${version || ''}
- Package Manager: ${packageManager || 'Unknown'}
- Shell: ${shell || 'Unknown'}
- Desktop Environment: ${desktopEnv || 'Unknown'}`;
}

/**
 * Returns the full Linux system prompt with current date/time and system profile injected.
 * @param context - Object containing date and optional system profile
 */
export function getLinuxSystemPrompt(context: {
    date: string;
    systemProfile?: SystemProfile | SystemProfileData | null;
}): string {
    const profileSection = formatSystemProfile(context.systemProfile || null);

    return `
## Current Context

- **Date**: ${context.date}
- **System**: ${context.systemProfile ?
            (('distro' in context.systemProfile ? context.systemProfile.distro : (context.systemProfile as any).distro) || 'Not specified') +
            ('distroVersion' in context.systemProfile ? context.systemProfile.distroVersion : (context.systemProfile as any).version || '')
            : 'Not specified'}

## Critical Instructions

1. Always verify information is current as of 2025+
2. Use available tools when uncertain
3. All commands must be compatible with the user's system

${profileSection}

${LINUX_SYSTEM_PROMPT}

${getDateContext()}
`.trim();
}

/**
 * Non-streaming completion using OpenRouter with multi-model support
 * @param messages - Array of chat messages with role and content
 * @param options - Optional parameters for model selection, tools, and generation
 * @returns Object containing the response text, tool calls, and token usage
 */
export async function openRouterComplete(
    messages: Array<{ role: string; content: string }>,
    options: {
        modelId?: string;
        temperature?: number;
        maxTokens?: number;
        skipCache?: boolean;
        enableThinking?: boolean;
        onThinking?: (thinkingContent: string) => void;
        tools?: Tool[];
        toolChoice?: ToolChoice;
        apiKey?: string;
        usageTracking?: UsageTrackingContext;
    } = {}
): Promise<CompletionResult> {
    const modelId = options.modelId ?? DEFAULT_MODEL;
    const optimalParams = getOptimalParams(modelId);
    const temperature = options.temperature ?? optimalParams.temperature;
    const maxTokens = options.maxTokens ?? optimalParams.maxTokens;
    const skipCache = options.skipCache ?? false;
    const tools = options.tools;
    const toolChoice = options.toolChoice;
    const usageTracking = options.usageTracking;

    // Check if model supports tools
    const enableTools = tools && tools.length > 0 && shouldEnableTools(modelId);

    // Check cache (only for deterministic calls: temperature <= 0.1, no tools, and not skipping cache)
    const isCacheable = temperature <= 0.1 && !skipCache && !enableTools;
    
    // Track start time for latency measurement
    const startTime = Date.now();
    if (isCacheable) {
        const key = cacheKey(messages, maxTokens, temperature);
        const cached = completionCache.get(key);
        if (cached !== undefined) {
            return { content: cached, modelUsed: modelId };
        }
    }

    // Use custom client if apiKey provided, otherwise default client
    const requestClient = options.apiKey
        ? new OpenRouter({ apiKey: options.apiKey })
        : client;

    const result = await withRetry(async () => {
        const requestParams: any = {
            messages: messages.map(msg => ({
                role: msg.role as 'system' | 'user' | 'assistant',
                content: msg.content,
            })),
            model: modelId,
            temperature: temperature,
            maxTokens: maxTokens,
            stream: false,
            top_p: optimalParams.topP,
        };

        // Add tools if enabled for this model
        if (enableTools) {
            requestParams.tools = tools;
            if (toolChoice) {
                requestParams.tool_choice = toolChoice;
            }
        }

        const response = await requestClient.chat.send({
            chatGenerationParams: requestParams,
            httpReferer: config.OPENROUTER_SITE_URL,
            xTitle: config.OPENROUTER_SITE_NAME,
        });

        // Extract the content from the response
        const message = response.choices?.[0]?.message;
        const content = message?.content;
        let textContent = '';

        if (typeof content === 'string') {
            textContent = content;
        } else if (Array.isArray(content)) {
            // Handle array content (e.g., for multimodal responses)
            textContent = content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('');
        }

        // Extract tool calls from response
        const rawToolCalls = (message as any)?.tool_calls || (message as any)?.toolCalls;
        const toolCalls: ToolCall[] | undefined = rawToolCalls?.map((call: any) => ({
            id: call.id,
            type: call.type,
            function: {
                name: call.function?.name,
                arguments: call.function?.arguments,
            },
        }));

        // Extract token usage if available
        const usage = response.usage ? {
            promptTokens: response.usage.promptTokens || 0,
            completionTokens: response.usage.completionTokens || 0,
            totalTokens: response.usage.totalTokens || 0,
        } : undefined;

        // Get actual model used (may differ from requested due to routing)
        const modelUsed = response.model || modelId;

        return {
            content: textContent,
            toolCalls: toolCalls?.length ? toolCalls : undefined,
            modelUsed,
            usage
        };
    }, 'openRouterComplete');

    // Store in cache if cacheable (only the content string)
    if (isCacheable) {
        const key = cacheKey(messages, maxTokens, temperature);
        completionCache.set(key, result.content);
    }

    // Track usage if context is provided
    if (usageTracking && result.usage) {
        try {
            await trackApiCall({
                userId: usageTracking.userId,
                sessionId: usageTracking.sessionId,
                agentType: usageTracking.agentType,
                model: result.modelUsed,
                provider: 'openrouter',
                inputTokens: result.usage.promptTokens,
                outputTokens: result.usage.completionTokens,
                latencyMs: Date.now() - startTime,
                apiKeyType: usageTracking.apiKeyType,
                success: true,
            });
        } catch (trackingError) {
            // Log but don't fail the request
            console.error('[UsageTracking] Failed to track usage:', trackingError);
        }
    }

    return result;
}

/**
 * Streaming completion using OpenRouter with multi-model support
 * @param messages - Array of chat messages with role and content
 * @param options - Optional parameters for model, temperature, maxTokens, and tools
 * @param onChunk - Callback function that receives each chunk of text
 * @returns The complete response text after streaming
 */
export async function openRouterStream(
    messages: Array<{ role: string; content: string }>,
    options: {
        modelId?: string;
        temperature?: number;
        maxTokens?: number;
        tools?: Tool[];
        toolChoice?: ToolChoice;
        apiKey?: string;
        usageTracking?: UsageTrackingContext;
    } = {},
    onChunk: (chunk: string) => void
): Promise<CompletionResult> {
    const modelId = options.modelId ?? DEFAULT_MODEL;
    const optimalParams = getOptimalParams(modelId);
    const temperature = options.temperature ?? optimalParams.temperature;
    const maxTokens = options.maxTokens ?? optimalParams.maxTokens;
    const tools = options.tools;
    const toolChoice = options.toolChoice;
    const usageTracking = options.usageTracking;

    // Check if model supports tools
    const enableTools = tools && tools.length > 0 && shouldEnableTools(modelId);

    // Use custom client if apiKey provided, otherwise default client
    const requestClient = options.apiKey
        ? new OpenRouter({ apiKey: options.apiKey })
        : client;

    let fullResponse = '';
    let toolCallsBuffer: ToolCall[] = [];
    
    // Track start time for latency measurement
    const startTime = Date.now();

    const result = await withRetry(async () => {
        const requestParams: any = {
            messages: messages.map(msg => ({
                role: msg.role as 'system' | 'user' | 'assistant',
                content: msg.content,
            })),
            model: modelId,
            temperature: temperature,
            maxTokens: maxTokens,
            stream: true,
            top_p: optimalParams.topP,
        };

        // Add tools if enabled for this model
        if (enableTools) {
            requestParams.tools = tools;
            if (toolChoice) {
                requestParams.tool_choice = toolChoice;
            }
        }

        const stream = await requestClient.chat.send({
            chatGenerationParams: requestParams,
            httpReferer: config.OPENROUTER_SITE_URL,
            xTitle: config.OPENROUTER_SITE_NAME,
        });

        for await (const chunk of stream as unknown as AsyncIterable<any>) {
            const delta = chunk.choices?.[0]?.delta;
            const content = delta?.content;

            if (content) {
                onChunk(content);
                fullResponse += content;
            }

            // Accumulate tool calls from stream
            const toolCalls = delta?.tool_calls || delta?.toolCalls;
            if (toolCalls) {
                for (const call of toolCalls) {
                    const existing = toolCallsBuffer.find(c => c.id === call.id);
                    if (existing) {
                        // Append to existing tool call
                        existing.function.arguments += call.function?.arguments || '';
                    } else {
                        // New tool call
                        toolCallsBuffer.push({
                            id: call.id,
                            type: call.type || 'function',
                            function: {
                                name: call.function?.name || '',
                                arguments: call.function?.arguments || '',
                            },
                        });
                    }
                }
            }
        }

        return {
            content: fullResponse,
            toolCalls: toolCallsBuffer.length ? toolCallsBuffer : undefined,
            modelUsed: modelId,
        };
    }, 'openRouterStream');

    // Track usage if context is provided (streaming doesn't have token counts, estimate from response)
    if (usageTracking) {
        try {
            // Estimate tokens for streaming (rough approximation: ~4 chars per token)
            const estimatedInputTokens = Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
            const estimatedOutputTokens = Math.ceil(result.content.length / 4);
            
            await trackApiCall({
                userId: usageTracking.userId,
                sessionId: usageTracking.sessionId,
                agentType: usageTracking.agentType,
                model: result.modelUsed,
                provider: 'openrouter',
                inputTokens: estimatedInputTokens,
                outputTokens: estimatedOutputTokens,
                latencyMs: Date.now() - startTime,
                apiKeyType: usageTracking.apiKeyType,
                success: true,
            });
        } catch (trackingError) {
            // Log but don't fail the request
            console.error('[UsageTracking] Failed to track streaming usage:', trackingError);
        }
    }

    return result;
}

/** Get cache statistics */
export function getLLMCacheStats() {
    return completionCache.stats();
}

/**
 * Select and use the optimal model for a given task context
 * This is a convenience function that combines model selection with completion
 */
export async function openRouterCompleteWithModelSelection(
    messages: Array<{ role: string; content: string }>,
    taskContext: TaskContext,
    options: {
        maxTokens?: number;
        skipCache?: boolean;
        tools?: Tool[];
        toolChoice?: ToolChoice;
        apiKey?: string;
        usageTracking?: UsageTrackingContext;
    } = {}
): Promise<CompletionResult> {
    // Import here to avoid circular dependency
    const { selectModel } = await import('./model-selector.js');
    const selection = selectModel(taskContext);

    console.log(`[ModelSelection] Selected ${selection.selectedModel} (${selection.confidence} confidence): ${selection.reasoning}`);

    return openRouterComplete(messages, {
        modelId: selection.selectedModel,
        maxTokens: options.maxTokens,
        skipCache: options.skipCache,
        tools: options.tools,
        toolChoice: options.toolChoice,
        apiKey: options.apiKey,
        usageTracking: options.usageTracking,
    });
}
