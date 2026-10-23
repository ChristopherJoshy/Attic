import EventEmitter from 'eventemitter3';
import { v4 as uuid } from 'uuid';
import { openRouterComplete, getLinuxSystemPrompt } from '../llm/openrouter-client.js';
import { BaseAgent, type SubAgentRequest } from './base-agent.js';
import { AuditLog } from '../models/audit-log.js';
import { UserPreferences } from '../models/user-preferences.js';
import { getDateContext } from '../tools/date-tool.js';
import type { AgentEventType, IntentType, ComplexityLevel, OrchestratorContext, CommandProposal, Citation, SystemProfile, ResearchStrategy, ResearchOutput, PlannerOutput, ValidatorOutput, SynthesizerOutput, UserConfiguration } from '../types.js';
import { ensureSystemProfile, collectSystemProfile, convertToLegacyProfile, type SystemProfileData } from './system-profile.js';
import { Chat } from '../models/chat.js';
import { selectModel, type TaskContext, getNextFallback } from '../llm/model-selector.js';
import { SUPPORTED_MODELS, DEFAULT_MODEL } from '../config/models.js';
import { agentConfig } from '../config/tool-config.js';

// Query classification result — determines which agents get spawned
interface QueryClassification {
    intent: IntentType;
    complexity: ComplexityLevel;
}
import { TIER_LIMITS } from '../config/index.js';

// Agent registry — maps agent types to their module paths and class names
// Agents are loaded dynamically only when the orchestrator decides to spawn them
const AGENT_REGISTRY: Record<string, { modulePath: string; className: string }> = {
    research: { modulePath: './research-agent.js', className: 'ResearchAgent' },
    planner: { modulePath: './planner-agent.js', className: 'PlannerAgent' },
    validator: { modulePath: './validator-agent.js', className: 'ValidatorAgent' },
    synthesizer: { modulePath: './synthesizer-agent.js', className: 'SynthesizerAgent' },
    curious: { modulePath: './curious-agent.js', className: 'CuriousAgent' },
};

// Cache for dynamically imported agent modules
const agentModuleCache = new Map<string, Record<string, any>>();

// ─── Regex-based fast classifier patterns ───

// True greetings / chitchat / thanks — only these go to "simple"
const GREETING_PATTERNS = [
    /^(hi|hello|hey|yo|sup|howdy|hola|greetings|good\s*(morning|afternoon|evening|night|day))[\s!?.,:]*$/i,
    /^(thanks?|thank\s*you|thx|ty|cheers|appreciated|cool|ok|okay|got\s*it|understood|nice|great|awesome)[\s!?.,:]*$/i,
    /^(bye|goodbye|good\s*bye|see\s*ya|later|cya|farewell|take\s*care)[\s!?.,:]*$/i,
    /^(how\s*are\s*you|what'?s?\s*up|who\s*are\s*you|what\s*is\s*your\s*name|what\s*can\s*you\s*do)[\s!?.]*$/i,
];

// Non-Linux topics — these get a polite decline
const NON_LINUX_PATTERNS = [
    // Cooking, recipes, food
    /\b(recipe|cooking|bake|ingredient|cuisine|dessert|appetizer)\b/i,
    // Creative writing
    /\b(write\s*(me\s*)?(a\s*)?(poem|story|essay|song|haiku|limerick|joke|riddle))\b/i,
    // General trivia / homework unrelated to computing
    /\b(capital\s*of|president\s*of|who\s*(invented|discovered|painted|wrote|composed))\b/i,
    // Sports, entertainment
    /\b(score\s*of|who\s*won|playoff|championship|movie\s*review|tv\s*show|celebrity|actress|actor)\b/i,
    // Health / medical (not system health)
    /\b(symptoms?\s*of|medical\s*advice|disease|medication|doctor|diagnosis)\b/i,
    // Windows/macOS-specific (without Linux context)
    /\b(windows\s*(registry|defender|update|activation|key)|powershell\s*(cmdlet|module)|\.exe\b|regedit|cmd\.exe)\b/i,
    /\b(macos|mac\s*os|finder|spotlight|homebrew\s*(cask|tap)|xcode|swift\s*programming)\b/i,
    // Math homework / generic math
    /^(what\s*is\s*\d+\s*[\+\-\*\/]\s*\d+|solve|factor|integrate|derive|limit\s*of)\b/i,
    // Relationship advice, philosophy
    /\b(relationship\s*advice|meaning\s*of\s*life|philosophy|astrology|horoscope)\b/i,
];

// System action keywords → complex pipeline
const ACTION_PATTERNS = [
    /\b(install|uninstall|remove|purge|upgrade|update|downgrade)\b/i,
    /\b(configure|setup|set\s*up|enable|disable|start|stop|restart|reload)\b/i,
    /\b(fix|repair|troubleshoot|debug|resolve|diagnose)\b/i,
    /\b(mount|unmount|format|partition|resize|encrypt)\b/i,
    /\b(compile|build|make|cmake|gcc|g\+\+)\b/i,
    /\b(firewall|iptables|nftables|ufw|firewalld)\b/i,
    /\b(cron|crontab|systemctl|journalctl|service)\b/i,
    /\b(chmod|chown|chgrp|setfacl|getfacl)\b/i,
    /\b(apt|dnf|yum|pacman|zypper|emerge|nix|snap|flatpak|brew)\s/i,
    /\b(docker|podman|lxc|lxd|kubectl|k3s|k8s|kubernetes)\b/i,
    /\b(nginx|apache|httpd|caddy|haproxy|traefik)\b/i,
    /\b(grub|bootloader|initramfs|dracut|mkinitcpio)\b/i,
    /\b(selinux|apparmor|seccomp|firejail|sandbox)\b/i,
    /\b(lvm|raid|mdadm|zfs|btrfs|luks|dm-crypt)\b/i,
    /\b(ssh|sshd|rsync|scp|sftp|vpn|wireguard|openvpn)\b/i,
    /\b(backup|restore|snapshot|rollback|clone)\b/i,
];

// Coding patterns for model selection
const CODING_PATTERNS = [
    /\b(code|program|script|function|method|class|api)\b/i,
    /\b(bug|error|exception|debug|fix|refactor)\b/i,
    /\b(implement|write|create|develop)\s+(a|an)?\s*(code|script|function|program)\b/i,
    /\b(python|javascript|typescript|java|go|rust|c\+\+|bash|shell)\s/i,
    /\b(git|github|commit|pull\s+request|merge)\b/i,
];

// Orchestrator error types
export class OrchestratorError extends Error {
    public readonly phase: string;
    public readonly recoverable: boolean;
    public readonly originalError?: Error;

    constructor(message: string, phase: string, recoverable: boolean = false, originalError?: Error) {
        super(message);
        this.name = 'OrchestratorError';
        this.phase = phase;
        this.recoverable = recoverable;
        this.originalError = originalError;
    }
}

// Agent execution result with error handling
interface AgentExecutionResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    fallback?: boolean;
}

