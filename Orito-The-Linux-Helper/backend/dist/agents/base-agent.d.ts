import EventEmitter from 'eventemitter3';
import type { AgentEventType, AgentStatus, AgentType, OrchestratorContext, AgentQuestion, Citation } from '../types.js';
import type { AgentDefinition } from './loader.js';
export declare const MAX_AGENT_DEPTH = 2;
export interface AgentInput {
    query: string;
    additionalData?: Record<string, unknown>;
}
export interface AgentOutput {
    success: boolean;
    data?: unknown;
    error?: string;
    metrics: AgentMetrics;
}
export interface AgentMetrics {
    startTime: string;
    endTime: string;
    durationMs: number;
    tokensUsed: number;
    toolCallsCount: number;
}
export interface AgentToolResult {
    tool: string;
    input: string;
    output: string;
}
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, {
            type: string;
            description: string;
            enum?: string[];
            items?: {
                type: string;
            };
        }>;
        required: string[];
    };
}
export interface ToolCallResult {
    tool: string;
    parameters: Record<string, unknown>;
    result: unknown;
    error?: string;
}
export interface SubAgentRequest {
    requestId: string;
    parentAgentId: string;
    parentDepth: number;
    agentType: string;
    task: string;
    input: string;
    additionalData?: Record<string, unknown>;
    modelId?: string;
}
export interface AgentConfig {
    timeout?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}
export declare const AGENT_COLORS: Record<string, string>;
export declare abstract class BaseAgent extends EventEmitter {
    readonly id: string;
    readonly name: string;
    readonly agentType: AgentType;
    readonly color: string;
    readonly task: string;
    readonly parentAgentId?: string;
    readonly depth: number;
    protected selectedModel: string;
    protected useToolCalling: boolean;
    protected context: OrchestratorContext;
    protected definition: AgentDefinition;
    protected systemPrompt: string;
    protected toolResults: AgentToolResult[];
    protected config: AgentConfig;
    private _status;
    private _metrics;
    private _toolStartTimes;
    private circuitBreaker;
    protected toolRegistry: Map<string, (params: Record<string, unknown>) => Promise<unknown>>;
    private pendingSubAgentRequests;
    spawnedSubAgents: BaseAgent[];
    constructor(agentType: AgentType, name: string, color: string, task: string, context: OrchestratorContext, config?: AgentConfig, parentAgentId?: string, depth?: number, modelId?: string);
    get status(): AgentStatus;
    get metrics(): AgentMetrics | undefined;
    protected setStatus(status: AgentStatus): void;
    protected emitEvent(event: AgentEventType): void;
    /**
     * Initialize the tool registry with available tools.
     * Subclasses can override to register their specific tools.
     */
    protected initializeToolRegistry(): void;
    /**
     * Register a tool in the registry
     */
    protected registerTool(name: string, handler: (params: Record<string, unknown>) => Promise<unknown>): void;
    /**
     * Get tool definitions for the LLM based on allowed tools from agent definition
     */
    protected getToolDefinitions(): ToolDefinition[];
    /**
     * Get a tool definition by name
     */
    private getToolDefinition;
    /**
     * Execute a tool call with the given parameters
     */
    protected executeToolCall(toolName: string, parameters: Record<string, unknown>): Promise<ToolCallResult>;
    /**
     * Call LLM with tool calling support
     * This is the core method for LLM-driven tool calling
     */
    protected callWithTools(messages: Array<{
        role: string;
        content: string;
    }>, allowedTools: string[], options?: {
        temperature?: number;
        maxTokens?: number;
        maxToolCalls?: number;
    }): Promise<{
        content: string;
        toolCalls: ToolCallResult[];
        usage?: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
        };
    }>;
    /**
     * Load agent definition from markdown file
     * Should be called by subclasses during initialization
     */
    initialize(): Promise<void>;
    /**
     * Render the system prompt with context variables
     * Subclasses can override to provide custom context
     */
    protected renderSystemPrompt(): string;
    /**
     * Check if a tool is allowed based on agent definition
     */
    protected canUseTool(toolName: string): boolean;
    /**
     * Validate tool use before execution
     * Throws error if tool is not allowed
     */
    protected validateToolUse(toolName: string): Promise<void>;
    /**
     * Ask the user multiple questions with rich options
     * Returns a Promise that resolves with all answers
     */
    protected askUserQuestions(questions: AgentQuestion[]): Promise<Record<string, string | string[]>>;
    /**
     * Record token usage in metrics
     */
    protected recordTokenUsage(tokens: number): void;
    /**
     * Get conversation context as a truncated string
     * @param maxChars - Maximum characters to return (default 400)
     */
    protected getConversationContext(maxChars?: number): string;
    /**
     * Truncate citation excerpts to save tokens
     * @param citations - Array of citations
     * @param maxPerCitation - Maximum characters per excerpt (default 300)
     */
    protected getCitationExcerpts(citations: Citation[], maxPerCitation?: number): Citation[];
    /**
     * Format system profile as a string
     */
    protected getSystemProfileString(): string;
    protected emitToolUse(tool: string, input: string, status: 'running' | 'done', output?: string): Promise<void>;
    protected emitResult(summary: string): void;
    protected emitError(message: string): void;
    /**
     * Ask the user an interactive question with predefined options.
     * Returns a Promise that resolves with the user's answer.
     * The orchestrator will handle waiting for and routing the user's response.
     *
     * This is a convenience wrapper around askUserQuestions() for single questions.
     */
    protected askUserQuestion(question: string, options: string[], allowCustom?: boolean): Promise<string>;
    /**
     * Check if can spawn more subagents
     */
    canSpawnSubAgent(): boolean;
    /**
     * Get remaining subagent slots
     */
    getRemainingSubAgentSlots(): number;
    /**
     * Spawn a sub-agent. Emits a 'request:spawn' event that the orchestrator handles.
     * Returns a Promise that resolves with the sub-agent's result.
     *
     * Agents can only spawn sub-agents if depth < MAX_AGENT_DEPTH and max_sub_agents not reached.
     */
    protected spawnSubAgent(agentType: string, task: string, input: string, additionalData?: Record<string, unknown>): Promise<unknown>;
    /**
     * Track a spawned subagent
     * Called by the orchestrator after successfully spawning a subagent
     */
    trackSpawnedSubAgent(subAgent: BaseAgent): void;
    /**
     * Resolve a pending sub-agent request with the result.
     * Called by the orchestrator when the sub-agent completes.
     */
    resolveSubAgentRequest(requestId: string, result: unknown): void;
    /**
     * Reject a pending sub-agent request with an error.
     * Called by the orchestrator when the sub-agent fails.
     */
    rejectSubAgentRequest(requestId: string, error: Error): void;
    spawnEvent(): AgentEventType;
    protected startMetrics(): void;
    protected endMetrics(tokensUsed?: number): void;
    protected canExecute(): boolean;
    protected recordFailure(): void;
    protected recordSuccess(): void;
    protected executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T>;
    protected executeWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T>;
    healthCheck(): {
        healthy: boolean;
        status: AgentStatus;
        circuitBreakerOpen: boolean;
    };
    abstract run(input: string, additionalData?: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=base-agent.d.ts.map