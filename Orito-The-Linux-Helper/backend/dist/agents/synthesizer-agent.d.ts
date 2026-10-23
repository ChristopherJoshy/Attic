import { BaseAgent, type AgentConfig } from './base-agent.js';
import type { OrchestratorContext, SynthesizerOutput } from '../types.js';
export declare class SynthesizerAgent extends BaseAgent {
    constructor(task: string, context: OrchestratorContext, agentConfig?: AgentConfig, parentAgentId?: string, depth?: number, modelId?: string);
    private getRiskIndicator;
    private analyzeComplexity;
    private determineResponseType;
    private formatInteractiveGuide;
    run(query: string, additionalData?: Record<string, unknown>): Promise<SynthesizerOutput>;
    private logToAudit;
}
//# sourceMappingURL=synthesizer-agent.d.ts.map