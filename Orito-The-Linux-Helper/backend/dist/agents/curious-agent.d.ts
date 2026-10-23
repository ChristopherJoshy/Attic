import { BaseAgent, type AgentConfig } from './base-agent.js';
import type { OrchestratorContext, SystemProfile } from '../types.js';
interface CuriousAgentOutput {
    commands: string[];
    prompt: string;
    fields: string[];
}
export declare class CuriousAgent extends BaseAgent {
    constructor(task: string, context: OrchestratorContext, agentConfig?: AgentConfig, parentAgentId?: string, depth?: number, modelId?: string);
    /**
     * Initialize tool registry with curious-specific tools
     */
    protected initializeToolRegistry(): void;
    /**
     * Override renderSystemPrompt to provide curious-agent specific context
     */
    protected renderSystemPrompt(): string;
    run(input: string, additionalData?: Record<string, unknown>): Promise<CuriousAgentOutput>;
    static parseDiscoveryOutput(outputs: Record<string, string>): Partial<SystemProfile>;
    static getRequiredFields(profile: SystemProfile | null): string[];
    /**
     * Collect system profile via interactive questions
     * This is called when command-based discovery is not available
     */
    collectProfileViaQuestions(): Promise<SystemProfile | null>;
    private logToAudit;
}
export {};
//# sourceMappingURL=curious-agent.d.ts.map