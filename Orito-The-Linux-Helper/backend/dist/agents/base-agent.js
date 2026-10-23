import { v4 as uuid, v4 as uuidQuestion } from 'uuid';
import EventEmitter from 'eventemitter3';
import { loadAgentDefinition, renderPrompt } from './loader.js';
// Maximum depth for sub-agent spawning (0 = top-level, 1 = sub-agent, 2 = max)
export const MAX_AGENT_DEPTH = 2;
// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute
};
const DEFAULT_CONFIG = {
    timeout: 120000, // 2 minutes
    maxRetries: 2,
    retryDelayMs: 1000,
};
export const AGENT_COLORS = {
    research: '#14b8a6',
    planner: '#3b82f6',
    validator: '#f97316',
    synthesizer: '#8b5cf6',
    curious: '#eab308',
    custom: '#6b7280',
};
export class BaseAgent extends EventEmitter {
    id;
    name;
    agentType;
    color;
    task;
    parentAgentId;
    depth;
    // LLM-driven tool calling properties
    selectedModel;
    useToolCalling;
    context;
    definition;
    systemPrompt;
    toolResults = [];
    config;
    _status = 'spawning';
    _metrics = {};
    _toolStartTimes = new Map();
    circuitBreaker = {
        failures: 0,
        lastFailureTime: null,
        isOpen: false,
    };
    // Tool registry for LLM-driven tool calling
    toolRegistry = new Map();
    // Pending sub-agent result resolvers (requestId → resolve callback)
    pendingSubAgentRequests = new Map();
    // Track spawned subagents
    spawnedSubAgents = [];
    constructor(agentType, name, color, task, context, config, parentAgentId, depth, modelId) {
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
        this.selectedModel = modelId ?? 'nvidia/nemotron-3-nano-30b-a3b:free';
        this.useToolCalling = true;
        // Initialize tool registry
        this.initializeToolRegistry();
    }
    get status() {
        return this._status;
    }
    get metrics() {
        return this._metrics;
    }
    setStatus(status) {
        this._status = status;
        this.emitEvent({ type: 'agent:status', agentId: this.id, status, timestamp: new Date().toISOString() });
    }
    emitEvent(event) {
        this.emit('event', event);
    }
    /**
     * Initialize the tool registry with available tools.
     * Subclasses can override to register their specific tools.
     */
    initializeToolRegistry() {
        // Base implementation - subclasses will register tools
    }
    /**
     * Register a tool in the registry
     */
    registerTool(name, handler) {
        this.toolRegistry.set(name, handler);
    }
    /**
     * Get tool definitions for the LLM based on allowed tools from agent definition
     */
    getToolDefinitions() {
        if (!this.definition) {
            return [];
        }
        const { allowed } = this.definition.tools;
        if (!allowed || allowed.length === 0) {
            return [];
        }
        const definitions = [];
        for (const toolName of allowed) {
            const def = this.getToolDefinition(toolName);
            if (def) {
                definitions.push(def);
            }
        }
        return definitions;
    }
    /**
     * Get a tool definition by name
     */
    getToolDefinition(toolName) {
        const definitions = {
            web_search: {
                name: 'web_search',
                description: 'Search the web for Linux documentation, tutorials, and technical information',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The search query for finding Linux-related information',
                        },
                        max_results: {
                            type: 'number',
                            description: 'Maximum number of results to return (default: 10)',
                        },
                    },
                    required: ['query'],
                },
            },
            search_wikipedia: {
                name: 'search_wikipedia',
                description: 'Search Wikipedia for Linux concepts, commands, and technical terms',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The Wikipedia search query',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of results (default: 3)',
                        },
                    },
                    required: ['query'],
                },
            },
            calculate: {
                name: 'calculate',
                description: 'Perform mathematical calculations and unit conversions',
                parameters: {
                    type: 'object',
                    properties: {
                        expression: {
                            type: 'string',
                            description: 'The mathematical expression to evaluate (e.g., "1024 * 1024", "sqrt(16)")',
                        },
                    },
                    required: ['expression'],
                },
            },
            validate_command: {
                name: 'validate_command',
                description: 'Validate a Linux command for safety, syntax correctness, and system compatibility',
                parameters: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: 'The command to validate',
                        },
                    },
                    required: ['command'],
                },
            },
            lookup_manpage: {
                name: 'lookup_manpage',
                description: 'Look up man page information for a Linux command',
                parameters: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: 'The command to look up',
                        },
                        section: {
                            type: 'string',
                            description: 'Optional man page section (e.g., "1" for user commands)',
                        },
                    },
                    required: ['command'],
                },
            },
            search_packages: {
                name: 'search_packages',
                description: 'Search for packages in the system package manager repositories',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The package name or search term',
                        },
                    },
                    required: ['query'],
                },
            },
            read_file: {
                name: 'read_file',
                description: 'Read the contents of a file (for authorized paths only)',
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'The file path to read',
                        },
                    },
                    required: ['path'],
                },
            },
            grep_files: {
                name: 'grep_files',
                description: 'Search for patterns in files using grep',
                parameters: {
                    type: 'object',
                    properties: {
                        pattern: {
                            type: 'string',
                            description: 'The search pattern',
                        },
                        path: {
                            type: 'string',
                            description: 'The path to search in',
                        },
                    },
                    required: ['pattern', 'path'],
                },
            },
            ask_user: {
                name: 'ask_user',
                description: 'Ask the user a question to gather information or clarify requirements',
                parameters: {
                    type: 'object',
                    properties: {
                        question: {
                            type: 'string',
                            description: 'The question to ask the user',
                        },
                        options: {
                            type: 'array',
                            items: {
                                type: 'string',
                            },
                            description: 'Optional list of suggested answers (chips)',
                        },
                        allow_custom: {
                            type: 'boolean',
                            description: 'Whether to allow the user to type a custom answer (default: true)',
                        },
                    },
                    required: ['question'],
                },
            },
        };
        return definitions[toolName] || null;
    }
    /**
     * Execute a tool call with the given parameters
     */
    async executeToolCall(toolName, parameters) {
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
        }
        catch (error) {
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
     * Call LLM with tool calling support
     * This is the core method for LLM-driven tool calling
     */
    async callWithTools(messages, allowedTools, options = {}) {
        const maxToolCalls = options.maxToolCalls ?? 5;
        const toolCalls = [];
        // Dynamically import LLM client to avoid circular dependencies
        const { openRouterComplete } = await import('../llm/openrouter-client.js');
        // Get tool definitions for allowed tools
        const tools = allowedTools
            .map(name => this.getToolDefinition(name))
            .filter((def) => def !== null);
        let currentMessages = [...messages];
        let finalContent = '';
        let totalTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        for (let callCount = 0; callCount < maxToolCalls; callCount++) {
            const response = await openRouterComplete(currentMessages, {
                temperature: options.temperature ?? 0.7,
                maxTokens: options.maxTokens ?? 4000,
                modelId: this.selectedModel,
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
            let parameters;
            try {
                parameters = JSON.parse(paramsStr);
            }
            catch {
                // If parsing fails, treat the whole thing as a query parameter
                parameters = { query: paramsStr.trim() };
            }
            // Execute the tool
            const toolResult = await this.executeToolCall(toolName, parameters);
            toolCalls.push(toolResult);
            // Add the tool call and result to the conversation
            currentMessages.push({ role: 'assistant', content: content }, {
                role: 'user',
                content: `Tool result for ${toolName}: ${JSON.stringify(toolResult.result ?? { error: toolResult.error })}`,
            });
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
    async initialize() {
        this.definition = await loadAgentDefinition(this.agentType);
        this.systemPrompt = this.renderSystemPrompt();
    }
    /**
     * Render the system prompt with context variables
     * Subclasses can override to provide custom context
     */
    renderSystemPrompt() {
        if (!this.definition) {
            throw new Error('Agent definition not loaded. Call initialize() first.');
        }
        const context = {
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
    canUseTool(toolName) {
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
            if (pattern === '*')
                return true;
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
    async validateToolUse(toolName) {
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
    async askUserQuestions(questions) {
        const answers = {};
        // Ask questions sequentially
        for (const q of questions) {
            const questionId = uuidQuestion();
            // Emit the question event with rich options
            this.emitEvent({
                type: 'agent:question',
                agentId: this.id,
                questionId,
                question: q.question,
                options: q.options.map(opt => opt.label),
                allowCustom: false, // Rich questions use predefined options
                timestamp: new Date().toISOString(),
            });
            // Create a promise that will be resolved when the user answers
            const answer = await new Promise((resolve, reject) => {
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
    recordTokenUsage(tokens) {
        if (!this._metrics.tokensUsed) {
            this._metrics.tokensUsed = 0;
        }
        this._metrics.tokensUsed += tokens;
    }
    /**
     * Get conversation context as a truncated string
     * @param maxChars - Maximum characters to return (default 400)
     */
    getConversationContext(maxChars = 400) {
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
    getCitationExcerpts(citations, maxPerCitation = 300) {
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
    getSystemProfileString() {
        const profile = this.context.systemProfile;
        if (!profile) {
            return 'Unknown system';
        }
        const parts = [];
        if (profile.distro)
            parts.push(`${profile.distro} ${profile.distroVersion || ''}`);
        if (profile.kernel)
            parts.push(`Kernel: ${profile.kernel}`);
        if (profile.packageManager)
            parts.push(`PM: ${profile.packageManager}`);
        if (profile.shell)
            parts.push(`Shell: ${profile.shell}`);
        return parts.join(', ');
    }
    async emitToolUse(tool, input, status, output) {
        // Validate tool use before emitting
        if (status === 'running') {
            await this.validateToolUse(tool);
            // Store start time for this tool
            this._toolStartTimes.set(tool, Date.now());
        }
        let durationMs;
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
            tokensUsed: status === 'done' ? this._metrics.tokensUsed : undefined,
            durationMs,
            timestamp: new Date().toISOString(),
        });
    }
    emitResult(summary) {
        this.emitEvent({
            type: 'agent:result',
            agentId: this.id,
            summary,
            timestamp: new Date().toISOString(),
        });
    }
    emitError(message) {
        this.emitEvent({ type: 'error', message: `[${this.name}] ${message}`, timestamp: new Date().toISOString() });
    }
    /**
     * Ask the user an interactive question with predefined options.
     * Returns a Promise that resolves with the user's answer.
     * The orchestrator will handle waiting for and routing the user's response.
     *
     * This is a convenience wrapper around askUserQuestions() for single questions.
     */
    async askUserQuestion(question, options, allowCustom = true) {
        if (!allowCustom && options.length > 0) {
            // Use the rich question format for structured questions
            const richQuestion = {
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
        // Emit the question event
        this.emitEvent({
            type: 'agent:question',
            agentId: this.id,
            questionId,
            question,
            options,
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
    canSpawnSubAgent() {
        const maxAllowed = this.definition?.max_sub_agents || 0;
        const currentCount = this.spawnedSubAgents.length;
        return currentCount < maxAllowed && this.depth < MAX_AGENT_DEPTH;
    }
    /**
     * Get remaining subagent slots
     */
    getRemainingSubAgentSlots() {
        const maxAllowed = this.definition?.max_sub_agents || 0;
        return Math.max(0, maxAllowed - this.spawnedSubAgents.length);
    }
    /**
     * Spawn a sub-agent. Emits a 'request:spawn' event that the orchestrator handles.
     * Returns a Promise that resolves with the sub-agent's result.
     *
     * Agents can only spawn sub-agents if depth < MAX_AGENT_DEPTH and max_sub_agents not reached.
     */
    async spawnSubAgent(agentType, task, input, additionalData) {
        if (!this.canSpawnSubAgent()) {
            const error = `Cannot spawn subagent: limit reached (max: ${this.definition?.max_sub_agents || 0}, depth: ${this.depth}/${MAX_AGENT_DEPTH})`;
            this.emitError(error);
            return { success: false, error };
        }
        const requestId = uuid();
        return new Promise((resolve, reject) => {
            this.pendingSubAgentRequests.set(requestId, { resolve, reject });
            const request = {
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
    trackSpawnedSubAgent(subAgent) {
        this.spawnedSubAgents.push(subAgent);
    }
    /**
     * Resolve a pending sub-agent request with the result.
     * Called by the orchestrator when the sub-agent completes.
     */
    resolveSubAgentRequest(requestId, result) {
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
    rejectSubAgentRequest(requestId, error) {
        const pending = this.pendingSubAgentRequests.get(requestId);
        if (pending) {
            pending.reject(error);
            this.pendingSubAgentRequests.delete(requestId);
        }
    }
    spawnEvent() {
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
    startMetrics() {
        this._metrics = {
            startTime: new Date().toISOString(),
            tokensUsed: 0,
            toolCallsCount: 0,
        };
    }
    // End metrics tracking
    endMetrics(tokensUsed) {
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
    canExecute() {
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
    recordFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureTime = Date.now();
        if (this.circuitBreaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
            this.circuitBreaker.isOpen = true;
        }
    }
    // Circuit breaker: record success
    recordSuccess() {
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.isOpen = false;
    }
    // Execute with timeout
    async executeWithTimeout(fn, timeoutMs) {
        const timeout = timeoutMs ?? this.config.timeout ?? DEFAULT_CONFIG.timeout;
        return new Promise((resolve, reject) => {
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
    async executeWithRetry(fn, label) {
        const maxRetries = this.config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
        const retryDelay = this.config.retryDelayMs ?? DEFAULT_CONFIG.retryDelayMs;
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.executeWithTimeout(fn);
                this.recordSuccess();
                return result;
            }
            catch (error) {
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
    healthCheck() {
        return {
            healthy: this._status !== 'error' && !this.circuitBreaker.isOpen,
            status: this._status,
            circuitBreakerOpen: this.circuitBreaker.isOpen,
        };
    }
}
//# sourceMappingURL=base-agent.js.map