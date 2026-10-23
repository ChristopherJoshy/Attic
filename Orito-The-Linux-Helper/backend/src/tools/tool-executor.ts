/**
 * Tool Executor - Handles tool execution with validation, error handling, and result formatting
 * Provides a robust layer between the LLM tool calls and actual tool implementations
 */

import { toolRegistry, executeTool as registryExecute, ToolResult } from './tool-registry.js';
import { toolSchemas, validateToolArgs, isValidTool, ToolSchema } from './tool-schemas.js';
import { z } from 'zod';

/**
 * Tool call as received from LLM
 */
export interface LLMToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string; // JSON string
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

// Default no-op logger
const defaultLogger: ToolLogger = {
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { }
};

/**
 * Parse tool call arguments from LLM
 * Handles JSON parsing with error recovery
 */
export function parseToolCall(toolCall: LLMToolCall): ParsedToolCall {
    try {
        const args = JSON.parse(toolCall.function.arguments);
        return {
            id: toolCall.id,
            name: toolCall.function.name,
            args,
            rawArgs: toolCall.function.arguments
        };
    } catch (error) {
        // Try to fix common JSON issues
        try {
            const fixed = fixJsonArgs(toolCall.function.arguments);
            const args = JSON.parse(fixed);
            return {
                id: toolCall.id,
                name: toolCall.function.name,
                args,
                rawArgs: toolCall.function.arguments
            };
        } catch {
            throw new Error(`Invalid JSON in tool call arguments: ${error}`);
        }
    }
}

/**
 * Fix common JSON issues from LLM output
 */
function fixJsonArgs(jsonString: string): string {
    // Remove markdown code blocks
    let fixed = jsonString.replace(/```json/g, '').replace(/```/g, '');

    // Trim whitespace
    fixed = fixed.trim();

    // Ensure proper object wrapper
    if (!fixed.startsWith('{')) fixed = '{' + fixed;
    if (!fixed.endsWith('}')) fixed = fixed + '}';

    // Fix trailing commas
    fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    return fixed;
}

/**
 * Validate a parsed tool call against schema
 */
