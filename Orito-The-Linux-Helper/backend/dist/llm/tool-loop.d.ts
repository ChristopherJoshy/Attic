/**
 * Tool Loop - Implements multi-turn tool calling with LLM
 * Handles the conversation loop between LLM and tools until completion
 */
import { LLMToolCall } from '../tools/tool-executor.js';
import { ToolSchema } from '../tools/tool-schemas.js';
/**
 * Message type for conversation history
 */
export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: LLMToolCall[];
    tool_call_id?: string;
    name?: string;
}
/**
 * Result from completion with tools
 */
export interface CompletionResult {
    content: string;
    toolCalls: Array<{
        name: string;
        args: Record<string, any>;
        result: any;
    }>;
    iterations: number;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
/**
 * Options for completion with tools
 */
export interface CompletionWithToolsOptions {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    maxIterations?: number;
    skipCache?: boolean;
    onIteration?: (iteration: number, toolCalls: LLMToolCall[]) => void;
    onToolResult?: (toolName: string, result: any) => void;
}
/**
 * Main tool loop - Complete conversation with tool calling
 *
 * Flow:
 * 1. Call LLM with available tools
 * 2. If response has tool_calls:
 *    a. Execute each tool
 *    b. Append results to message history
 *    c. Call LLM again with results
 *    d. Repeat (max maxIterations)
 * 3. Return final content
 */
export declare function completionWithTools(messages: Message[], tools: ToolSchema[], allowedTools: string[], modelId: string, options?: CompletionWithToolsOptions): Promise<CompletionResult>;
/**
 * Simple completion with tools using all available tools
 */
export declare function simpleCompletionWithTools(userMessage: string, systemPrompt?: string, options?: CompletionWithToolsOptions): Promise<CompletionResult>;
/**
 * Streaming completion with tools
 * Note: Full streaming with tools is complex - this executes tools then streams final response
 */
export declare function streamingCompletionWithTools(messages: Message[], tools: ToolSchema[], allowedTools: string[], modelId: string, onChunk: (chunk: string) => void, options?: Omit<CompletionWithToolsOptions, 'onIteration'>): Promise<CompletionResult>;
/**
 * Check if a message might need tool usage
 * Simple heuristic to avoid unnecessary tool calls
 */
export declare function mightNeedTools(message: string): boolean;
/**
 * Select relevant tools based on user message
 * Optimization to reduce token usage and improve accuracy
 */
export declare function selectRelevantTools(message: string): string[];
//# sourceMappingURL=tool-loop.d.ts.map