import { v4 as uuid, v4 as uuidQuestion } from 'uuid';
import EventEmitter from 'eventemitter3';
import type { AgentEventType, AgentStatus, AgentType, OrchestratorContext, AgentQuestion, Citation, UserConfiguration, UserAgentConfig } from '../types.js';
import type { AgentDefinition } from './loader.js';
import { loadAgentDefinition, renderPrompt } from './loader.js';
import { DEFAULT_MODEL } from '../config/models.js';
import { agentConfig } from '../config/tool-config.js';
import { toolSchemas } from '../tools/tool-schemas.js';
import type { UsageTrackingContext } from '../llm/openrouter-client.js';

// Maximum depth for sub-agent spawning (0 = top-level, 1 = sub-agent, 2 = max)
export const MAX_AGENT_DEPTH = 2;

// Agent input/output interfaces
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

// Tool definition for LLM-driven tool calling
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
                properties?: Record<string, {
                    type: string;
                    description: string;
                }>;
                required?: string[];
            };
        }>;
        required: string[];
    };
}

// Tool call result
export interface ToolCallResult {
    tool: string;
    parameters: Record<string, unknown>;
    result: unknown;
    error?: string;
}

// Sub-agent spawn request — emitted by agents, handled by orchestrator
export interface SubAgentRequest {
    requestId: string;
    parentAgentId: string;
    parentDepth: number;
    agentType: string;
    task: string;
    input: string;
    additionalData?: Record<string, unknown>;
    modelId?: string; // Pass model context to sub-agents
}

// Circuit breaker state
interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number | null;
    isOpen: boolean;
}

// Circuit breaker configuration - now uses centralized config
const CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: agentConfig.circuitBreaker.failureThreshold,
    resetTimeoutMs: agentConfig.circuitBreaker.resetTimeoutMs,
};

// Agent configuration
export interface AgentConfig {
    timeout?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}


const DEFAULT_CONFIG: AgentConfig = {
    timeout: agentConfig.agent.timeoutMs,
    maxRetries: agentConfig.agent.maxRetries,
    retryDelayMs: agentConfig.agent.retryDelayMs,
};

export const AGENT_COLORS: Record<string, string> = {
    research: '#14b8a6',
    planner: '#3b82f6',
    validator: '#f97316',
    synthesizer: '#8b5cf6',
    curious: '#eab308',
    custom: '#6b7280',
};

export abstract class BaseAgent extends EventEmitter {
    readonly id: string;
    readonly name: string;
    readonly agentType: AgentType;
    readonly color: string;
    readonly task: string;
    readonly parentAgentId?: string;
    readonly depth: number;

    // LLM-driven tool calling properties
    protected selectedModel: string;
    protected useToolCalling: boolean;

    protected context: OrchestratorContext;
    protected definition!: AgentDefinition;
    protected systemPrompt!: string;
    protected toolResults: AgentToolResult[] = [];
    protected config: AgentConfig;
    private _status: AgentStatus = 'spawning';
    private _metrics: Partial<AgentMetrics> = {};
    private _toolStartTimes: Map<string, number> = new Map();
    private circuitBreaker: CircuitBreakerState = {
        failures: 0,
        lastFailureTime: null,
        isOpen: false,
    };

    // Tool registry for LLM-driven tool calling
    protected toolRegistry: Map<string, (params: Record<string, unknown>) => Promise<unknown>> = new Map();

    // Pending sub-agent result resolvers (requestId → resolve callback)
    private pendingSubAgentRequests: Map<string, { resolve: (result: unknown) => void; reject: (err: Error) => void }> = new Map();

    // Track spawned subagents
    spawnedSubAgents: BaseAgent[] = []

    constructor(
        agentType: AgentType,
        name: string,
        color: string,
        task: string,
        context: OrchestratorContext,
        config?: AgentConfig,
        parentAgentId?: string,
        depth?: number,
        modelId?: string
    ) {
        super();
        this.id = uuid();
        this.agentType = agentType;
        this.name = name;
        this.color = color;
        this.task = task;
        this.context = context;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.parentAgentId = parentAgentId;
        this.depth = depth ?? 0;
        this.selectedModel = modelId ?? DEFAULT_MODEL;
        this.useToolCalling = true;

        // Initialize tool registry
        this.initializeToolRegistry();
    }

