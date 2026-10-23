/**
 * Tool Executor - Handles tool execution with validation, error handling, and result formatting
 * Provides a robust layer between the LLM tool calls and actual tool implementations
 */
import { executeTool as registryExecute } from './tool-registry.js';
import { validateToolArgs, isValidTool } from './tool-schemas.js';
import { z } from 'zod';
// Default no-op logger
const defaultLogger = {
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { }
};
/**
 * Parse tool call arguments from LLM
 * Handles JSON parsing with error recovery
 */
export function parseToolCall(toolCall) {
    try {
        const args = JSON.parse(toolCall.function.arguments);
        return {
            id: toolCall.id,
            name: toolCall.function.name,
            args,
            rawArgs: toolCall.function.arguments
        };
    }
    catch (error) {
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
        }
        catch {
            throw new Error(`Invalid JSON in tool call arguments: ${error}`);
        }
    }
}
/**
 * Fix common JSON issues from LLM output
 */
function fixJsonArgs(jsonString) {
    // Remove markdown code blocks
    let fixed = jsonString.replace(/```json/g, '').replace(/```/g, '');
    // Trim whitespace
    fixed = fixed.trim();
    // Ensure proper object wrapper
    if (!fixed.startsWith('{'))
        fixed = '{' + fixed;
    if (!fixed.endsWith('}'))
        fixed = fixed + '}';
    // Fix trailing commas
    fixed = fixed.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    return fixed;
}
/**
 * Validate a parsed tool call against schema
 */
export function validateToolCall(parsedCall) {
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
function injectSystemContext(args, toolName, context) {
    const enhancedArgs = { ...args };
    // Inject package manager info for relevant tools
    if (toolName === 'validate_command' || toolName === 'search_packages') {
        if (context.systemProfile?.packageManager && !enhancedArgs.detectedPackageManager && !enhancedArgs.packageManager) {
            if (toolName === 'validate_command') {
                enhancedArgs.detectedPackageManager = context.systemProfile.packageManager;
            }
            else {
                enhancedArgs.packageManager = context.systemProfile.packageManager;
            }
        }
    }
    return enhancedArgs;
}
/**
 * Execute a single tool call with full validation and error handling
 */
export async function executeToolCall(toolCall, context, logger = defaultLogger) {
    const startTime = Date.now();
    logger.info(`Executing tool: ${toolCall.function.name}`, {
        tool: toolCall.function.name,
        userId: context.userId,
        sessionId: context.sessionId
    });
    // Parse the tool call
    let parsedCall;
    try {
        parsedCall = parseToolCall(toolCall);
    }
    catch (error) {
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
        const result = await registryExecute(parsedCall.name, enhancedArgs, context.allowedTools);
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
    }
    catch (error) {
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
export async function executeToolCalls(toolCalls, context, logger = defaultLogger) {
    return Promise.all(toolCalls.map(call => executeToolCall(call, context, logger)));
}
/**
 * Format tool result for LLM message history
 */
export function formatToolResult(toolCallId, toolName, result) {
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
export function createToolResponseMessage(toolCallId, toolName, result) {
    return {
        role: "tool",
        tool_call_id: toolCallId,
        content: typeof result === 'string' ? result : JSON.stringify(result)
    };
}
/**
 * Safely serialize tool result to string
 */
export function serializeToolResult(result) {
    if (result === null || result === undefined) {
        return '';
    }
    if (typeof result === 'string') {
        return result;
    }
    try {
        return JSON.stringify(result, null, 2);
    }
    catch {
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
export function validateToolCalls(toolCalls) {
    const errors = [];
    const validCalls = [];
    for (let i = 0; i < toolCalls.length; i++) {
        const result = LLMToolCallSchema.safeParse(toolCalls[i]);
        if (result.success) {
            validCalls.push(result.data);
        }
        else {
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
 * Simple stats tracker for tool execution
 */
export class ToolExecutionStats {
    stats = new Map();
    record(toolName, durationMs, success) {
        const current = this.stats.get(toolName) || { count: 0, totalDuration: 0, errors: 0 };
        current.count++;
        current.totalDuration += durationMs;
        if (!success)
            current.errors++;
        this.stats.set(toolName, current);
    }
    getStats() {
        const result = {};
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
//# sourceMappingURL=tool-executor.js.map