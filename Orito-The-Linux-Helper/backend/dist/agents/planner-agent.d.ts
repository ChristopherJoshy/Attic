import { BaseAgent, type AgentConfig } from './base-agent.js';
import type { OrchestratorContext, PlannerOutput } from '../types.js';
export declare class PlannerAgent extends BaseAgent {
    constructor(task: string, context: OrchestratorContext, agentConfig?: AgentConfig, parentAgentId?: string, depth?: number, modelId?: string);
    /**
     * Initialize tool registry with planner-specific tools
     */
    protected initializeToolRegistry(): void;
    /**
     * Initialize the agent by loading its definition and rendering the system prompt
     */
    init(): Promise<void>;
    run(query: string, additionalData?: Record<string, unknown>): Promise<PlannerOutput>;
    private logToAudit;
}
//# sourceMappingURL=planner-agent.d.ts.map