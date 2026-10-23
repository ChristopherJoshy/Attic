/**
 * Intelligent Model Selection Engine
 * Selects optimal models based on task context, query content, and requirements
 */
import { SUPPORTED_MODELS, FALLBACK_CHAIN, DEFAULT_MODEL, MODEL_SELECTION_THRESHOLDS, getModelConfig, } from '../config/models.js';
// Selection confidence scoring
const CONFIDENCE_WEIGHTS = {
    EXACT_MATCH: 1.0,
    HIGH_MATCH: 0.8,
    MEDIUM_MATCH: 0.6,
    LOW_MATCH: 0.4,
    DEFAULT_FALLBACK: 0.3,
};
/**
 * Check if query matches deep reasoning patterns
 */
function needsDeepReasoning(query) {
    const { DEEP_REASONING_KEYWORDS } = MODEL_SELECTION_THRESHOLDS;
    return DEEP_REASONING_KEYWORDS.some(pattern => pattern.test(query));
}
/**
 * Check if query is coding-heavy
 */
function needsCodingModel(query) {
    const { CODING_KEYWORDS } = MODEL_SELECTION_THRESHOLDS;
    return CODING_KEYWORDS.some(pattern => pattern.test(query));
}
/**
 * Check if query requires heavy tool usage
 */
function needsToolHeavyModel(query, toolCount = 0) {
    const { TOOL_HEAVY_PATTERNS } = MODEL_SELECTION_THRESHOLDS;
    const hasToolPatterns = TOOL_HEAVY_PATTERNS.some(pattern => pattern.test(query));
    return hasToolPatterns || toolCount > 2;
}
/**
 * Check if query needs long context
 */