    get status(): AgentStatus {
        return this._status;
    }

    get metrics(): AgentMetrics | undefined {
        return this._metrics as AgentMetrics | undefined;
    }

    protected setStatus(status: AgentStatus): void {
        this._status = status;
        this.emitEvent({ type: 'agent:status', agentId: this.id, status, timestamp: new Date().toISOString() });
    }

    protected emitEvent(event: AgentEventType): void {
        this.emit('event', event);
    }

    /**
     * Get the user configuration from the orchestrator context
     * Returns undefined if no user configuration is available
     */
    protected getUserConfig(): UserConfiguration | undefined {
        return this.context.userConfig;
    }

    /**
     * Get configuration for a specific agent type
     * Returns default config if no user configuration is available
     */
    protected getAgentConfig(agentType: string): UserAgentConfig {
        const defaultConfig: UserAgentConfig = { enabled: true, priority: 0, settings: {} };
        const userConfig = this.getUserConfig();
        
        if (!userConfig || !userConfig.agents) {
            return defaultConfig;
        }
        
        return userConfig.agents[agentType] || defaultConfig;
    }

    /**
     * Get the model configuration from user preferences
     * Returns default values if no user configuration is available
     */
    protected getModelConfig(): { preferred: string; fallback: string; temperature: number; maxTokens: number } {
        const userConfig = this.getUserConfig();
        
        if (!userConfig || !userConfig.model) {
            return {
                preferred: this.selectedModel || DEFAULT_MODEL,
                fallback: '',
                temperature: 0.7,
                maxTokens: 4096,
            };
        }
        
        return {
            preferred: userConfig.model.preferred || this.selectedModel || DEFAULT_MODEL,
            fallback: userConfig.model.fallback || '',
            temperature: userConfig.model.temperature ?? 0.7,
            maxTokens: userConfig.model.maxTokens ?? 4096,
        };
    }

    /**
     * Get the behavior configuration from user preferences
     * Returns default values if no user configuration is available
     */
    protected getBehaviorConfig(): { responseStyle: string; streamResponses: boolean; showAgentCards: boolean; autoExecuteCommands: boolean } {
        const userConfig = this.getUserConfig();
        
        if (!userConfig || !userConfig.behavior) {
            return {
                responseStyle: 'balanced',
                streamResponses: true,
                showAgentCards: true,
                autoExecuteCommands: false,
            };
        }
        
        return {
            responseStyle: userConfig.behavior.responseStyle || 'balanced',
            streamResponses: userConfig.behavior.streamResponses ?? true,
            showAgentCards: userConfig.behavior.showAgentCards ?? true,
            autoExecuteCommands: userConfig.behavior.autoExecuteCommands ?? false,
        };
    }

    /**
     * Get the system configuration from user preferences
     * Returns default values if no user configuration is available
     */
    protected getSystemConfig(): { defaultShell: string; packageManager: string; editor: string } {
        const userConfig = this.getUserConfig();
        
        if (!userConfig || !userConfig.system) {
            return {
                defaultShell: 'bash',
                packageManager: 'apt',
                editor: 'nano',
            };
        }
        
        return {
            defaultShell: userConfig.system.defaultShell || 'bash',
            packageManager: userConfig.system.packageManager || 'apt',
            editor: userConfig.system.editor || 'nano',
        };
    }

    /**
     * Check if this agent is enabled in user configuration
     */
    protected isAgentEnabled(): boolean {
        const agentConfig = this.getAgentConfig(this.agentType);
        return agentConfig.enabled;
    }

    /**
     * Get agent-specific setting value
     */
    protected getAgentSetting(key: string, defaultValue?: any): any {
        const agentConfig = this.getAgentConfig(this.agentType);
        return agentConfig.settings?.[key] ?? defaultValue;
    }

