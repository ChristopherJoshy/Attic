/**
 * Model Pricing Configuration
 * Defines pricing per 1M tokens for each supported model
 * Prices are in USD
 */

export interface ModelPricing {
  inputPerMillion: number;  // Price per 1M input tokens
  outputPerMillion: number; // Price per 1M output tokens
  isFree: boolean;          // Whether the model is free
}

/**
 * Pricing data for all supported models
 * Sources: OpenRouter pricing page, model provider documentation
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Free models
  'z-ai/glm-4.5-air:free': {
    inputPerMillion: 0,
    outputPerMillion: 0,
    isFree: true,
  },
  'arcee-ai/trinity-large-preview:free': {
    inputPerMillion: 0,
    outputPerMillion: 0,
    isFree: true,
  },
  'deepseek/deepseek-r1-0528:free': {
    inputPerMillion: 0,
    outputPerMillion: 0,
    isFree: true,
  },
  'openai/gpt-oss-120b:free': {
    inputPerMillion: 0,
    outputPerMillion: 0,
    isFree: true,
  },
  'qwen/qwen3-coder:free': {
    inputPerMillion: 0,
    outputPerMillion: 0,
    isFree: true,
  },
  'nvidia/nemotron-3-nano-30b-a3b:free': {
    inputPerMillion: 0,
    outputPerMillion: 0,
    isFree: true,
  },

  // Paid models (via OpenRouter)
  'anthropic/claude-3.5-sonnet': {
    inputPerMillion: 3.00,
    outputPerMillion: 15.00,
    isFree: false,
  },
  'anthropic/claude-3.5-sonnet:beta': {
    inputPerMillion: 3.00,
    outputPerMillion: 15.00,
    isFree: false,
  },
  'anthropic/claude-3-opus': {
    inputPerMillion: 15.00,
    outputPerMillion: 75.00,
    isFree: false,
  },
  'anthropic/claude-3-haiku': {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
    isFree: false,
  },
  'openai/gpt-4o': {
    inputPerMillion: 2.50,
    outputPerMillion: 10.00,
    isFree: false,
  },
  'openai/gpt-4o-mini': {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
    isFree: false,
  },
  'openai/gpt-4-turbo': {
    inputPerMillion: 10.00,
    outputPerMillion: 30.00,
    isFree: false,
  },
  'google/gemini-flash-1.5': {
    inputPerMillion: 0.075,
    outputPerMillion: 0.30,
    isFree: false,
  },
  'google/gemini-pro-1.5': {
    inputPerMillion: 1.25,
    outputPerMillion: 5.00,
    isFree: false,
  },
  'meta-llama/llama-3.1-70b-instruct': {
    inputPerMillion: 0.40,
    outputPerMillion: 0.80,
    isFree: false,
  },
  'meta-llama/llama-3.1-405b-instruct': {
    inputPerMillion: 2.70,
    outputPerMillion: 2.70,
    isFree: false,
  },
  'qwen/qwen-2.5-72b-instruct': {
    inputPerMillion: 0.40,
    outputPerMillion: 0.60,
    isFree: false,
  },
  'deepseek/deepseek-chat': {
    inputPerMillion: 0.14,
    outputPerMillion: 0.28,
    isFree: false,
  },
  'deepseek/deepseek-coder': {
    inputPerMillion: 0.14,
    outputPerMillion: 0.28,
    isFree: false,
  },
  'mistralai/mistral-large': {
    inputPerMillion: 2.00,
    outputPerMillion: 6.00,
    isFree: false,
  },
  'mistralai/mixtral-8x22b-instruct': {
    inputPerMillion: 0.65,
    outputPerMillion: 0.65,
    isFree: false,
  },

  // Gemini models (direct API)
  'gemini-2.0-flash-exp': {
    inputPerMillion: 0,
    outputPerMillion: 0,
    isFree: true,
  },
  'gemini-1.5-flash': {
    inputPerMillion: 0.075,
    outputPerMillion: 0.30,
    isFree: false,
  },
  'gemini-1.5-pro': {
    inputPerMillion: 1.25,
    outputPerMillion: 5.00,
    isFree: false,
  },
};

/**
 * Default pricing for unknown models
 */
export const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 0.50,
  outputPerMillion: 1.00,
  isFree: false,
};

/**
 * Calculate cost for a given number of tokens
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param modelId - Model identifier
 * @returns Cost in USD
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string
): number {
  const pricing = MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  
  return inputCost + outputCost;
}

/**
 * Get pricing for a specific model
 * @param modelId - Model identifier
 * @returns Model pricing information
 */
export function getModelPricing(modelId: string): ModelPricing {
  return MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
}

/**
 * Check if a model is free
 * @param modelId - Model identifier
 * @returns Whether the model is free
 */
export function isModelFree(modelId: string): boolean {
  const pricing = MODEL_PRICING[modelId];
  return pricing?.isFree ?? false;
}

/**
 * Get all free models
 * @returns Array of free model IDs
 */
export function getFreeModels(): string[] {
  return Object.entries(MODEL_PRICING)
    .filter(([_, pricing]) => pricing.isFree)
    .map(([modelId]) => modelId);
}

/**
 * Get all paid models
 * @returns Array of paid model IDs
 */
export function getPaidModels(): string[] {
  return Object.entries(MODEL_PRICING)
    .filter(([_, pricing]) => !pricing.isFree)
    .map(([modelId]) => modelId);
}

/**
 * Format cost for display
 * @param cost - Cost in USD
 * @returns Formatted cost string
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return '$0.00';
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Provider identification helper
 */
export function getProviderFromModel(modelId: string): string {
  if (modelId.startsWith('gemini')) {
    return 'google';
  }
  
  const parts = modelId.split('/');
  if (parts.length >= 2) {
    return parts[0];
  }
  
  return 'unknown';
}