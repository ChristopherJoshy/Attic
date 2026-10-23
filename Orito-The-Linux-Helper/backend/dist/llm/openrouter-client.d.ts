import { type TaskContext } from './model-selector.js';
import type { SystemProfile } from '../types.js';
import type { SystemProfileData } from '../agents/system-profile.js';
export declare class LLMError extends Error {
    readonly attempts: number;
    readonly lastError: Error;
    constructor(message: string, attempts: number, lastError: Error);
}
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
/**
 * Returns the full Linux system prompt with current date/time and system profile injected.
 * @param context - Object containing date and optional system profile
 */
export declare function getLinuxSystemPrompt(context: {
    date: string;
    systemProfile?: SystemProfile | SystemProfileData | null;
}): string;
/**
 * Non-streaming completion using OpenRouter with multi-model support
 * @param messages - Array of chat messages with role and content
 * @param options - Optional parameters for model selection, tools, and generation
 * @returns Object containing the response text, tool calls, and token usage
 */
export declare function openRouterComplete(messages: Array<{
    role: string;
    content: string;
}>, options?: {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    skipCache?: boolean;
    enableThinking?: boolean;
    onThinking?: (thinkingContent: string) => void;
    tools?: Tool[];
    toolChoice?: ToolChoice;
}): Promise<CompletionResult>;
/**
 * Streaming completion using OpenRouter with multi-model support
 * @param messages - Array of chat messages with role and content
 * @param options - Optional parameters for model, temperature, maxTokens, and tools
 * @param onChunk - Callback function that receives each chunk of text
 * @returns The complete response text after streaming
 */
export declare function openRouterStream(messages: Array<{
    role: string;
    content: string;
}>, options: {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: Tool[];
    toolChoice?: ToolChoice;
} | undefined, onChunk: (chunk: string) => void): Promise<CompletionResult>;
/** Get cache statistics */
export declare function getLLMCacheStats(): import("../utils/ttl-cache.js").CacheStats;
/**
 * Select and use the optimal model for a given task context
 * This is a convenience function that combines model selection with completion
 */
export declare function openRouterCompleteWithModelSelection(messages: Array<{
    role: string;
    content: string;
}>, taskContext: TaskContext, options?: {
    maxTokens?: number;
    skipCache?: boolean;
    tools?: Tool[];
    toolChoice?: ToolChoice;
}): Promise<CompletionResult>;
//# sourceMappingURL=openrouter-client.d.ts.map