    /**
     * Initialize the tool registry with available tools.
     * Subclasses can override to register their specific tools.
     */
    protected initializeToolRegistry(): void {
        // Register ask_user tool (legacy format)
        this.registerTool('ask_user', async (params) => {
            const question = params.question as string;
            const options = (params.options as string[]) || [];
            const allowCustom = params.allow_custom !== false; // Default to true

            const answer = await this.askUserQuestion(question, options, allowCustom);
            return { answer };
        });

        // Register asQuestion tool (new rich format)
        this.registerTool('asQuestion', async (params) => {
            const question = params.question as string;
            const header = (params.header as string) || question.substring(0, 30);
            const purpose = params.purpose as string | undefined;
            const options = (params.options as Array<{ label: string; description?: string }>) || [];
            const multiple = (params.multiple as boolean) || false;
            const allowCustom = params.allowCustom !== false; // Default to true

            // Use the rich question format
            const richQuestion: AgentQuestion = {
                question,
                header,
                purpose,
                options,
                multiple,
                allowCustom,
            };

            const answers = await this.askUserQuestions([richQuestion]);
            const answer = answers[question];
            
            // Return the answer(s)
            if (multiple && Array.isArray(answer)) {
                return { answers: answer };
            }
            return { answer: Array.isArray(answer) ? answer[0] : answer };
        });
    }

    /**
     * Register a tool in the registry
     */
    protected registerTool(
        name: string,
        handler: (params: Record<string, unknown>) => Promise<unknown>
    ): void {
        this.toolRegistry.set(name, handler);
    }

    /**
     * Get tool definitions for the LLM based on allowed tools from agent definition
     */
    protected getToolDefinitions(): ToolDefinition[] {
        if (!this.definition) {
            return [];
        }

        const { allowed } = this.definition.tools;
        if (!allowed || allowed.length === 0) {
            return [];
        }

        const definitions: ToolDefinition[] = [];

        for (const toolName of allowed) {
            const def = this.getToolDefinition(toolName);
            if (def) {
                definitions.push(def);
            }
        }

        return definitions;
    }

    /**
     * Get a tool definition by name - uses centralized tool-schemas.ts
     */
    private getToolDefinition(toolName: string): ToolDefinition | null {
        const schema = toolSchemas[toolName];
        if (!schema) {
            return null;
        }

        // Convert ToolSchema to ToolDefinition format with proper type casting
        return {
            name: schema.function.name,
            description: schema.function.description,
            parameters: {
                type: schema.function.parameters.type,
                properties: schema.function.parameters.properties as Record<string, {
                    type: string;
                    description: string;
                    enum?: string[];
                    items?: {
                        type: string;
                        properties?: Record<string, { type: string; description: string; }>;
                        required?: string[];
                    };
                }>,
                required: schema.function.parameters.required,
            },
        };
    }

