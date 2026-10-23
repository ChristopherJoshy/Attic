/**
 * Tool Loop - Implements multi-turn tool calling with LLM
 * Handles the conversation loop between LLM and tools until completion
 */
import { openRouterComplete, openRouterStream } from './openrouter-client.js';
import { executeToolCalls, parseToolCall, validateToolCalls, globalToolStats } from '../tools/tool-executor.js';
import { getAllToolSchemas } from '../tools/tool-schemas.js';
/**
 * System prompt for tool calling
 */
const TOOL_SYSTEM_PROMPT = `You are Orito, an expert Linux assistant with access to tools.

When you need to search for information, perform calculations, validate commands, or look up documentation, use the available tools.

Tool Usage Guidelines:
1. Only use tools when necessary - prefer direct answers for simple questions
2. Use web_search for current Linux information, troubleshooting, and tutorials
3. Use search_wikipedia for Linux concepts, distributions, and command documentation  
4. Use calculate for any mathematical operations
5. Use validate_command before proposing potentially risky commands
6. Use lookup_manpage for detailed command reference information
7. Use search_packages when users ask about software availability

Always explain your reasoning when using tools. If a tool returns an error or no results, acknowledge this and try alternative approaches or ask for clarification.

You can make up to 5 tool calls in a single conversation to gather the information needed.`;
/**
 * Check if a completion response has tool calls
 */
function hasToolCalls(response) {
    return response?.tool_calls && Array.isArray(response.tool_calls) && response.tool_calls.length > 0;
}
/**
 * Extract tool calls from LLM response
 * Handles different response formats from various models
 */
function extractToolCalls(response) {
    if (!response)
        return [];
    // OpenAI format
    if (response.tool_calls && Array.isArray(response.tool_calls)) {
        return response.tool_calls;
    }
    // Check for tool_calls in message
    if (response.message?.tool_calls) {
        return response.message.tool_calls;
    }
    // Some models embed tool calls in content as JSON
    if (typeof response.content === 'string') {
        try {
            const parsed = JSON.parse(response.content);
            if (parsed.tool_calls) {
                return parsed.tool_calls;
            }
        }
        catch {
            // Not JSON, ignore
        }
    }
    return [];
}
/**
 * Convert tool results to message format for LLM
 */
function toolResultsToMessages(results) {
    return results.map(result => ({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id,
        name: result.name
    }));
}
/**
 * Add assistant message with tool calls to history
 */
function addAssistantMessageWithTools(messages, content, toolCalls) {
    return [
        ...messages,
        {
            role: 'assistant',
            content: content || '',
            tool_calls: toolCalls
        }
    ];
}
/**
 * Add tool results to message history
 */
function addToolResults(messages, results) {
    return [...messages, ...toolResultsToMessages(results)];
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
export async function completionWithTools(messages, tools, allowedTools, modelId, options = {}) {
    const { temperature = 0.7, maxTokens = 4096, maxIterations = 5, skipCache = true, onIteration, onToolResult } = options;
    // Prepare execution context
    const context = {
        allowedTools,
        userId: undefined,
        sessionId: undefined,
        systemProfile: null
    };
    // Track all tool calls made
    const allToolCalls = [];
    // Current message history (mutable)
    let currentMessages = [...messages];
    // Total token usage
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    for (let iteration = 0; iteration < maxIterations; iteration++) {
        // Call LLM with tools
        const response = await openRouterComplete(currentMessages, {
            modelId: modelId,
            temperature,
            maxTokens,
            skipCache
        });
        // Track token usage
        if (response.usage) {
            totalUsage.promptTokens += response.usage.promptTokens;
            totalUsage.completionTokens += response.usage.completionTokens;
            totalUsage.totalTokens += response.usage.totalTokens;
        }
        // Extract tool calls from response
        const toolCalls = extractToolCalls(response);
        // No tool calls - we're done
        if (toolCalls.length === 0) {
            return {
                content: response.content,
                toolCalls: allToolCalls,
                iterations: iteration + 1,
                usage: totalUsage
            };
        }
        // Notify callback
        if (onIteration) {
            onIteration(iteration + 1, toolCalls);
        }
        // Validate tool calls
        const validation = validateToolCalls(toolCalls);
        if (!validation.valid) {
            console.warn('[ToolLoop] Invalid tool calls:', validation.errors);
            // Add error message and continue
            currentMessages = addAssistantMessageWithTools(currentMessages, response.content, toolCalls);
            // Add error as tool result
            const errorResults = validation.errors.map((error, i) => ({
                tool_call_id: toolCalls[i]?.id || `error-${i}`,
                role: 'tool',
                name: toolCalls[i]?.function?.name || 'unknown',
                content: JSON.stringify({ error })
            }));
            currentMessages = addToolResults(currentMessages, errorResults);
            continue;
        }
        // Add assistant message with tool calls to history
        currentMessages = addAssistantMessageWithTools(currentMessages, response.content, validation.calls);
        // Execute tool calls
        const toolResults = await executeToolCalls(validation.calls, context);
        // Track tool calls and results
        for (let i = 0; i < validation.calls.length; i++) {
            const call = validation.calls[i];
            const result = toolResults[i];
            try {
                const parsedCall = parseToolCall(call);
                allToolCalls.push({
                    name: parsedCall.name,
                    args: parsedCall.args,
                    result: JSON.parse(result.content)
                });
                // Notify callback
                if (onToolResult) {
                    onToolResult(parsedCall.name, JSON.parse(result.content));
                }
                // Track stats
                globalToolStats.record(parsedCall.name, 0, // Duration tracked in executor
                !result.content.includes('"error"'));
            }
            catch (e) {
                console.warn('[ToolLoop] Failed to track tool call:', e);
            }
        }
        // Add tool results to message history
        currentMessages = addToolResults(currentMessages, toolResults);
    }
    // Max iterations reached - make one final call without tools
    console.warn(`[ToolLoop] Max iterations (${maxIterations}) reached, making final call`);
    const finalResponse = await openRouterComplete(currentMessages, {
        modelId: modelId,
        temperature,
        maxTokens,
        skipCache
    });
    if (finalResponse.usage) {
        totalUsage.promptTokens += finalResponse.usage.promptTokens;
        totalUsage.completionTokens += finalResponse.usage.completionTokens;
        totalUsage.totalTokens += finalResponse.usage.totalTokens;
    }
    return {
        content: finalResponse.content,
        toolCalls: allToolCalls,
        iterations: maxIterations,
        usage: totalUsage
    };
}
/**
 * Simple completion with tools using all available tools
 */
export async function simpleCompletionWithTools(userMessage, systemPrompt = TOOL_SYSTEM_PROMPT, options = {}) {
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
    ];
    const tools = getAllToolSchemas();
    const allowedTools = tools.map(t => t.function.name);
    const modelId = options.modelId || 'nvidia/nemotron-3-nano-30b-a3b:free';
    return completionWithTools(messages, tools, allowedTools, modelId, options);
}
/**
 * Streaming completion with tools
 * Note: Full streaming with tools is complex - this executes tools then streams final response
 */
