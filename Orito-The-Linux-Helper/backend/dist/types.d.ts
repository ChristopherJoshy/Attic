import { z } from 'zod';
export declare const TierEnum: z.ZodEnum<["trial", "free", "pro"]>;
export type Tier = z.infer<typeof TierEnum>;
export declare const AgentType: z.ZodEnum<["research", "planner", "validator", "synthesizer", "curious", "custom"]>;
export type AgentType = z.infer<typeof AgentType>;
export declare const RiskLevel: z.ZodEnum<["low", "medium", "high"]>;
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
    collectedAt: string;
}
export type AgentStatus = 'spawning' | 'thinking' | 'searching' | 'validating' | 'done' | 'error';
export type AgentEventType = {
    type: 'agent:spawn';
    agentId: string;
    name: string;
    agentType: AgentType;
    color: string;
    task: string;
    parentAgentId?: string;
    depth?: number;
    timestamp: string;
} | {
    type: 'agent:thinking';
    agentId: string;
    thought: string;
    timestamp: string;
} | {
    type: 'agent:tool';
    agentId: string;
    tool: string;
    input: string;
    status: 'running' | 'done';
    output?: string;
    tokensUsed?: number;
    durationMs?: number;
    timestamp: string;
} | {
    type: 'agent:status';
    agentId: string;
    status: AgentStatus;
    timestamp: string;
} | {
    type: 'agent:result';
    agentId: string;
    summary: string;
    timestamp: string;
} | {
    type: 'agent:question';
    agentId: string;
    questionId: string;
    question: string;
    options: string[];
    allowCustom: boolean;
    timestamp: string;
} | {
    type: 'message:chunk';
    content: string;
    timestamp: string;
} | {
    type: 'message:done';
    citations: Citation[];
    commands?: CommandProposal[];
    totalTokensUsed?: number;
    agentMetrics?: {
        agentId: string;
        agentType: AgentType;
        tokensUsed: number;
    }[];
    timestamp: string;
} | {
    type: 'system:discovery';
    agentId: string;
    commands: string[];
    prompt: string;
    timestamp: string;
} | {
    type: 'error';
    message: string;
    timestamp: string;
};
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations?: Citation[];
    commands?: CommandProposal[];
    agentEvents?: AgentEventType[];
    imageUrl?: string;
    timestamp: string;
}
export declare const IntentType: z.ZodEnum<["info", "action", "repair", "system_discovery"]>;
export type IntentType = z.infer<typeof IntentType>;
export declare const ComplexityLevel: z.ZodEnum<["simple", "moderate", "complex", "decline"]>;
export type ComplexityLevel = z.infer<typeof ComplexityLevel>;
export declare const ResearchStrategy: z.ZodEnum<["quick", "deep", "adaptive"]>;
export type ResearchStrategy = z.infer<typeof ResearchStrategy>;
export interface QuestionOption {
    label: string;
    description: string;
}
export interface AgentQuestion {
    question: string;
    header: string;
    options: QuestionOption[];
    multiple: boolean;
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
export interface OrchestratorContext {
    chatId: string;
    userId: string | null;
    sessionId: string;
    tier: Tier;
    systemProfile: SystemProfile | null;
    messageHistory: ChatMessage[];
}
//# sourceMappingURL=types.d.ts.map