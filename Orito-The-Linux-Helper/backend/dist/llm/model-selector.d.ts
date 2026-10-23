/**
 * Intelligent Model Selection Engine
 * Selects optimal models based on task context, query content, and requirements
 */
export interface TaskContext {
    query: string;
    requiresTools?: boolean;
    toolCount?: number;
    requiresCoding?: boolean;
    requiresDeepReasoning?: boolean;
    requiresLongContext?: boolean;
    messageHistoryLength?: number;
    estimatedContextSize?: number;
    urgency?: 'fast' | 'balanced' | 'thorough';
    complexity?: 'simple' | 'moderate' | 'complex';
}
export interface ModelSelectionResult {
    selectedModel: string;
    confidence: number;
    reasoning: string;
    fallbackChain: string[];
    estimatedLatency: 'fast' | 'medium' | 'slow';
}
/**
 * Select the optimal model based on task context
 *
 * Selection Priority:
 * 1. Deep reasoning → DeepSeek R1 (SLOW - use sparingly)
 * 3. Tool-heavy + Fast → GLM-4.5-Air
 * 4. Complex toolchains + Long context → Trinity
 * 5. Balanced tasks → GPT-OSS-120B
 * 6. Default → GLM-4.5-Air (fast agent tasks)
 */
export declare function selectModel(context: TaskContext): ModelSelectionResult;
/**
 * Get the next fallback model given a failed model
 */
export declare function getNextFallback(currentModel: string, attemptedModels?: string[]): string | null;
/**
 * Validate if a model ID is supported
 */
export declare function isValidModel(modelId: string): boolean;
/**
 * Get optimal parameters for a model
 */
export declare function getOptimalParams(modelId: string): {
    temperature: number;
    topP: number;
    maxTokens: number;
};
/**
 * Check if tool calling should be enabled for this model
 */
export declare function shouldEnableTools(modelId: string): boolean;
/**
 * Analyze query to suggest optimal settings
 */
export declare function analyzeQuery(query: string): {
    suggestedModel: string;
    requiresTools: boolean;
    requiresCoding: boolean;
    requiresReasoning: boolean;
};
//# sourceMappingURL=model-selector.d.ts.map