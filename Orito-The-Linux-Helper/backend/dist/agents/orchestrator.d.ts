import EventEmitter from 'eventemitter3';
import type { OrchestratorContext, SystemProfile } from '../types.js';
export declare class OrchestratorError extends Error {
    readonly phase: string;
    readonly recoverable: boolean;
    readonly originalError?: Error;
    constructor(message: string, phase: string, recoverable?: boolean, originalError?: Error);
}
interface OrchestratorConfig {
    maxRetries: number;
    retryDelayMs: number;
    agentTimeoutMs: number;
    enableGracefulDegradation: boolean;
    enableModelSelection: boolean;
    defaultModel: string;
}
export declare class Orchestrator extends EventEmitter {
    private context;
    private activeAgents;
    private config;
    private executionLog;
    private pendingQuestions;
    private userPreferences;
    private pendingQuery;
    private systemProfileData;
    private profileCheckInProgress;
    private totalTokens;
    private agentTokens;
    private attemptedModels;
    constructor(context: OrchestratorContext, config?: Partial<OrchestratorConfig>);
    private createAgent;
    static parseDiscoveryOutput(outputs: Record<string, string>): Promise<Partial<SystemProfile>>;
    private logExecution;
    private emitError;
    private spawnAgent;
    private handleSubAgentRequest;
    private getMaxAgentDepth;
    private removeAgent;
    /**
     * Select the optimal model based on task context
     * Priority:
     * 1. Deep reasoning → DeepSeek R1
     * 2. Coding-heavy → Qwen3 Coder
     * 3. Tool-heavy fast → GLM-4.5-Air
     * 4. Complex toolchains → Trinity
     * 5. Balanced tasks → GPT-OSS-120B
     * 6. Default → Nemotron
     */
    private selectModelForTask;
    /**
     * Check if query requires coding model
     */
    private needsCodingModel;
    /**
     * Check if query requires deep reasoning
     */
    private needsDeepReasoning;
    private executeAgent;
    private determineResearchStrategy;
    private classifyQuery;
    private handleSimpleQuery;
    private handleDeclineQuery;
    private withRetry;
    private needsSystemProfile;
    private buildConversationContext;
    private getProfileString;
    private checkAndCollectSystemProfile;
    private askUserQuestion;
    private getPrefsString;
    private logToAudit;
    process(userMessage: string): Promise<void>;
    private synthesizeFallbackResponse;
    private emitFallbackResponse;
    updateSystemProfile(profile: Partial<SystemProfile>): void;
    /**
     * Resolve a pending user answer for an agent question.
     * Called by WS handler when the user responds to an agent:question event.
     */
    resolveUserAnswer(questionId: string, answer: string): void;
    /**
     * Wait for a user answer to a specific question.
     * Returns a promise that resolves when the user responds.
     */
    waitForUserAnswer(questionId: string, timeoutMs?: number): Promise<string>;
    getExecutionMetrics(): Array<{
        agent: string;
        status: string;
        timestamp: string;
        error?: string;
    }>;
    healthCheck(): {
        healthy: boolean;
        activeAgents: number;
        tier: string;
    };
    /**
     * Get available models and their capabilities
     */
    getAvailableModels(): Array<{
        id: string;
        name: string;
        description: string;
        capabilities: string[];
    }>;
    /**
     * Enable or disable model selection
     */
    setModelSelection(enabled: boolean): void;
}
export {};
//# sourceMappingURL=orchestrator.d.ts.map