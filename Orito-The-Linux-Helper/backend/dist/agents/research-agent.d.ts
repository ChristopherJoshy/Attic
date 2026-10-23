import { BaseAgent, type AgentConfig } from './base-agent.js';
import type { OrchestratorContext, ResearchOutput } from '../types.js';
export declare class ResearchAgent extends BaseAgent {
    private subResearchCount;
    private static readonly MAX_SUB_RESEARCH;
    constructor(task: string, context: OrchestratorContext, agentConfig?: AgentConfig, parentAgentId?: string, depth?: number, modelId?: string);
    /**
     * Initialize tool registry with research-specific tools
     */
    protected initializeToolRegistry(): void;
    run(query: string, additionalData?: Record<string, unknown>): Promise<ResearchOutput>;
    /**
     * Get max results based on research strategy
     */
    private getMaxResultsForStrategy;
    /**
     * Extract citations from tool call results
     */
    private extractCitationsFromToolCalls;
    private identifySubTopic;
    private logToAudit;
}
//# sourceMappingURL=research-agent.d.ts.map