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
    priority: number; // Lower = higher priority in selection
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

// Priority rankings (lower = higher priority)
export const MODEL_PRIORITY = {
    TOOL_FAST: 1,
    TOOL_COMPLEX: 2,
    REASONING_DEEP: 3,
    BALANCED: 4,
    CODING: 5,
    DEFAULT: 10,
} as const;

// All supported models with their configurations
export const SUPPORTED_MODELS: Record<string, ModelConfig> = {
    // Priority 1: Best for tool-calling, fast
    'z-ai/glm-4.5-air:free': {
        id: 'z-ai/glm-4.5-air:free',
        name: 'GLM-4.5-Air',
        provider: 'z-ai',
        description: 'Best for tool-calling with 90.6% success rate. Fast and reliable. Default model.',
        priority: MODEL_PRIORITY.DEFAULT,
        contextWindow: 128000,
        toolSuccessRate: 0.906,
        capabilities: {
            toolCalling: true,
            coding: true,
            reasoning: true,
            fastResponse: true,
            longContext: true,
            multiTurn: true,
        },
        optimalParams: {
            temperature: 0.6,
            topP: 0.95,
            maxTokens: 4096,
        },
        useCases: [
            'Tool-calling tasks',
            'Fast agent operations',
            'Multi-step workflows',
            'Real-time assistance',
            'General queries',
        ],
    },

    // Priority 2: Best for complex tool orchestration
    'arcee-ai/trinity-large-preview:free': {
        id: 'arcee-ai/trinity-large-preview:free',
        name: 'Trinity Large Preview',
        provider: 'arcee-ai',
        description: 'Best for complex tool orchestration with 512K context window',
        priority: MODEL_PRIORITY.TOOL_COMPLEX,
        contextWindow: 512000,
        capabilities: {
            toolCalling: true,
            coding: true,
            reasoning: true,
            fastResponse: false,
            longContext: true,
            multiTurn: true,
        },
        optimalParams: {
            temperature: 0.6,
            topP: 0.95,
            maxTokens: 4096,
        },
        useCases: [
            'Complex multi-tool chains',
            'Long context analysis',
            'Document processing',
            'Large codebase analysis',
        ],
    },

    // Priority 3: Best for deep reasoning (SLOW - use sparingly)
    'deepseek/deepseek-r1-0528:free': {
        id: 'deepseek/deepseek-r1-0528:free',
        name: 'DeepSeek R1',
        provider: 'deepseek',
        description: 'Best for deep reasoning. SLOW (15-30s) - use sparingly for complex analysis',
        priority: MODEL_PRIORITY.REASONING_DEEP,
        contextWindow: 128000,
        capabilities: {
            toolCalling: false,
            coding: true,
            reasoning: true,
            fastResponse: false,
            longContext: true,
            multiTurn: true,
        },
        optimalParams: {
            temperature: 0.6,
            topP: 0.95,
            maxTokens: 8192,
        },
        useCases: [
            'Deep reasoning tasks',
            'Complex problem solving',
            'Mathematical proofs',
            'Algorithm analysis',
        ],
        warnings: [
            'SLOW: 15-30 second response time',
            'Not suitable for real-time interactions',
            'Reserve for truly complex reasoning tasks',
        ],
    },

    // Priority 4: Best balanced reasoning + coding
    'openai/gpt-oss-120b:free': {
        id: 'openai/gpt-oss-120b:free',
        name: 'GPT-OSS 120B',
        provider: 'openai',
        description: 'Best balanced model for reasoning and coding tasks',
        priority: MODEL_PRIORITY.BALANCED,
        contextWindow: 128000,
        capabilities: {
            toolCalling: true,
            coding: true,
            reasoning: true,
            fastResponse: true,
            longContext: true,
            multiTurn: true,
        },
        optimalParams: {
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 4096,
        },
        useCases: [
            'Balanced coding tasks',
            'General reasoning',
            'Architecture discussions',
            'Code review',
        ],
    },

    // Priority 5: Best for coding
    'qwen/qwen3-coder:free': {
        id: 'qwen/qwen3-coder:free',
        name: 'Qwen3 Coder',
        provider: 'qwen',
        description: 'Best for coding with 69.6% SWE-Bench score',
        priority: MODEL_PRIORITY.CODING,
        contextWindow: 128000,
        swEBenchScore: 0.696,
        capabilities: {
            toolCalling: true,
            coding: true,
            reasoning: true,
            fastResponse: true,
            longContext: true,
            multiTurn: true,
        },
        optimalParams: {
            temperature: 0.2,
            topP: 0.95,
            maxTokens: 4096,
        },
        useCases: [
            'Code generation',
            'Bug fixing',
            'Refactoring',
            'Code explanation',
        ],
    },
};

// Fallback chain - order of fallback when primary model fails
export const FALLBACK_CHAIN = [
    'z-ai/glm-4.5-air:free',
    'openai/gpt-oss-120b:free',
    'arcee-ai/trinity-large-preview:free',
    'qwen/qwen3-coder:free',
] as const;

// Default model for general use
export const DEFAULT_MODEL = 'z-ai/glm-4.5-air:free';

// Model selection thresholds
export const MODEL_SELECTION_THRESHOLDS = {
    // If query contains these patterns, prefer deep reasoning
    DEEP_REASONING_KEYWORDS: [
        /\b(prove|theorem|lemma|axiom|corollary|conjecture)\b/i,
        /\b(analyze.*complexity|time\s+complexity|space\s+complexity)\b/i,
        /\b(mathematical\s+proof|formal\s+verification)\b/i,
        /\b(algorithm\s+design|optimization\s+problem)\b/i,
    ],

    // If query contains these patterns, prefer coding model
    CODING_KEYWORDS: [
        /\b(code|program|script|function|method|class|api)\b/i,
        /\b(bug|error|exception|debug|fix|refactor)\b/i,
        /\b(implement|write|create|develop)\s+(a|an)?\s*(code|script|function|program)\b/i,
        /\b(python|javascript|typescript|java|go|rust|c\+\+|bash|shell)\s/i,
        /\b(git|github|commit|pull\s+request|merge)\b/i,
    ],

    // If query requires these tool patterns, prefer tool-heavy models
    TOOL_HEAVY_PATTERNS: [
        /\b(search|look\s+up|find|get|fetch|retrieve)\b/i,
        /\b(execute|run|perform|invoke|call)\b/i,
        /\b(and\s+then|after\s+that|next|step\s+by\s+step)\b/i,
        /\b(multiple|several|chain|sequence)\s+(tools|steps|actions)\b/i,
    ],

    // Long context indicators
    LONG_CONTEXT_INDICATORS: [
        /\b(large\s+(file|document|codebase|project))\b/i,
        /\b(entire\s+(file|script|document))\b/i,
        /\b(analyze\s+.*\d+\s*(lines?|pages?|files?))\b/i,
    ],
};

// Helper function to get model config by ID
export function getModelConfig(modelId: string): ModelConfig {
    const config = SUPPORTED_MODELS[modelId];
    if (!config) {
        throw new Error(`Unknown model ID: ${modelId}`);
    }
    return config;
}

// Helper function to get all models sorted by priority
export function getModelsByPriority(): ModelConfig[] {
    return Object.values(SUPPORTED_MODELS).sort((a, b) => a.priority - b.priority);
}

// Helper to check if a model supports tools
export function supportsToolCalling(modelId: string): boolean {
    const config = SUPPORTED_MODELS[modelId];
    return config?.capabilities.toolCalling ?? false;
}
