/**
 * Multi-Model Infrastructure Configuration
 * Defines all supported OpenRouter models and their capabilities
 */
export interface ModelCapabilities {
    toolCalling: boolean;
    coding: boolean;
    reasoning: boolean;
    fastResponse: boolean;
    longContext: boolean;
    multiTurn: boolean;
}
export interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    description: string;
    priority: number;
    contextWindow: number;
    toolSuccessRate?: number;
    swEBenchScore?: number;
    capabilities: ModelCapabilities;
    optimalParams: {
        temperature: number;
        topP: number;
        maxTokens: number;
    };
    useCases: string[];
    warnings?: string[];
}
export declare const MODEL_PRIORITY: {
    readonly TOOL_FAST: 1;
    readonly TOOL_COMPLEX: 2;
    readonly REASONING_DEEP: 3;
    readonly BALANCED: 4;
    readonly CODING: 5;
    readonly DEFAULT: 10;
};
export declare const SUPPORTED_MODELS: Record<string, ModelConfig>;
export declare const FALLBACK_CHAIN: readonly ["z-ai/glm-4.5-air:free", "openai/gpt-oss-120b:free", "arcee-ai/trinity-large-preview:free", "qwen/qwen3-coder:free"];
export declare const DEFAULT_MODEL = "z-ai/glm-4.5-air:free";
export declare const MODEL_SELECTION_THRESHOLDS: {
    DEEP_REASONING_KEYWORDS: RegExp[];
    CODING_KEYWORDS: RegExp[];
    TOOL_HEAVY_PATTERNS: RegExp[];
    LONG_CONTEXT_INDICATORS: RegExp[];
};
export declare function getModelConfig(modelId: string): ModelConfig;
export declare function getModelsByPriority(): ModelConfig[];
export declare function supportsToolCalling(modelId: string): boolean;
//# sourceMappingURL=models.d.ts.map