// Orchestrator configuration - uses centralized config
interface OrchestratorConfig {
    maxRetries: number;
    retryDelayMs: number;
    agentTimeoutMs: number;
    enableGracefulDegradation: boolean;
    enableModelSelection: boolean;
    defaultModel: string;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
    maxRetries: agentConfig.orchestrator.maxRetries,
    retryDelayMs: agentConfig.orchestrator.retryDelayMs,
    agentTimeoutMs: agentConfig.orchestrator.agentTimeoutMs,
    enableGracefulDegradation: agentConfig.orchestrator.enableGracefulDegradation,
    enableModelSelection: agentConfig.orchestrator.enableModelSelection,
    defaultModel: DEFAULT_MODEL,
};

export class Orchestrator extends EventEmitter {
    private context: OrchestratorContext;
    private activeAgents: Map<string, BaseAgent> = new Map();
    private config: OrchestratorConfig;
    private executionLog: Array<{ agent: string; status: 'started' | 'completed' | 'failed'; timestamp: string; error?: string }> = [];
    // Pending user-answer promises: questionId → resolve callback
    private pendingQuestions: Map<string, (answer: string) => void> = new Map();
    // Cached user preferences for this session (legacy format)
    private userPreferences: {
        defaultDistro: string;
        defaultShell: string;
        fontSize: number;
        responseStyle: string;
        customInstructions?: string;
    } | null = null;
    // Full user configuration (new format)
    private userConfig: UserConfiguration | null = null;
    // Pending query that was deferred because system discovery was needed
    private pendingQuery: string | null = null;
    // System profile data from question-based collection
    private systemProfileData: SystemProfileData | null = null;
    // Flag to track if profile check is in progress
    private profileCheckInProgress: boolean = false;
    // Token tracking
    private totalTokens: number = 0;
    private agentTokens: Map<string, { agentId: string; agentType: string; tokensUsed: number }> = new Map();
    // Track attempted models for fallback
    private attemptedModels: Set<string> = new Set();