export function validateToolCall(parsedCall: ParsedToolCall): { valid: boolean; errors: string[] } {
    if (!isValidTool(parsedCall.name)) {
        return {
            valid: false,
            errors: [`Unknown tool: ${parsedCall.name}`]
        };
    }

    const errors = validateToolArgs(parsedCall.name, parsedCall.args);
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Inject system context into tool arguments
 */
function injectSystemContext(
    args: Record<string, any>,
    toolName: string,
    context: ToolExecutionContext
): Record<string, any> {
    const enhancedArgs = { ...args };

    // Inject package manager info for relevant tools
    if (toolName === 'validate_command' || toolName === 'search_packages') {
        if (context.systemProfile?.packageManager && !enhancedArgs.detectedPackageManager && !enhancedArgs.packageManager) {
            if (toolName === 'validate_command') {
                enhancedArgs.detectedPackageManager = context.systemProfile.packageManager;
            } else {
                enhancedArgs.packageManager = context.systemProfile.packageManager;
            }
        }
    }

    // Inject system context for recursive usage tracking
    if (context.userId) enhancedArgs.userId = context.userId;
    if (context.sessionId) enhancedArgs.sessionId = context.sessionId;

    return enhancedArgs;
}

/**
 * Execute a single tool call with full validation and error handling
 */
export async function executeToolCall(
    toolCall: LLMToolCall,
    context: ToolExecutionContext,
    logger: ToolLogger = defaultLogger
): Promise<FormattedToolResult> {
    const startTime = Date.now();

    logger.info(`Executing tool: ${toolCall.function.name}`, {
        tool: toolCall.function.name,
        userId: context.userId,
        sessionId: context.sessionId
    });

    // Parse the tool call
    let parsedCall: ParsedToolCall;
    try {
        parsedCall = parseToolCall(toolCall);
    } catch (error: any) {
        logger.error(`Failed to parse tool call: ${error.message}`, { tool: toolCall.function.name });
        return {
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolCall.function.name,
            content: JSON.stringify({
                error: "Invalid tool arguments",
                details: error.message,
                raw: toolCall.function.arguments
            })
        };
    }

    // Validate against schema
    const validation = validateToolCall(parsedCall);
    if (!validation.valid) {
        logger.warn(`Tool validation failed: ${validation.errors.join(', ')}`, {
            tool: parsedCall.name,
            args: parsedCall.args
        });
        return {
            tool_call_id: toolCall.id,
            role: "tool",
            name: parsedCall.name,
            content: JSON.stringify({
                error: "Tool validation failed",
                details: validation.errors,
                providedArgs: parsedCall.args
            })
        };
    }

    // Inject system context
    const enhancedArgs = injectSystemContext(parsedCall.args, parsedCall.name, context);

    // Execute the tool
    try {
        const result = await registryExecute(
            parsedCall.name,
            enhancedArgs,
            context.allowedTools
        );

        const duration = Date.now() - startTime;

        logger.info(`Tool execution completed: ${parsedCall.name}`, {
            tool: parsedCall.name,
            success: result.success,
            durationMs: duration
        });

        return {
            tool_call_id: toolCall.id,
            role: "tool",
            name: parsedCall.name,
            content: JSON.stringify(result.success ? result.data : { error: result.error })
        };
    } catch (error: any) {
        const duration = Date.now() - startTime;

        logger.error(`Tool execution failed: ${error.message}`, {
            tool: parsedCall.name,
            durationMs: duration,
            error: error.stack
        });

        return {
            tool_call_id: toolCall.id,
            role: "tool",
            name: parsedCall.name,
            content: JSON.stringify({
                error: "Tool execution failed",
                details: error.message
            })
        };
    }
}

/**
 * Execute multiple tool calls in parallel
 */
export async function executeToolCalls(
    toolCalls: LLMToolCall[],
    context: ToolExecutionContext,
    logger: ToolLogger = defaultLogger
): Promise<FormattedToolResult[]> {
    return Promise.all(
        toolCalls.map(call => executeToolCall(call, context, logger))
    );
}

/**
 * Format tool result for LLM message history
 */
export function formatToolResult(
    toolCallId: string,
    toolName: string,
    result: ToolResult
): FormattedToolResult {
    return {
        tool_call_id: toolCallId,
        role: "tool",
        name: toolName,
        content: JSON.stringify(result.success ? result.data : { error: result.error })
    };
}

/**
 * Create a tool response message for the LLM
 */
export function createToolResponseMessage(
    toolCallId: string,
    toolName: string,
    result: any
): { role: "tool"; tool_call_id: string; content: string } {
    return {
        role: "tool",
        tool_call_id: toolCallId,
        content: typeof result === 'string' ? result : JSON.stringify(result)
    };
}

/**
 * Safely serialize tool result to string
 */
export function serializeToolResult(result: any): string {
    if (result === null || result === undefined) {
        return '';
    }

    if (typeof result === 'string') {
        return result;
    }

    try {
        return JSON.stringify(result, null, 2);
    } catch {
        return String(result);
    }
}

/**
 * Zod schema for validating tool call format from LLM
 */
export const LLMToolCallSchema = z.object({
    id: z.string(),
    type: z.literal("function"),
    function: z.object({
        name: z.string(),
        arguments: z.string()
    })
});

/**
 * Validate array of tool calls
 */
export function validateToolCalls(toolCalls: unknown[]): { valid: boolean; errors: string[]; calls: LLMToolCall[] } {
    const errors: string[] = [];
    const validCalls: LLMToolCall[] = [];

    for (let i = 0; i < toolCalls.length; i++) {
        const result = LLMToolCallSchema.safeParse(toolCalls[i]);
        if (result.success) {
            validCalls.push(result.data);
        } else {
            errors.push(`Tool call ${i}: ${result.error.message}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        calls: validCalls
    };
}

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
export class ToolExecutionStats {
    private stats: Map<string, { count: number; totalDuration: number; errors: number }> = new Map();

    record(toolName: string, durationMs: number, success: boolean) {
        const current = this.stats.get(toolName) || { count: 0, totalDuration: 0, errors: 0 };
        current.count++;
        current.totalDuration += durationMs;
        if (!success) current.errors++;
        this.stats.set(toolName, current);
    }

    getStats(): Record<string, { count: number; avgDurationMs: number; errorRate: number }> {
        const result: Record<string, { count: number; avgDurationMs: number; errorRate: number }> = {};
        for (const [name, data] of this.stats) {
            result[name] = {
                count: data.count,
                avgDurationMs: data.totalDuration / data.count,
                errorRate: data.errors / data.count
            };
        }
        return result;
    }

    reset() {
        this.stats.clear();
    }
}

// Global stats instance
export const globalToolStats = new ToolExecutionStats();