export async function streamingCompletionWithTools(messages, tools, allowedTools, modelId, onChunk, options = {}) {
    // First, do the tool loop without streaming
    const result = await completionWithTools(messages, tools, allowedTools, modelId, { ...options, maxIterations: options.maxIterations || 5 });
    // Then stream the final response (re-generating it)
    // This is a simplified approach - a full implementation would cache the final messages
    // and re-stream from there
    const finalMessages = [
        ...messages,
        { role: 'assistant', content: result.content }
    ];
    // Stream the content
    await openRouterStream(finalMessages, {
        modelId: modelId,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 4096
    }, onChunk);
    return result;
}
/**
 * Check if a message might need tool usage
 * Simple heuristic to avoid unnecessary tool calls
 */
export function mightNeedTools(message) {
    const toolIndicators = [
        /search|look up|find|google/i,
        /calculate|compute|math|sum|multiply|divide/i,
        /package|install|apt|dnf|pacman/i,
        /command|terminal|shell|bash/i,
        /man page|manual|documentation/i,
        /wikipedia|wiki/i,
        /convert|conversion/i,
        /validate|check.*command/i
    ];
    return toolIndicators.some(pattern => pattern.test(message));
}
/**
 * Select relevant tools based on user message
 * Optimization to reduce token usage and improve accuracy
 */
export function selectRelevantTools(message) {
    const normalized = message.toLowerCase();
    const selected = [];
    // Search tools
    if (/search|look up|find|google|web/i.test(normalized)) {
        selected.push('web_search');
    }
    if (/wikipedia|wiki/i.test(normalized)) {
        selected.push('search_wikipedia', 'get_wiki_summary');
    }
    // Calculation tools
    if (/calculate|compute|math|sum|multiply|divide|convert.*to/i.test(normalized)) {
        selected.push('calculate');
        if (/convert|gb|mb|kb|bytes|temperature|degree/i.test(normalized)) {
            selected.push('convert_units');
        }
    }
    // Command tools
    if (/command|terminal|shell|bash|script/i.test(normalized)) {
        selected.push('validate_command', 'lookup_manpage');
        if (/install|package|apt|dnf|pacman|zypper/i.test(normalized)) {
            selected.push('search_packages', 'get_dry_run_equivalent');
        }
    }
    // Man page
    if (/man page|manual|man .*command|documentation.*for/i.test(normalized)) {
        selected.push('lookup_manpage');
    }
    // Date/time
    if (/current.*time|what.*time|date|today|now/i.test(normalized)) {
        selected.push('get_current_datetime');
    }
    // If no specific tools selected, return common ones
    if (selected.length === 0) {
        return ['web_search', 'search_wikipedia', 'calculate', 'validate_command'];
    }
    return [...new Set(selected)];
}
//# sourceMappingURL=tool-loop.js.map