    constructor(context: OrchestratorContext, config?: Partial<OrchestratorConfig>) {
        super();
        this.context = context;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Private logger helper
    private log(level: 'info' | 'debug' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
        const logData = { component: 'orchestrator', ...data };
        if (this.context.logger) {
            this.context.logger[level](logData, message);
        } else {
            // Fallback to console for backwards compatibility
            console.log(`[orchestrator] ${level.toUpperCase()}: ${message}`, data || '');
        }
    }

    // Dynamically load and instantiate an agent by type
    private async createAgent(
        agentType: string,
        task: string,
        parentAgentId?: string,
        depth?: number
    ): Promise<BaseAgent> {
        const entry = AGENT_REGISTRY[agentType];
        if (!entry) {
            throw new OrchestratorError(`Unknown agent type: ${agentType}`, 'createAgent', false);
        }

        let mod = agentModuleCache.get(agentType);
        if (!mod) {
            mod = await import(entry.modulePath);
            agentModuleCache.set(agentType, mod!);
        }

        const AgentClass = mod![entry.className];
        if (!AgentClass) {
            throw new OrchestratorError(`Agent class ${entry.className} not found in module`, 'createAgent', false);
        }

        // Pass parentAgentId and depth to the constructor
        const agent = new AgentClass(task, this.context, undefined, parentAgentId, depth ?? 0) as BaseAgent;

        // Initialize the agent
        await agent.initialize();

        return agent;
    }

    // Parse system discovery output — delegates to CuriousAgent dynamically
    static async parseDiscoveryOutput(outputs: Record<string, string>): Promise<Partial<SystemProfile>> {
        let mod = agentModuleCache.get('curious');
        if (!mod) {
            mod = await import('./curious-agent.js');
            agentModuleCache.set('curious', mod!);
        }
        return mod!.CuriousAgent.parseDiscoveryOutput(outputs);
    }

    // Log execution for debugging and audit
    private logExecution(agent: string, status: 'started' | 'completed' | 'failed', error?: string): void {
        this.executionLog.push({
            agent,
            status,
            timestamp: new Date().toISOString(),
            error,
        });
    }

    // Emit error event with context
    private emitError(message: string, phase: string, _recoverable: boolean = false): void {
        this.emit('event', {
            type: 'error',
            message: `[Orchestrator] ${phase}: ${message}`,
        } as AgentEventType);
    }

    // Spawn agent with error handling + sub-agent listener
    private spawnAgent(agent: BaseAgent): boolean {
        const maxAgents = TIER_LIMITS[this.context.tier].maxConcurrentAgents;
        if (this.activeAgents.size >= maxAgents) {
            this.emitError(`Agent limit reached for ${this.context.tier} tier (max ${maxAgents})`, 'spawn', true);
            return false;
        }

        this.activeAgents.set(agent.id, agent);
        // Forward all agent events to the orchestrator's event stream
        agent.on('event', (event: AgentEventType) => this.emit('event', event));

        // Listen for sub-agent spawn requests
        agent.on('request:spawn', async (request: SubAgentRequest) => {
            await this.handleSubAgentRequest(agent, request);
        });

        // Listen for user answer requests (questions)
        agent.on('request:answer', ({ questionId, resolve, reject }: { questionId: string; resolve: (answer: string) => void; reject: (error: Error) => void }) => {
            this.pendingQuestions.set(questionId, resolve);
        });

        this.emit('event', agent.spawnEvent());
        return true;
    }

    // Handle a sub-agent spawn request from a parent agent
    private async handleSubAgentRequest(parentAgent: BaseAgent, request: SubAgentRequest): Promise<void> {
        try {
            // Check per-agent spawn limit before creating the agent
            if (!parentAgent.canSpawnSubAgent()) {
                const remainingSlots = parentAgent.getRemainingSubAgentSlots();
                const error = `Cannot spawn sub-agent: limit reached for ${parentAgent.agentType} ` +
                    `(remaining: ${remainingSlots}, ` +
                    `depth: ${parentAgent.depth}/${this.getMaxAgentDepth()})`;
                parentAgent.rejectSubAgentRequest(
                    request.requestId,
                    new Error(error)
                );
                return;
            }

            const subAgent = await this.createAgent(
                request.agentType,
                request.task,
                request.parentAgentId,
                request.parentDepth + 1
            );

            if (!this.spawnAgent(subAgent)) {
                parentAgent.rejectSubAgentRequest(
                    request.requestId,
                    new Error(`Cannot spawn sub-agent: global agent limit reached`)
                );
                return;
            }

            // Track the spawned subagent in the parent
            parentAgent.trackSpawnedSubAgent(subAgent);

            const result = await this.executeAgent(
                subAgent,
                request.input,
                request.additionalData
            );

            if (result.success) {
                parentAgent.resolveSubAgentRequest(request.requestId, result.data);
            } else {
                parentAgent.rejectSubAgentRequest(
                    request.requestId,
                    new Error(result.error || 'Sub-agent execution failed')
                );
            }
        } catch (error) {
            parentAgent.rejectSubAgentRequest(
                request.requestId,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    // Get the maximum agent depth (MAX_AGENT_DEPTH from base-agent)
    private getMaxAgentDepth(): number {
        // Import from base-agent module
        return 2; // MAX_AGENT_DEPTH value
    }

    // Remove completed agent
    private removeAgent(agentId: string): void {
        this.activeAgents.delete(agentId);
    }

    // ─── Model Selection Logic ───

    /**
     * Select the optimal model based on task context
     * Priority:
     * 1. User preferred model (if set)
     * 2. Deep reasoning → DeepSeek R1
     * 3. Coding-heavy → Qwen3 Coder
     * 4. Tool-heavy fast → GLM-4.5-Air
     * 5. Complex toolchains → Trinity
     * 6. Balanced tasks → GPT-OSS-120B
     * 7. Default → Nemotron
     */
    private selectModelForTask(
        query: string,
        intent: IntentType,
        complexity: ComplexityLevel,
        toolCount: number = 0
    ): { modelId: string; reasoning: string } {
        // Check for user preferred model first
        if (this.userConfig?.model?.preferred) {
            this.log('info', 'Using user preferred model', { model: this.userConfig.model.preferred });
            return { 
                modelId: this.userConfig.model.preferred, 
                reasoning: 'User preferred model from configuration' 
            };
        }

        if (!this.config.enableModelSelection) {
            return { modelId: this.config.defaultModel, reasoning: 'Model selection disabled, using default' };
        }

        // Build task context for model selector
        const taskContext: TaskContext = {
            query,
            requiresTools: toolCount > 0,
            toolCount,
            requiresCoding: this.needsCodingModel(query),
            requiresDeepReasoning: this.needsDeepReasoning(query),
            requiresLongContext: false,
            urgency: complexity === 'simple' ? 'fast' : complexity === 'complex' ? 'thorough' : 'balanced',
            complexity: complexity === 'decline' ? 'simple' : complexity,
        };

        const selection = selectModel(taskContext);

        // Log model selection
        this.log('info', 'Model selected', { 
            model: selection.selectedModel, 
            confidence: selection.confidence,
            reasoning: selection.reasoning,
            estimatedLatency: selection.estimatedLatency 
        });

        // Store fallback chain for potential retries
        this.attemptedModels.clear();

        return {
            modelId: selection.selectedModel,
            reasoning: selection.reasoning
        };
    }

    /**
     * Check if query requires coding model
     */
    private needsCodingModel(query: string): boolean {
        return CODING_PATTERNS.some(pattern => pattern.test(query));
    }

    /**
     * Check if query requires deep reasoning
     */
    private needsDeepReasoning(query: string): boolean {
        // Only use deep reasoning for explicit math/complex algorithm questions
        const deepPatterns = [
            /\b(prove|theorem|lemma|axiom|complexity\s+analysis)\b/i,
            /\b(mathematical\s+proof|formal\s+verification)\b/i,
        ];
        return deepPatterns.some(pattern => pattern.test(query));
    }

    // Execute agent with error handling and fallback
    private async executeAgent<T>(
        agent: BaseAgent,
        input: string,
        additionalData?: Record<string, unknown>,
        fallbackValue?: T
    ): Promise<AgentExecutionResult<T>> {
        const agentName = agent.name;
        this.logExecution(agentName, 'started');

        try {
            // Check circuit breaker
            const health = agent.healthCheck();
            if (!health.healthy) {
                throw new OrchestratorError(
                    `Agent ${agentName} is unhealthy (circuit breaker open)`,
                    'health-check',
                    true
                );
            }

            const result = await agent.run(input, additionalData) as T;
            this.logExecution(agentName, 'completed');

            // Track tokens if the result has tokensUsed
            if (result && typeof result === 'object' && 'tokensUsed' in result) {
                const tokensUsed = (result as any).tokensUsed as number;
                this.totalTokens += tokensUsed;
                this.agentTokens.set(agent.id, {
                    agentId: agent.id,
                    agentType: agent.name,
                    tokensUsed,
                });
            }

            this.removeAgent(agent.id);

            return { success: true, data: result };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logExecution(agentName, 'failed', errorMessage);
            this.removeAgent(agent.id);

            // Log to audit
            await this.logToAudit('agent_failure', {
                agentName,
                error: errorMessage,
                input: input.slice(0, 200),
            });

            // If graceful degradation is enabled and we have a fallback
            if (this.config.enableGracefulDegradation && fallbackValue !== undefined) {
                this.emitError(`Agent ${agentName} failed, using fallback: ${errorMessage}`, 'execution', true);
                return { success: false, data: fallbackValue, error: errorMessage, fallback: true };
            }

            return { success: false, error: errorMessage };
        }
    }

    // ─── Fast regex-based query classification (no LLM call) ───

    // Determine research strategy based on query complexity
    private determineResearchStrategy(query: string, intent: IntentType): ResearchStrategy {
        const trimmed = query.trim();
        const wordCount = trimmed.split(/\s+/).length;

        // Complex queries → deep strategy (check first for priority)
        // Pattern: setup, troubleshoot, kubernetes, docker, error, production, repair/action intent
        const complexPatterns = [
            /\b(setup|troubleshoot|debug|diagnose)\b/i,
            /\b(kubernetes|k8s|docker|podman|container|orchestration)\b/i,
            /\b(error|fail(ing|ed)?|broken|crash(ing|ed)?|issue|problem|fix|repair)\b/i,
            /\b(cluster|distributed|architecture|production|replication)\b/i,
        ];

        if (intent === 'repair' || intent === 'action' || complexPatterns.some(pattern => pattern.test(trimmed))) {
            return 'deep';
        }

        // Simple queries → quick strategy
        // Pattern: "what is", "explain", or very short queries (but not if install/configure keywords)
        const simplePatterns = [
            /^what\s+(is|are)\s+[\w\s-]+[\s?]*$/i,  // "what is X?" 
            /^explain\s+[\w\s-]+[\s?]*$/i,           // "explain X"
            /^show\s+me\s+[\w\s-]+[\s?]*$/i,         // "show me X"
            /^tell\s+me\s+about\s+[\w\s-]+[\s?]*$/i, // "tell me about X"
        ];

        // If it's short and matches simple patterns and doesn't mention install/configure
        if (wordCount <= 6 &&
            simplePatterns.some(pattern => pattern.test(trimmed)) &&
            !/\b(install|configure|setup)\b/i.test(trimmed)) {
            return 'quick';
        }

        // Medium complexity → adaptive strategy
        // Installation queries, configuration questions, multi-step procedures
        return 'adaptive';
    }

    private classifyQuery(message: string): QueryClassification {
        const trimmed = message.trim();
        this.log('debug', 'Classifying message', { preview: trimmed.substring(0, 50) });

        // 1. Check for greetings / chitchat / thanks → simple
        for (const pattern of GREETING_PATTERNS) {
            if (pattern.test(trimmed)) {
                this.log('debug', 'Detected GREETING/CHITCHAT → simple');
                return { intent: 'info', complexity: 'simple' };
            }
        }

        // 2. Check for conversational / follow-up messages → simple
        const conversationalPatterns = [
            /^(yes|no|yeah|nope|yep|sure|okay|ok|fine|alright|maybe|perhaps|idk|i don'?t know)[\s!?.,:]*$/i,
            /^(thanks?|thank you|thx|ty|appreciate|got it|understood|makes sense|i see|cool|nice|great|awesome)[\s!?.,:]*$/i,
            /^(what|why|where|when|who|which|whose)[\s?]*/i, // Short questions are usually follow-ups
            /^(can you|could you|would you|will you|please|try|let'?s)[\s]/i,
            /\b(more|another|different|else|other|additional)\b/i,
        ];

        for (const pattern of conversationalPatterns) {
            if (pattern.test(trimmed)) {
                // It's conversational if message is short or has conversational keywords
                if (trimmed.length < 100) {
                    return { intent: 'info', complexity: 'simple' };
                }
            }
        }

        // 3. Check for non-Linux topics → decline
        for (const pattern of NON_LINUX_PATTERNS) {
            if (pattern.test(trimmed)) {
                // Double-check: if the message also mentions Linux/terminal context, don't decline
                if (/\b(linux|ubuntu|debian|fedora|arch|centos|rhel|suse|mint|manjaro|kali|gentoo|void|alpine|nixos|terminal|bash|shell|command\s*line|cli|tty|distro|kernel)\b/i.test(trimmed)) {
                    break; // Has Linux context — don't decline, fall through to normal classification
                }
                return { intent: 'info', complexity: 'decline' };
            }
        }

        // 4. Check for system action keywords → complex
        for (const pattern of ACTION_PATTERNS) {
            if (pattern.test(trimmed)) {
                // Determine intent: repair vs action
                if (/\b(fix|repair|troubleshoot|debug|resolve|diagnose|broken|error|fail|crash|not\s*working|issue|problem|won'?t|can'?t|unable)\b/i.test(trimmed)) {
                    return { intent: 'repair', complexity: 'complex' };
                }
                return { intent: 'action', complexity: 'complex' };
            }
        }

        // 5. Check if it looks like system discovery output
        if (/^(NAME=|PRETTY_NAME=|ID=|VERSION=|uname|cat\s*\/etc)/i.test(trimmed)) {
            return { intent: 'system_discovery', complexity: 'simple' };
        }

        // 6. Default: moderate (research → synthesizer)
        // Any Linux question that isn't a greeting or action goes through research
        return { intent: 'info', complexity: 'moderate' };
    }

    // Handle greetings and simple chitchat — direct LLM response, no agents
    private async handleSimpleQuery(userMessage: string, conversationContext: string): Promise<void> {
        this.log('debug', 'handleSimpleQuery called', { preview: userMessage.substring(0, 50) });

        // Select model for simple query
        const { modelId } = this.selectModelForTask(userMessage, 'info', 'simple');

        try {
            // Pass system profile to get enhanced prompt
            const systemPrompt = getLinuxSystemPrompt({
                date: new Date().toISOString().split('T')[0],
                systemProfile: this.systemProfileData || this.context.systemProfile
            });
            const profileStr = this.getProfileString();
            const prefsStr = this.getPrefsString();
            const contextStr = conversationContext ? `\nRecent conversation:\n${conversationContext}` : '';

            const result = await this.withRetry(async () => {
                return await openRouterComplete(
                    [
                        {
                            role: 'system',
                            content: `${systemPrompt}\n${profileStr}${prefsStr}${contextStr}`,
                        },
                        ...this.context.messageHistory.slice(-5).map(m => ({
                            role: m.role as 'user' | 'assistant' | 'system',
                            content: m.content.slice(0, 500),
                        })),
                        { role: 'user' as const, content: userMessage },
                    ],
                    {
                        modelId,
                        maxTokens: 1024,
                        temperature: 0.7,
                        apiKey: this.context.apiKey,
                    }
                );
            }, 'simple-response');

            this.log('debug', 'Emitting message:chunk');
            this.emit('event', { type: 'message:chunk', content: result.content, timestamp: new Date().toISOString() } as AgentEventType);
            this.log('debug', 'Emitting message:done');
            this.emit('event', { type: 'message:done', citations: [], commands: [], timestamp: new Date().toISOString() } as AgentEventType);
            this.log('debug', 'handleSimpleQuery completed');
        } catch (error) {
            // Try fallback model if available
            const fallbackModel = getNextFallback(modelId, Array.from(this.attemptedModels));
            if (fallbackModel) {
                this.log('debug', 'Retrying with fallback model', { fallbackModel });
                this.attemptedModels.add(modelId);
                return this.handleSimpleQuery(userMessage, conversationContext);
            }
            await this.emitFallbackResponse(userMessage, error instanceof Error ? error.message : String(error));
        }
    }

    // Handle non-Linux topics — polite decline, no LLM call
    private async handleDeclineQuery(userMessage: string): Promise<void> {
        const declineMessage = `I'm **Orito**, a Linux-specialized assistant. I can only help with Linux, system administration, command-line tools, and open-source software.

I can't help with that particular topic, but here are some things I'm great at:

- **System setup** — installing packages, configuring services, setting up servers
- **Troubleshooting** — debugging errors, fixing boot issues, resolving dependency conflicts
- **Security** — firewalls, SSH hardening, user permissions, SELinux/AppArmor
- **Networking** — DNS, VPNs, reverse proxies, Wi-Fi configuration
- **DevOps** — Docker, Kubernetes, CI/CD, Ansible, Terraform
- **Shell scripting** — Bash, Zsh, automation, cron jobs

Try asking me something about Linux!`;

        this.emit('event', { type: 'message:chunk', content: declineMessage, timestamp: new Date().toISOString() } as AgentEventType);
        this.emit('event', { type: 'message:done', citations: [], commands: [], timestamp: new Date().toISOString() } as AgentEventType);
    }

    // Retry helper
    private async withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < this.config.maxRetries) {
                    this.emitError(`${label} attempt ${attempt + 1} failed: ${lastError.message}`, 'retry', true);
                    await new Promise(r => setTimeout(r, this.config.retryDelayMs * (attempt + 1)));
                }
            }
        }

        throw lastError;
    }

    private needsSystemProfile(intent: IntentType): boolean {
        return ['action', 'repair'].includes(intent) && !this.context.systemProfile?.distro;
    }

    // Build context from message history
    private buildConversationContext(): string {
        const recentMessages = this.context.messageHistory.slice(-5);
        if (recentMessages.length === 0) return '';

        return recentMessages
            .map(m => `${m.role}: ${m.content.slice(0, 500)}`)
            .join('\n\n');
    }

    // Helper: build system profile string for prompts
    private getProfileString(): string {
        const sp = this.context.systemProfile;
        if (!sp) return '';
        const parts = [sp.distro, sp.distroVersion, sp.kernel, sp.packageManager, sp.shell, sp.desktopEnvironment].filter(Boolean);
        return parts.length > 0 ? `User's system: ${parts.join(', ')}` : '';
    }

    // Check and collect system profile via user questions
    private async checkAndCollectSystemProfile(userMessage: string): Promise<boolean> {
        // Skip profile collection for simple queries and system_discovery
        const classification = this.classifyQuery(userMessage);
        if (classification.complexity === 'simple' || classification.intent === 'system_discovery') {
            return true; // Continue processing
        }

        // Check if profile is already collected in this session
        if (this.systemProfileData) {
            return true;
        }

        // Check if we have a complete profile from context
        if (this.context.systemProfile?.distro) {
            return true;
        }

        // Prevent re-entry during profile collection
        if (this.profileCheckInProgress) {
            return false; // Wait for current collection to complete
        }

        this.profileCheckInProgress = true;

        try {
            // Load chat to check for existing profile
            const chat = await Chat.findById(this.context.chatId);
            if (!chat) {
                this.profileCheckInProgress = false;
                return true; // Continue without profile
            }

            // Try to use existing profile or collect new one
            const existingProfile = await ensureSystemProfile(
                chat,
                this.context.userId || this.context.sessionId,
                async (question, options, allowCustom) => {
                    return await this.askUserQuestion(question, options, allowCustom);
                }
            );

            if (existingProfile) {
                this.systemProfileData = existingProfile;
                this.updateSystemProfile(convertToLegacyProfile(existingProfile));
                this.profileCheckInProgress = false;
                return true;
            }

            // Need to collect profile via questions
            const curious = await this.createAgent('curious', 'Collecting system profile');
            if (!this.spawnAgent(curious)) {
                this.profileCheckInProgress = false;
                return true; // Continue without profile
            }

            // Collect profile using curious agent
            const profile = await collectSystemProfile(
                chat,
                this.context.userId || this.context.sessionId,
                async (questions) => {
                    // Cast to any to access protected method
                    return await (curious as any).askUserQuestions(questions);
                },
                async (chatId, profile) => {
                    // Save profile to chat context and database
                    await Chat.updateOne(
                        { _id: chatId },
                        {
                            $set: {
                                'context.systemProfile': profile,
                                systemProfile: convertToLegacyProfile(profile),
                            }
                        }
                    );
                }
            );

            this.systemProfileData = profile;
            this.updateSystemProfile(convertToLegacyProfile(profile));

            this.emit('event', {
                type: 'message:chunk',
                content: `Thanks! I've recorded your system profile: ${profile.distro} ${profile.version} with ${profile.packageManager}. I'll use this information to provide more accurate Linux help.`,
                timestamp: new Date().toISOString()
            } as AgentEventType);

            this.profileCheckInProgress = false;
            return true;
        } catch (error) {
            console.error('[Orchestrator] Error collecting system profile:', error);
            this.profileCheckInProgress = false;
            return true; // Continue without profile on error
        }
    }

    // Helper to ask user a single question
    private async askUserQuestion(
        question: string,
        options: string[],
        allowCustom: boolean
    ): Promise<string> {
        const questionId = uuid();

        return new Promise((resolve, reject) => {
            // Emit question event with rich options format
            this.emit('event', {
                type: 'agent:question',
                agentId: 'orchestrator',
                questionId,
                question,
                options: options.map(opt => ({ label: opt })),
                allowCustom,
                timestamp: new Date().toISOString()
            } as AgentEventType);

            // Store resolver
            this.pendingQuestions.set(questionId, resolve);

            // Timeout after 2 minutes
            setTimeout(() => {
                if (this.pendingQuestions.has(questionId)) {
                    this.pendingQuestions.delete(questionId);
                    reject(new Error('Question timed out'));
                }
            }, 120000);
        });
    }

    // Helper: build user preferences string for prompts
    private getPrefsString(): string {
        const prefs = this.userPreferences;
        if (!prefs) return '';
        let prefsStr = `\nUser preferences: Distro=${prefs.defaultDistro}, Shell=${prefs.defaultShell}, Response style=${prefs.responseStyle}`;
        if (prefs.customInstructions && prefs.customInstructions.trim()) {
            prefsStr += `\n\nCustom Instructions:\n${prefs.customInstructions}`;
        }
        return prefsStr;
    }

    // Log to audit trail
    private async logToAudit(action: string, details: Record<string, unknown>): Promise<void> {
        try {
            const auditEntry = new AuditLog({
                chatId: this.context.chatId,
                sessionId: this.context.sessionId,
                userId: this.context.userId,
                actionId: uuid(),
                command: `orchestrator:${action}`,
                risk: 'low',
                userDecision: 'pending',
                hmac: 'orchestrator-internal',
                createdAt: new Date(),
                ...details,
            });
            await auditEntry.save();
        } catch (_error) {
            // Don't fail execution if audit logging fails
            this.emitError('Failed to write to audit log', 'audit', true);
        }
    }

    // Main process method with intelligent agent selection
    async process(userMessage: string): Promise<void> {
        this.log('debug', 'orchestrator.process() called', { preview: userMessage.substring(0, 50) });
        const startTime = Date.now();
        this.executionLog = [];

        // Reset token tracking for this query
        this.totalTokens = 0;
        this.agentTokens.clear();
        this.attemptedModels.clear();

        try {
            // Check and collect system profile first
            const profileReady = await this.checkAndCollectSystemProfile(userMessage);
            if (!profileReady) {
                // Profile collection in progress, will re-process when done
                return;
            }

            // Load user preferences if not cached
            if (!this.userPreferences && this.context.userId) {
                try {
                    const prefs = await UserPreferences.findOne({ userId: this.context.userId });
                    if (prefs) {
                        this.userPreferences = {
                            defaultDistro: prefs.defaultDistro,
                            defaultShell: prefs.defaultShell,
                            fontSize: typeof prefs.fontSize === 'number' ? prefs.fontSize : 14,
                            responseStyle: prefs.responseStyle,
                            customInstructions: prefs.customInstructions,
                        };
                        
                        // Load full user configuration
                        this.userConfig = (prefs as any).getSystemConfiguration();
                        
                        // Update context with user config for agents
                        this.context.userConfig = this.userConfig ?? undefined;
                    }
                } catch { /* continue without preferences */ }
            }

            // Log start
            await this.logToAudit('process_started', { message: userMessage.slice(0, 200) });

            // Fast regex-based classification (no LLM call — saves tokens)
            const { intent, complexity } = this.classifyQuery(userMessage);
            this.log('debug', 'Classification result', { intent, complexity });

            // ──────────────────────────────────────────────
            // DECLINE: Non-Linux topic — polite decline, no agents
            // ──────────────────────────────────────────────
            if (complexity === 'decline') {
                await this.handleDeclineQuery(userMessage);
                await this.logToAudit('process_completed', {
                    durationMs: Date.now() - startTime,
                    intent,
                    complexity,
                    agentsSpawned: 0,
                });
                return;
            }

            // Handle system discovery needed — queue the original query
            if (this.needsSystemProfile(intent)) {
                // Queue the user's original query so we can re-process it after discovery
                this.pendingQuery = userMessage;

                const curious = await this.createAgent('curious', 'Discovering your system configuration');
                if (!this.spawnAgent(curious)) {
                    this.emitError('Cannot spawn curious agent - agent limit reached', 'spawn', false);
                    // Still process the query without system profile rather than dropping it
                    this.pendingQuery = null;
                } else {
                    const result = await this.executeAgent(
                        curious,
                        userMessage,
                        undefined,
                        { commands: [], prompt: '', fields: [] }
                    );

                    if (!result.success) {
                        this.emitError('System discovery failed, proceeding without profile', 'discovery', true);
                        // Process the pending query anyway
                        this.pendingQuery = null;
                    } else {
                        // Return and wait for system_info WS message.
                        // The pending query will be processed in updateSystemProfile().
                        return;
                    }
                }
            }

            if (intent === 'system_discovery') {
                // User pasted system info — acknowledge it
                this.emit('event', {
                    type: 'message:chunk',
                    content: 'I see you\'ve shared some system information. I\'ll keep that in mind for future questions. Feel free to ask me anything about Linux!',
                    timestamp: new Date().toISOString()
                } as AgentEventType);
                this.emit('event', { type: 'message:done', citations: [], commands: [], timestamp: new Date().toISOString() } as AgentEventType);
                return;
            }

            // Build conversation context
            const conversationContext = this.buildConversationContext();

            // ──────────────────────────────────────────────
            // SIMPLE: Direct LLM response for greetings only
            // ──────────────────────────────────────────────
            if (complexity === 'simple') {
                await this.handleSimpleQuery(userMessage, conversationContext);

                await this.logToAudit('process_completed', {
                    durationMs: Date.now() - startTime,
                    intent,
                    complexity,
                    agentsSpawned: 0,
                    executionLog: this.executionLog,
                });
                return;
            }

            // Select model for this task
            const { modelId, reasoning } = this.selectModelForTask(userMessage, intent, complexity);
            this.log('debug', 'Using model', { modelId, reasoning });

            // ──────────────────────────────────────────────
            // MODERATE: Research → Synthesizer (any Linux question)
            // ──────────────────────────────────────────────
            if (complexity === 'moderate') {
                // Determine research strategy
                const strategy = this.determineResearchStrategy(userMessage, intent);
                const maxResults = strategy === 'quick' ? 3 : strategy === 'deep' ? 8 : 5;

                const research = await this.createAgent('research', `Researching: ${userMessage.slice(0, 80)}`);
                if (!this.spawnAgent(research)) {
                    this.emitError('Cannot spawn research agent - using direct response', 'spawn', true);
                    await this.handleSimpleQuery(userMessage, conversationContext);
                    return;
                }

                const researchResult = await this.executeAgent<ResearchOutput>(
                    research,
                    userMessage,
                    {
                        conversationContext,
                        dateContext: getDateContext(),
                        strategy,
                        maxResults,
                        modelId, // Pass selected model to agent
                    },
                    { citations: [], summary: 'Research unavailable.', needsDeeper: false, tokensUsed: 0 }
                );

                const researchData = researchResult.data!;

                const synth = await this.createAgent('synthesizer', 'Composing response');
                if (!this.spawnAgent(synth)) {
                    this.emitError('Cannot spawn synthesizer agent', 'spawn', false);
                    return;
                }

                await this.executeAgent<SynthesizerOutput>(
                    synth,
                    userMessage,
                    {
                        researchSummary: researchData.summary,
                        steps: [],
                        commands: [],
                        citations: researchData.citations,
                        blocked: [],
                        warnings: [],
                        conversationContext,
                        dateContext: getDateContext(),
                        modelId, // Pass selected model to agent
                    }
                );

                // Build agent metrics
                const agentMetrics = Array.from(this.agentTokens.values());

                // Emit final message with token tracking
                this.emit('event', {
                    type: 'message:done',
                    citations: researchData.citations,
                    commands: [],
                    totalTokensUsed: this.totalTokens,
                    agentMetrics,
                    timestamp: new Date().toISOString()
                } as AgentEventType);

                await this.logToAudit('process_completed', {
                    durationMs: Date.now() - startTime,
                    intent,
                    complexity,
                    agentsSpawned: 2,
                    executionLog: this.executionLog,
                });
                return;
            }

            // ──────────────────────────────────────────────
            // COMPLEX: Full pipeline — Research → Planner → [Validator] → Synthesizer
            // ──────────────────────────────────────────────

            // Determine research strategy
            const strategy = this.determineResearchStrategy(userMessage, intent);
            const maxResults = strategy === 'quick' ? 3 : strategy === 'deep' ? 8 : 5;

            // Research phase
            const research = await this.createAgent('research', `Researching: ${userMessage.slice(0, 80)}`);
            if (!this.spawnAgent(research)) {
                this.emitError('Cannot spawn research agent - using fallback', 'spawn', true);
                await this.synthesizeFallbackResponse(userMessage, conversationContext);
                return;
            }

            const researchResult = await this.executeAgent<ResearchOutput>(
                research,
                userMessage,
                {
                    conversationContext,
                    dateContext: getDateContext(),
                    strategy,
                    maxResults,
                    modelId, // Pass selected model to agent
                },
                { citations: [], summary: 'Research unavailable due to agent failure.', needsDeeper: false, tokensUsed: 0 }
            );

            const researchData = researchResult.data!;

            // Planner phase
            const planner = await this.createAgent('planner', `Planning steps for: ${userMessage.slice(0, 60)}`);
            if (!this.spawnAgent(planner)) {
                this.emitError('Cannot spawn planner agent - using fallback', 'spawn', true);
                await this.synthesizeFallbackResponse(userMessage, conversationContext, researchData);
                return;
            }

            const planResult = await this.executeAgent<PlannerOutput>(
                planner,
                userMessage,
                {
                    researchSummary: researchData.summary,
                    citations: researchData.citations,
                    conversationContext,
                    dateContext: getDateContext(),
                    modelId, // Pass selected model to agent
                },
                { steps: [], commands: [], tokensUsed: 0 }
            );

            const planData = planResult.data!;

            // Validator phase (only if commands exist)
            let validatedCommands: CommandProposal[] = planData.commands;
            let blocked: CommandProposal[] = [];
            let warnings: string[] = [];

            if (planData.commands.length > 0) {
                const validator = await this.createAgent('validator', `Validating ${planData.commands.length} commands`);
                if (this.spawnAgent(validator)) {
                    const validationResult = await this.executeAgent<ValidatorOutput>(
                        validator,
                        '',
                        {
                            commands: planData.commands,
                            modelId, // Pass selected model to agent
                        },
                        { validatedCommands: planData.commands, blocked: [], warnings: ['Validation skipped due to agent failure'], tokensUsed: 0 }
                    );

                    const validationData = validationResult.data!;
                    validatedCommands = validationData.validatedCommands;
                    blocked = validationData.blocked;
                    warnings = validationData.warnings;
                } else {
                    warnings.push('Command validation skipped - agent limit reached');
                }
            }

            // Synthesizer phase
            const synth = await this.createAgent('synthesizer', 'Composing final response');
            if (!this.spawnAgent(synth)) {
                this.emitError('Cannot spawn synthesizer agent', 'spawn', false);
                return;
            }

            await this.executeAgent<SynthesizerOutput>(
                synth,
                userMessage,
                {
                    researchSummary: researchData.summary,
                    steps: planData.steps,
                    commands: validatedCommands,
                    citations: researchData.citations,
                    blocked: blocked.map(cmd => cmd.command),
                    warnings,
                    conversationContext,
                    dateContext: getDateContext(),
                    modelId, // Pass selected model to agent
                }
            );

            // Build agent metrics
            const agentMetrics = Array.from(this.agentTokens.values());

            // Emit final message with token tracking
            this.emit('event', {
                type: 'message:done',
                citations: researchData.citations,
                commands: validatedCommands,
                totalTokensUsed: this.totalTokens,
                agentMetrics,
                timestamp: new Date().toISOString()
            } as AgentEventType);

            // Log completion
            await this.logToAudit('process_completed', {
                durationMs: Date.now() - startTime,
                intent,
                complexity,
                agentsSpawned: planData.commands.length > 0 ? 4 : 3,
                executionLog: this.executionLog,
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.emitError(`Processing failed: ${errorMessage}`, 'process', false);

            // Log failure
            await this.logToAudit('process_failed', {
                error: errorMessage,
                durationMs: Date.now() - startTime,
                executionLog: this.executionLog,
            });

            // Attempt to send a fallback response to the user
            if (this.config.enableGracefulDegradation) {
                await this.emitFallbackResponse(userMessage, errorMessage);
            }
        }
    }

    // Fallback response when synthesizer fails
    private async synthesizeFallbackResponse(
        userMessage: string,
        conversationContext: string,
        researchData?: ResearchOutput
    ): Promise<void> {
        const synth = await this.createAgent('synthesizer', 'Composing fallback response');
        if (!this.spawnAgent(synth)) {
            // Last resort: emit a simple error message
            this.emit('event', {
                type: 'message:done',
                citations: researchData?.citations || [],
                commands: [],
                timestamp: new Date().toISOString()
            } as AgentEventType);
            return;
        }

        await this.executeAgent(
            synth,
            userMessage,
            {
                researchSummary: researchData?.summary || 'Research unavailable.',
                steps: [],
                commands: [],
                citations: researchData?.citations || [],
                blocked: [],
                warnings: ['Some processing steps were skipped due to errors.'],
                conversationContext,
                dateContext: getDateContext(),
            }
        );
    }

    // Emit fallback response on total failure
    private async emitFallbackResponse(_userMessage: string, error: string): Promise<void> {
        this.emit('event', {
            type: 'message:chunk',
            content: `I encountered an error while processing your request: ${error}. Please try again or rephrase your question.`,
            timestamp: new Date().toISOString()
        } as AgentEventType);

        this.emit('event', {
            type: 'message:done',
            citations: [],
            commands: [],
            timestamp: new Date().toISOString()
        } as AgentEventType);
    }

    // Update system profile — also processes any pending query
    updateSystemProfile(profile: Partial<SystemProfile>): void {
        if (!this.context.systemProfile) {
            this.context.systemProfile = {
                distro: null,
                distroVersion: null,
                kernel: null,
                packageManager: null,
                cpuModel: null,
                gpuInfo: null,
                shell: null,
                displayServer: null,
                windowManager: null,
                desktopEnvironment: null,
                collectedAt: new Date().toISOString(),
            };
        }
        Object.assign(this.context.systemProfile, profile);

        // If there's a pending query that was deferred for system discovery, process it now
        if (this.pendingQuery) {
            const query = this.pendingQuery;
            this.pendingQuery = null;
            // Process asynchronously — don't block the WS handler
            this.process(query).catch(err => {
                this.emitError(`Failed to process pending query: ${err instanceof Error ? err.message : String(err)}`, 'pending-query', false);
            });
        }
    }

    /**
     * Resolve a pending user answer for an agent question.
     * Called by WS handler when the user responds to an agent:question event.
     */
    resolveUserAnswer(questionId: string, answer: string): void {
        const resolve = this.pendingQuestions.get(questionId);
        if (resolve) {
            resolve(answer);
            this.pendingQuestions.delete(questionId);
        }
    }

    /**
     * Wait for a user answer to a specific question.
     * Returns a promise that resolves when the user responds.
     */
    waitForUserAnswer(questionId: string, timeoutMs: number = 120000): Promise<string> {
        return new Promise((resolve, reject) => {
            this.pendingQuestions.set(questionId, resolve);
            setTimeout(() => {
                if (this.pendingQuestions.has(questionId)) {
                    this.pendingQuestions.delete(questionId);
                    reject(new Error('Question timed out'));
                }
            }, timeoutMs);
        });
    }

    // Get execution metrics
    getExecutionMetrics(): Array<{ agent: string; status: string; timestamp: string; error?: string }> {
        return [...this.executionLog];
    }

    // Health check for orchestrator
    healthCheck(): { healthy: boolean; activeAgents: number; tier: string } {
        return {
            healthy: true,
            activeAgents: this.activeAgents.size,
            tier: this.context.tier,
        };
    }

    /**
     * Get available models and their capabilities
     */
    getAvailableModels(): Array<{ id: string; name: string; description: string; capabilities: string[] }> {
        return Object.values(SUPPORTED_MODELS).map(model => ({
            id: model.id,
            name: model.name,
            description: model.description,
            capabilities: Object.entries(model.capabilities)
                .filter(([, enabled]) => enabled)
                .map(([cap]) => cap),
        }));
    }

    /**
     * Enable or disable model selection
     */
    setModelSelection(enabled: boolean): void {
        this.config.enableModelSelection = enabled;
    }
}
