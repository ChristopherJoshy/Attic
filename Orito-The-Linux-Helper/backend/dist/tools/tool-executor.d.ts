/**
 * Tool Executor - Handles tool execution with validation, error handling, and result formatting
 * Provides a robust layer between the LLM tool calls and actual tool implementations
 */
import { ToolResult } from './tool-registry.js';
import { z } from 'zod';
/**
 * Tool call as received from LLM
 */
export interface LLMToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
/**
 * Parsed tool call with validated arguments
 */
export interface ParsedToolCall {
    id: string;
    name: string;
    args: Record<string, any>;
    rawArgs: string;
}
/**
 * Tool execution context
 */
export interface ToolExecutionContext {
    allowedTools: string[];
    userId?: string;
    sessionId?: string;
    systemProfile?: {
        packageManager?: string | null;
        distro?: string | null;
    } | null;
}
/**
 * Formatted tool result for LLM consumption
 */
export interface FormattedToolResult {
    tool_call_id: string;
    role: "tool";
    name: string;
    content: string;
}
/**
 * Logger interface for tool execution events
 */
interface ToolLogger {
    debug: (message: string, meta?: any) => void;
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
}
/**
 * Parse tool call arguments from LLM
 * Handles JSON parsing with error recovery
 */
export declare function parseToolCall(toolCall: LLMToolCall): ParsedToolCall;
/**
 * Validate a parsed tool call against schema
 */
export declare function validateToolCall(parsedCall: ParsedToolCall): {
    valid: boolean;
    errors: string[];
};
/**
 * Execute a single tool call with full validation and error handling
 */
export declare function executeToolCall(toolCall: LLMToolCall, context: ToolExecutionContext, logger?: ToolLogger): Promise<FormattedToolResult>;
/**
 * Execute multiple tool calls in parallel
 */
export declare function executeToolCalls(toolCalls: LLMToolCall[], context: ToolExecutionContext, logger?: ToolLogger): Promise<FormattedToolResult[]>;
/**
 * Format tool result for LLM message history
 */
export declare function formatToolResult(toolCallId: string, toolName: string, result: ToolResult): FormattedToolResult;
/**
 * Create a tool response message for the LLM
 */
export declare function createToolResponseMessage(toolCallId: string, toolName: string, result: any): {
    role: "tool";
    tool_call_id: string;
    content: string;
};
/**
 * Safely serialize tool result to string
 */
export declare function serializeToolResult(result: any): string;
/**
 * Zod schema for validating tool call format from LLM
 */
export declare const LLMToolCallSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodLiteral<"function">;
    function: z.ZodObject<{
        name: z.ZodString;
        arguments: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        arguments: string;
    }, {
        name: string;
        arguments: string;
    }>;
}, "strip", z.ZodTypeAny, {
    function: {
        name: string;
        arguments: string;
    };
    type: "function";
    id: string;
}, {
    function: {
        name: string;
        arguments: string;
    };
    type: "function";
    id: string;
}>;
/**
 * Validate array of tool calls
 */
export declare function validateToolCalls(toolCalls: unknown[]): {
    valid: boolean;
    errors: string[];
    calls: LLMToolCall[];
};
/**
 * Get execution statistics for monitoring
 */
export interface ExecutionStats {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalDurationMs: number;
    averageDurationMs: number;
}
/**
 * Simple stats tracker for tool execution
 */
export declare class ToolExecutionStats {
    private stats;
    record(toolName: string, durationMs: number, success: boolean): void;
    getStats(): Record<string, {
        count: number;
        avgDurationMs: number;
        errorRate: number;
    }>;
    reset(): void;
}
export declare const globalToolStats: ToolExecutionStats;
export {};
//# sourceMappingURL=tool-executor.d.ts.map