function needsLongContext(query, estimatedSize = 0) {
    const { LONG_CONTEXT_INDICATORS } = MODEL_SELECTION_THRESHOLDS;
    const hasLongContextPatterns = LONG_CONTEXT_INDICATORS.some(pattern => pattern.test(query));
    return hasLongContextPatterns || estimatedSize > 32000;
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
export function selectModel(context) {
    const { query, requiresTools = false, toolCount = 0, requiresCoding = false, requiresDeepReasoning = false, requiresLongContext = false, estimatedContextSize = 0, urgency = 'balanced', complexity = 'moderate', } = context;
    let selectedModel = DEFAULT_MODEL;
    let confidence = CONFIDENCE_WEIGHTS.DEFAULT_FALLBACK;
    let reasoning = 'Default model for general agent tasks';
    let estimatedLatency = 'fast';
    // Priority 1: Deep reasoning tasks (but only if explicitly requested or thorough urgency)
    if (requiresDeepReasoning || (needsDeepReasoning(query) && urgency === 'thorough')) {
        selectedModel = 'deepseek/deepseek-r1-0528:free';
        confidence = CONFIDENCE_WEIGHTS.EXACT_MATCH;
        reasoning = 'Deep reasoning required - selecting DeepSeek R1 (slow but thorough)';
        estimatedLatency = 'slow';
    }
    // Priority 2: Coding-heavy tasks
    else if (requiresCoding || needsCodingModel(query)) {
        selectedModel = 'qwen/qwen3-coder:free';
        confidence = CONFIDENCE_WEIGHTS.HIGH_MATCH;
        reasoning = 'Coding-heavy task detected - selecting Qwen3 Coder (69.6% SWE-Bench)';
        estimatedLatency = 'fast';
    }
    // Priority 3: Tool-heavy tasks that need to be fast
    else if (requiresTools && urgency === 'fast' && toolCount > 0) {
        selectedModel = 'z-ai/glm-4.5-air:free';
        confidence = CONFIDENCE_WEIGHTS.HIGH_MATCH;
        reasoning = 'Fast tool-calling required - selecting GLM-4.5-Air (90.6% tool success rate)';
        estimatedLatency = 'fast';
    }
    // Priority 4: Complex toolchains or long context
    else if ((requiresTools && needsToolHeavyModel(query, toolCount)) ||
        (requiresLongContext || needsLongContext(query, estimatedContextSize))) {
        // Use Trinity for very long context, GLM for complex tools
        if (estimatedContextSize > 128000 || requiresLongContext) {
            selectedModel = 'arcee-ai/trinity-large-preview:free';
            confidence = CONFIDENCE_WEIGHTS.HIGH_MATCH;
            reasoning = 'Long context or complex toolchain required - selecting Trinity (512K context)';
            estimatedLatency = 'medium';
        }
        else {
            selectedModel = 'z-ai/glm-4.5-air:free';
            confidence = CONFIDENCE_WEIGHTS.MEDIUM_MATCH;
            reasoning = 'Tool orchestration required - selecting GLM-4.5-Air';
            estimatedLatency = 'fast';
        }
    }
    // Priority 5: Balanced tasks
    else if (complexity === 'moderate' || complexity === 'complex') {
        selectedModel = 'openai/gpt-oss-120b:free';
        confidence = CONFIDENCE_WEIGHTS.MEDIUM_MATCH;
        reasoning = 'Balanced reasoning+coding task - selecting GPT-OSS-120B';
        estimatedLatency = 'fast';
    }
    // Priority 6: Default for simple/fast tasks
    else {
        selectedModel = DEFAULT_MODEL;
        confidence = CONFIDENCE_WEIGHTS.DEFAULT_FALLBACK;
        reasoning = 'General agent task - selecting GLM-4.5-Air (balanced, reliable)';
        estimatedLatency = 'fast';
    }
    // Build fallback chain starting from selected model
    const fallbackChain = buildFallbackChain(selectedModel);
    return {
        selectedModel,
        confidence,
        reasoning,
        fallbackChain,
        estimatedLatency,
    };
}
/**
 * Build a fallback chain starting from a specific model
 */
function buildFallbackChain(primaryModel) {
    const chain = [primaryModel];
    // Add remaining models from FALLBACK_CHAIN (excluding primary if present)
    for (const modelId of FALLBACK_CHAIN) {
        if (modelId !== primaryModel && !chain.includes(modelId)) {
            chain.push(modelId);
        }
    }
    // Ensure all supported models are in the chain
    for (const modelId of Object.keys(SUPPORTED_MODELS)) {
        if (!chain.includes(modelId)) {
            chain.push(modelId);
        }
    }
    return chain;
}
/**
 * Get the next fallback model given a failed model
 */
export function getNextFallback(currentModel, attemptedModels = []) {
    const chain = buildFallbackChain(currentModel);
    for (const modelId of chain) {
        if (!attemptedModels.includes(modelId)) {
            return modelId;
        }
    }
    return null; // All models exhausted
}
/**
 * Validate if a model ID is supported
 */
export function isValidModel(modelId) {
    return modelId in SUPPORTED_MODELS;
}
/**
 * Get optimal parameters for a model
 */
export function getOptimalParams(modelId) {
    try {
        const config = getModelConfig(modelId);
        return config.optimalParams;
    }
    catch {
        // Return defaults if model not found
        return {
            temperature: 0.7,
            topP: 0.95,
            maxTokens: 4096,
        };
    }
}
/**
 * Check if tool calling should be enabled for this model
 */
export function shouldEnableTools(modelId) {
    try {
        const config = getModelConfig(modelId);
        return config.capabilities.toolCalling;
    }
    catch {
        return false;
    }
}
/**
 * Analyze query to suggest optimal settings
 */
export function analyzeQuery(query) {
    const hasCoding = needsCodingModel(query);
    const hasReasoning = needsDeepReasoning(query);
    const hasTools = needsToolHeavyModel(query);
    let suggestedModel = DEFAULT_MODEL;
    if (hasReasoning) {
        suggestedModel = 'deepseek/deepseek-r1-0528:free';
    }
    else if (hasCoding) {
        suggestedModel = 'qwen/qwen3-coder:free';
    }
    else if (hasTools) {
        suggestedModel = 'z-ai/glm-4.5-air:free';
    }
    return {
        suggestedModel,
        requiresTools: hasTools,
        requiresCoding: hasCoding,
        requiresReasoning: hasReasoning,
    };
}
//# sourceMappingURL=model-selector.js.map