    /**
     * Execute a tool call with the given parameters
     */
    protected async executeToolCall(
        toolName: string,
        parameters: Record<string, unknown>
    ): Promise<ToolCallResult> {
        // Validate tool is allowed
        await this.validateToolUse(toolName);

        // Check if tool is registered
        const handler = this.toolRegistry.get(toolName);
        if (!handler) {
            return {
                tool: toolName,
                parameters,
                result: null,
                error: `Tool "${toolName}" is not registered`,
            };
        }

        this.emitToolUse(toolName, JSON.stringify(parameters), 'running');

        try {
            const result = await handler(parameters);
            this.emitToolUse(toolName, JSON.stringify(parameters), 'done', JSON.stringify(result).slice(0, 200));
            return {
                tool: toolName,
                parameters,
                result,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.emitToolUse(toolName, JSON.stringify(parameters), 'done', `Error: ${errorMsg}`);
            return {
                tool: toolName,
                parameters,
                result: null,
                error: errorMsg,
            };
        }
    }

    /**
     * Get usage tracking context for LLM calls
     */
    protected getUsageTrackingContext(): UsageTrackingContext | undefined {
        if (!this.context.userId) {
            return undefined;
        }
        
        return {
            userId: this.context.userId,
            sessionId: this.context.sessionId,
            agentType: this.agentType,
            apiKeyType: this.context.apiKey ? 'user' : 'system',
        };
    }

    /**
     * Call LLM with tool calling support
     * This is the core method for LLM-driven tool calling
     */
    protected async callWithTools(
        messages: Array<{ role: string; content: string }>,
        allowedTools: string[],
        options: {
            temperature?: number;
            maxTokens?: number;
            maxToolCalls?: number;
        } = {}
    ): Promise<{
        content: string;
        toolCalls: ToolCallResult[];
        usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    }> {
        const maxToolCalls = options.maxToolCalls ?? 5;
        const toolCalls: ToolCallResult[] = [];

        // Dynamically import LLM client to avoid circular dependencies
        const { openRouterComplete } = await import('../llm/openrouter-client.js');

        // Get tool definitions for allowed tools
        const tools: ToolDefinition[] = allowedTools
            .map(name => this.getToolDefinition(name))
            .filter((def): def is ToolDefinition => def !== null);

        let currentMessages = [...messages];
        let finalContent = '';
        let totalTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        
        // Get usage tracking context
        const usageTracking = this.getUsageTrackingContext();

        for (let callCount = 0; callCount < maxToolCalls; callCount++) {
            const response = await openRouterComplete(currentMessages, {
                temperature: options.temperature ?? 0.7,
                maxTokens: options.maxTokens ?? 4000,
                modelId: this.selectedModel,
                apiKey: this.context.apiKey,
                usageTracking,
            });

            if (response.usage) {
                totalTokens.promptTokens += response.usage.promptTokens;
                totalTokens.completionTokens += response.usage.completionTokens;
                totalTokens.totalTokens += response.usage.totalTokens;
            }

            const content = response.content;

            // Check if response contains a tool call (using a simple JSON-based format)
            const toolCallMatch = content.match(/<tool>(\w+)<\/tool>\s*<params>([\s\S]*?)<\/params>/);

            if (!toolCallMatch) {
                // No tool call, we have the final response
                finalContent = content;
                break;
            }

            // Extract tool call
            const toolName = toolCallMatch[1];
            const paramsStr = toolCallMatch[2];

            let parameters: Record<string, unknown>;
            try {
                parameters = JSON.parse(paramsStr);
            } catch {
                // If parsing fails, treat the whole thing as a query parameter
                parameters = { query: paramsStr.trim() };
            }

            // Execute the tool
            const toolResult = await this.executeToolCall(toolName, parameters);
            toolCalls.push(toolResult);

            // Add the tool call and result to the conversation
            currentMessages.push(
                { role: 'assistant', content: content },
                {
                    role: 'user',
                    content: `Tool result for ${toolName}: ${JSON.stringify(toolResult.result ?? { error: toolResult.error })}`,
                }
            );

            // Continue the loop for the LLM to process the tool result
        }

        return {
            content: finalContent,
            toolCalls,
            usage: totalTokens,
        };
    }

    /**
     * Load agent definition from markdown file
     * Should be called by subclasses during initialization
     */
    public async initialize(): Promise<void> {
        this.definition = await loadAgentDefinition(this.agentType);
        this.systemPrompt = this.renderSystemPrompt();
    }

    /**
     * Render the system prompt with context variables
     * Subclasses can override to provide custom context
     */
    protected renderSystemPrompt(): string {
        if (!this.definition) {
            throw new Error('Agent definition not loaded. Call initialize() first.');
        }

        const context: Record<string, string> = {
            task: this.task,
            tier: this.context.tier,
            agentName: this.name,
            agentType: this.agentType,
        };

        // Add system profile if available
        if (this.context.systemProfile) {
            context.systemProfile = this.getSystemProfileString();
        }

        // Add conversation context if history exists
        if (this.context.messageHistory.length > 0) {
            context.conversationContext = this.getConversationContext();
        }

        return renderPrompt(this.definition.systemPrompt, context);
    }

    /**
     * Check if a tool is allowed based on agent definition
     */
    protected canUseTool(toolName: string): boolean {
        if (!this.definition) {
            return false;
        }

        const { allowed, restricted } = this.definition.tools;

        // Check if tool is explicitly restricted
        if (restricted && restricted.includes(toolName)) {
            return false;
        }

        // If no allowed list, allow all tools not explicitly restricted
        if (!allowed || allowed.length === 0) {
            return true;
        }

        // Check if tool is in allowed list (supports wildcards)
        return allowed.some(pattern => {
            if (pattern === '*') return true;
            if (pattern.endsWith('*')) {
                const prefix = pattern.slice(0, -1);
                return toolName.startsWith(prefix);
            }
            return pattern === toolName;
        });
    }

    /**
     * Validate tool use before execution
     * Throws error if tool is not allowed
     */
    protected async validateToolUse(toolName: string): Promise<void> {
        if (!this.canUseTool(toolName)) {
            const error = `Tool "${toolName}" is not allowed for agent type "${this.agentType}"`;
            this.emitError(error);
            throw new Error(error);
        }
    }

    /**
     * Ask the user multiple questions with rich options
     * Returns a Promise that resolves with all answers
     */
    protected async askUserQuestions(
        questions: AgentQuestion[]
    ): Promise<Record<string, string | string[]>> {
        const answers: Record<string, string | string[]> = {};

        // Ask questions sequentially
        for (const q of questions) {
            const questionId = uuidQuestion();

            // Emit the question event with rich options
            this.emitEvent({
                type: 'agent:question',
                agentId: this.id,
                questionId,
                question: q.question,
                header: q.header,
                purpose: q.purpose,
                options: q.options,
                multiple: q.multiple,
                allowCustom: q.allowCustom ?? true,
                timestamp: new Date().toISOString(),
            });

            // Create a promise that will be resolved when the user answers
            const answer = await new Promise<string | string[]>((resolve, reject) => {
                // Store the resolver so the orchestrator can call it
                this.emit('request:answer', { questionId, resolve, reject });

                // Timeout after 2 minutes
                setTimeout(() => {
                    reject(new Error('Question timed out - user did not respond'));
                }, this.config.timeout ?? 120000);
            });

            answers[q.question] = answer;
        }

        return answers;
    }

    /**
     * Record token usage in metrics
     */
    protected recordTokenUsage(tokens: number): void {
        if (!this._metrics.tokensUsed) {
            this._metrics.tokensUsed = 0;
        }
        this._metrics.tokensUsed += tokens;
    }

    /**
     * Get conversation context as a truncated string
     * @param maxChars - Maximum characters to return (default 400)
     */
    protected getConversationContext(maxChars: number = 400): string {
        const messages = this.context.messageHistory
            .slice(-3) // Last 3 messages
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n');

        if (messages.length <= maxChars) {
            return messages;
        }

        return messages.slice(0, maxChars) + '...';
    }

    /**
     * Truncate citation excerpts to save tokens
     * @param citations - Array of citations
     * @param maxPerCitation - Maximum characters per excerpt (default 300)
     */
    protected getCitationExcerpts(citations: Citation[], maxPerCitation: number = 300): Citation[] {
        return citations.map(citation => ({
            ...citation,
            excerpt: citation.excerpt.length > maxPerCitation
                ? citation.excerpt.slice(0, maxPerCitation) + '...'
                : citation.excerpt,
        }));
    }

    /**
     * Format system profile as a string
     */
    protected getSystemProfileString(): string {
        const profile = this.context.systemProfile;
        if (!profile) {
            return 'Unknown system';
        }

        const parts: string[] = [];
        if (profile.distro) parts.push(`${profile.distro} ${profile.distroVersion || ''}`);
        if (profile.kernel) parts.push(`Kernel: ${profile.kernel}`);
        if (profile.packageManager) parts.push(`PM: ${profile.packageManager}`);
        if (profile.shell) parts.push(`Shell: ${profile.shell}`);

        return parts.join(', ');
    }

    protected async emitToolUse(tool: string, input: string, status: 'running' | 'done', output?: string): Promise<void> {
        // Validate tool use before emitting
        if (status === 'running') {
            await this.validateToolUse(tool);
            // Store start time for this tool
            this._toolStartTimes.set(tool, Date.now());
        }

        let durationMs: number | undefined;
        if (status === 'done') {
            const startTime = this._toolStartTimes.get(tool);
            if (startTime) {
                durationMs = Date.now() - startTime;
                this._toolStartTimes.delete(tool);
            }
        }

        this.emitEvent({
            type: 'agent:tool',
            agentId: this.id,
            tool,
            input,
            status,
            output,
            tokensUsed: status === 'done' ? this._metrics.tokensUsed as number : undefined,
            durationMs,
            timestamp: new Date().toISOString(),
        });
    }

    protected emitResult(summary: string): void {
        this.emitEvent({
            type: 'agent:result',
            agentId: this.id,
            summary,
            timestamp: new Date().toISOString(),
        });
    }

    protected emitError(message: string): void {
        this.emitEvent({ type: 'error', message: `[${this.name}] ${message}`, timestamp: new Date().toISOString() });
    }

    /**
     * Ask the user an interactive question with predefined options.
     * Returns a Promise that resolves with the user's answer.
     * The orchestrator will handle waiting for and routing the user's response.
     * 
     * This is a convenience wrapper around askUserQuestions() for single questions.
     */
    protected async askUserQuestion(
        question: string,
        options: string[],
        allowCustom: boolean = true
    ): Promise<string> {
        if (!allowCustom && options.length > 0) {
            // Use the rich question format for structured questions
            const richQuestion: AgentQuestion = {
                question,
                header: question,
                options: options.map(opt => ({ label: opt, description: '' })),
                multiple: false,
                allowCustom // Pass through allowCustom
            };

            const answers = await this.askUserQuestions([richQuestion]);
            const answer = answers[question];
            return Array.isArray(answer) ? answer[0] : answer;
        }

        // Legacy format for custom answers
        const questionId = uuidQuestion();

        // Emit the question event with rich options format
        this.emitEvent({
            type: 'agent:question',
            agentId: this.id,
            questionId,
            question,
            options: options.map(opt => ({ label: opt })),
            allowCustom,
            timestamp: new Date().toISOString(),
        });

        // Create a promise that will be resolved when the user answers
        return new Promise((resolve, reject) => {
            // Store the resolver so the orchestrator can call it
            this.emit('request:answer', { questionId, resolve, reject });

            // Timeout after 2 minutes
            setTimeout(() => {
                reject(new Error('Question timed out - user did not respond'));
            }, this.config.timeout ?? 120000);
        });
    }

    /**
     * Check if can spawn more subagents
     */
    canSpawnSubAgent(): boolean {
        const maxAllowed = (this.definition?.max_sub_agents as number) || 0;
        const currentCount = this.spawnedSubAgents.length;
        return currentCount < maxAllowed && this.depth < MAX_AGENT_DEPTH;
    }

    /**
     * Get remaining subagent slots
     */
    getRemainingSubAgentSlots(): number {
        const maxAllowed = (this.definition?.max_sub_agents as number) || 0;
        return Math.max(0, maxAllowed - this.spawnedSubAgents.length);
    }

    /**
     * Spawn a sub-agent. Emits a 'request:spawn' event that the orchestrator handles.
     * Returns a Promise that resolves with the sub-agent's result.
     * 
     * Agents can only spawn sub-agents if depth < MAX_AGENT_DEPTH and max_sub_agents not reached.
     */
    protected async spawnSubAgent(
        agentType: string,
        task: string,
        input: string,
        additionalData?: Record<string, unknown>
    ): Promise<unknown> {
        if (!this.canSpawnSubAgent()) {
            const error = `Cannot spawn subagent: limit reached (max: ${(this.definition?.max_sub_agents as number) || 0}, depth: ${this.depth}/${MAX_AGENT_DEPTH})`;
            this.emitError(error);
            return { success: false, error };
        }

        const requestId = uuid();

        return new Promise((resolve, reject) => {
            this.pendingSubAgentRequests.set(requestId, { resolve, reject });

            const request: SubAgentRequest = {
                requestId,
                parentAgentId: this.id,
                parentDepth: this.depth,
                agentType,
                task,
                input,
                additionalData,
                modelId: this.selectedModel, // Pass model context to sub-agent
            };

            this.emit('request:spawn', request);

            // Timeout after 2 minutes
            setTimeout(() => {
                if (this.pendingSubAgentRequests.has(requestId)) {
                    this.pendingSubAgentRequests.delete(requestId);
                    reject(new Error(`Sub-agent spawn request timed out: ${agentType}`));
                }
            }, this.config.timeout ?? 120000);
        });
    }

    /**
     * Track a spawned subagent
     * Called by the orchestrator after successfully spawning a subagent
     */
    trackSpawnedSubAgent(subAgent: BaseAgent): void {
        this.spawnedSubAgents.push(subAgent);
    }

    /**
     * Resolve a pending sub-agent request with the result.
     * Called by the orchestrator when the sub-agent completes.
     */
    resolveSubAgentRequest(requestId: string, result: unknown): void {
        const pending = this.pendingSubAgentRequests.get(requestId);
        if (pending) {
            pending.resolve(result);
            this.pendingSubAgentRequests.delete(requestId);
        }
    }

    /**
     * Reject a pending sub-agent request with an error.
     * Called by the orchestrator when the sub-agent fails.
     */
    rejectSubAgentRequest(requestId: string, error: Error): void {
        const pending = this.pendingSubAgentRequests.get(requestId);
        if (pending) {
            pending.reject(error);
            this.pendingSubAgentRequests.delete(requestId);
        }
    }

    spawnEvent(): AgentEventType {
        return {
            type: 'agent:spawn',
            agentId: this.id,
            name: this.name,
            agentType: this.agentType,
            color: AGENT_COLORS[this.agentType] || AGENT_COLORS.custom,
            task: this.task,
            parentAgentId: this.parentAgentId,
            depth: this.depth,
            timestamp: new Date().toISOString(),
        };
    }

    // Start metrics tracking
    protected startMetrics(): void {
        this._metrics = {
            startTime: new Date().toISOString(),
            tokensUsed: 0,
            toolCallsCount: 0,
        };
    }

    // End metrics tracking
    protected endMetrics(tokensUsed?: number): void {
        const startTime = this._metrics.startTime ? new Date(this._metrics.startTime).getTime() : Date.now();
        this._metrics = {
            ...this._metrics,
            endTime: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            tokensUsed,
            toolCallsCount: this.toolResults.length,
        };
    }

    // Circuit breaker: check if agent can execute
    protected canExecute(): boolean {
        if (!this.circuitBreaker.isOpen) {
            return true;
        }

        // Check if reset timeout has passed
        if (this.circuitBreaker.lastFailureTime) {
            const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
            if (timeSinceFailure >= CIRCUIT_BREAKER_CONFIG.resetTimeoutMs) {
                // Reset circuit breaker
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failures = 0;
                return true;
            }
        }

        return false;
    }

    // Circuit breaker: record failure
    protected recordFailure(): void {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureTime = Date.now();

        if (this.circuitBreaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
            this.circuitBreaker.isOpen = true;
        }
    }

    // Circuit breaker: record success
    protected recordSuccess(): void {
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.isOpen = false;
    }

    // Execute with timeout
    protected async executeWithTimeout<T>(
        fn: () => Promise<T>,
        timeoutMs?: number
    ): Promise<T> {
        const timeout = timeoutMs ?? this.config.timeout ?? DEFAULT_CONFIG.timeout!;

        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Agent ${this.name} timed out after ${timeout}ms`));
            }, timeout);

            fn()
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    // Execute with retry logic
    protected async executeWithRetry<T>(
        fn: () => Promise<T>,
        label: string
    ): Promise<T> {
        const maxRetries = this.config.maxRetries ?? DEFAULT_CONFIG.maxRetries!;
        const retryDelay = this.config.retryDelayMs ?? DEFAULT_CONFIG.retryDelayMs!;

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.executeWithTimeout(fn);
                this.recordSuccess();
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < maxRetries) {
                    this.emitError(`${label} attempt ${attempt + 1} failed: ${lastError.message}. Retrying...`);
                    await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
                }
            }
        }

        this.recordFailure();
        throw lastError;
    }

    // Health check for the agent
    healthCheck(): { healthy: boolean; status: AgentStatus; circuitBreakerOpen: boolean } {
        return {
            healthy: this._status !== 'error' && !this.circuitBreaker.isOpen,
            status: this._status,
            circuitBreakerOpen: this.circuitBreaker.isOpen,
        };
    }

    // Abstract run method - must be implemented by subclasses
    abstract run(input: string, additionalData?: Record<string, unknown>): Promise<unknown>;
}
