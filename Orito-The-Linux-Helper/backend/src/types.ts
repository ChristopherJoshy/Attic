import { z } from 'zod';

export const TierEnum = z.enum(['trial', 'free', 'pro']);
export type Tier = z.infer<typeof TierEnum>;

export const AgentType = z.enum([
    'research',
    'planner',
    'validator',
    'synthesizer',
    'curious',
    'custom',
]);
export type AgentType = z.infer<typeof AgentType>;

export const RiskLevel = z.enum(['low', 'medium', 'high']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export interface Citation {
    url: string;
    title: string;
    excerpt: string;
    sourceWeight: number;
    confidence: number;
    crawledAt: string;
}

export interface CommandProposal {
    command: string;
    privilegeLevel: 'read-only' | 'user' | 'root';
    risk: RiskLevel;
    riskExplanation: string;
    dryRunHint: string | null;
    expectedOutput?: string;
    citations: Citation[];
}

export interface SystemProfile {
    distro: string | null;
    distroVersion: string | null;
    kernel: string | null;
    packageManager: string | null;
    cpuModel: string | null;
    gpuInfo: string | null;
    shell: string | null;
    displayServer: string | null;
    windowManager: string | null;
    desktopEnvironment: string | null;
    collectedAt: string;
}

export type AgentStatus = 'spawning' | 'thinking' | 'searching' | 'validating' | 'done' | 'error';

export type AgentEventType =
    | { type: 'agent:spawn'; agentId: string; name: string; agentType: AgentType; color: string; task: string; parentAgentId?: string; depth?: number; timestamp: string }
    | { type: 'agent:thinking'; agentId: string; thought: string; timestamp: string }
    | { type: 'agent:tool'; agentId: string; tool: string; input: string; status: 'running' | 'done'; output?: string; tokensUsed?: number; durationMs?: number; timestamp: string }
    | { type: 'agent:status'; agentId: string; status: AgentStatus; timestamp: string }
    | { type: 'agent:result'; agentId: string; summary: string; timestamp: string }
    | { type: 'agent:question'; agentId: string; questionId: string; question: string; header?: string; purpose?: string; options: QuestionOption[]; multiple?: boolean; allowCustom: boolean; timestamp: string }
    | { type: 'message:chunk'; content: string; timestamp: string }
    | { type: 'message:done'; citations: Citation[]; commands?: CommandProposal[]; totalTokensUsed?: number; agentMetrics?: { agentId: string; agentType: AgentType; tokensUsed: number }[]; timestamp: string }
    | { type: 'system:discovery'; agentId: string; commands: string[]; prompt: string; timestamp: string }
    | { type: 'error'; message: string; timestamp: string };

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations?: Citation[];
    commands?: CommandProposal[];
    agentEvents?: AgentEventType[];
    imageUrl?: string;
    timestamp: string;
}

export const IntentType = z.enum(['info', 'action', 'repair', 'system_discovery']);
export type IntentType = z.infer<typeof IntentType>;

export const ComplexityLevel = z.enum(['simple', 'moderate', 'complex', 'decline']);
export type ComplexityLevel = z.infer<typeof ComplexityLevel>;

export const ResearchStrategy = z.enum(['quick', 'deep', 'adaptive']);
export type ResearchStrategy = z.infer<typeof ResearchStrategy>;

export interface QuestionOption {
    label: string;
    description?: string;
}

export interface AgentQuestion {
    question: string;
    header?: string;
    purpose?: string;
    options: QuestionOption[];
    multiple?: boolean;
    allowCustom?: boolean;
    defaultValue?: string | string[];
}

export interface ResearchOutput {
    citations: Citation[];
    summary: string;
    needsDeeper: boolean;
    subTopic?: string;
    tokensUsed: number;
}

export interface PlannerOutput {
    steps: string[];
    commands: CommandProposal[];
    prerequisites?: string[];
    troubleshooting?: string[];
    tokensUsed: number;
}

export interface ValidatorOutput {
    validatedCommands: CommandProposal[];
    blocked: CommandProposal[];
    warnings: string[];
    suggestions?: string[];
    tokensUsed: number;
}

export interface SynthesizerOutput {
    response: string;
    metadata: {
        responseType: 'info' | 'action' | 'repair' | 'decline';
        complexity: ComplexityLevel;
        commandCount: number;
    };
    tokensUsed: number;
}

// User System Configuration types
export interface UserAgentConfig {
    enabled: boolean;
    priority: number;
    settings: Record<string, any>;
}

export interface UserModelConfig {
    preferred: string;
    fallback: string;
    temperature: number;
    maxTokens: number;
}

export interface UserBehaviorConfig {
    responseStyle: 'concise' | 'balanced' | 'verbose';
    streamResponses: boolean;
    showAgentCards: boolean;
    autoExecuteCommands: boolean;
}

export interface UserSystemConfig {
    defaultShell: string;
    packageManager: string;
    editor: string;
}

export interface UserConfiguration {
    model: UserModelConfig;
    agents: Record<string, UserAgentConfig>;
    behavior: UserBehaviorConfig;
    system: UserSystemConfig;
}

export interface OrchestratorContext {
    chatId: string;
    userId: string | null;
    sessionId: string;
    tier: Tier;
    systemProfile: SystemProfile | null;
    messageHistory: ChatMessage[];
    apiKey?: string;
    userConfig?: UserConfiguration;
    logger?: {
        info: (obj: Record<string, unknown>, msg?: string) => void;
        debug: (obj: Record<string, unknown>, msg?: string) => void;
        warn: (obj: Record<string, unknown>, msg?: string) => void;
        error: (obj: Record<string, unknown>, msg?: string) => void;
    };
}
