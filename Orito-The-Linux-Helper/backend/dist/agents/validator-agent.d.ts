import { BaseAgent, type AgentConfig } from './base-agent.js';
import type { OrchestratorContext, ValidatorOutput } from '../types.js';
export declare class ValidatorAgent extends BaseAgent {
    constructor(task: string, context: OrchestratorContext, agentConfig?: AgentConfig, parentAgentId?: string, depth?: number, modelId?: string);
    /**
     * Initialize tool registry with validator-specific tools
     */
    protected initializeToolRegistry(): void;
    run(_input: string, additionalData?: Record<string, unknown>): Promise<ValidatorOutput>;
    private logToAudit;
}
//# sourceMappingURL=validator-agent.d.ts.map