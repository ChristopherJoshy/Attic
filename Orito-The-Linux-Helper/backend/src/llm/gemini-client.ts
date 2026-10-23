import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { trackApiCall, type AgentType } from '../services/usage-tracker.js';

let genAI: GoogleGenerativeAI | null = null;

// Context for usage tracking
export interface GeminiUsageTrackingContext {
    userId: string;
    sessionId?: string;
    agentType: AgentType | string;
    apiKeyType: 'user' | 'system';
}

function getClient(): GoogleGenerativeAI {
    if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
    if (!genAI) genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    return genAI;
}

/**
 * Estimate token count from text (rough approximation)
 * Gemini uses different tokenization, but ~4 chars per token is a reasonable estimate
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Analyze an image using Gemini vision capabilities
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - MIME type of the image
 * @param prompt - Prompt/question about the image
 * @param usageTracking - Optional usage tracking context
 * @returns Analysis text from Gemini
 */
export async function analyzeImage(
    imageBase64: string,
    mimeType: string,
    prompt: string,
    usageTracking?: GeminiUsageTrackingContext
): Promise<string> {
    const startTime = Date.now();
    const client = getClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    try {
        const result = await model.generateContent([
            { text: prompt || 'Describe this image in detail. If it contains an error message, terminal output, or system information, extract and explain it.' },
            { inlineData: { data: imageBase64, mimeType } },
        ]);

        const responseText = result.response.text();

        // Track usage if context is provided
        if (usageTracking) {
            try {
                // Estimate tokens for vision requests
                const estimatedInputTokens = estimateTokens(prompt || '') + Math.ceil(imageBase64.length / 100); // Images use fewer "tokens" in base64
                const estimatedOutputTokens = estimateTokens(responseText);

                await trackApiCall({
                    userId: usageTracking.userId,
                    sessionId: usageTracking.sessionId,
                    agentType: usageTracking.agentType,
                    model: 'gemini-2.0-flash-exp',
                    provider: 'google',
                    inputTokens: estimatedInputTokens,
                    outputTokens: estimatedOutputTokens,
                    latencyMs: Date.now() - startTime,
                    apiKeyType: usageTracking.apiKeyType,
                    success: true,
                });
            } catch (trackingError) {
                console.error('[UsageTracking] Failed to track Gemini image analysis:', trackingError);
            }
        }

        return responseText;
    } catch (error) {
        // Track failed request
        if (usageTracking) {
            try {
                await trackApiCall({
                    userId: usageTracking.userId,
                    sessionId: usageTracking.sessionId,
                    agentType: usageTracking.agentType,
                    model: 'gemini-2.0-flash-exp',
                    provider: 'google',
                    inputTokens: estimateTokens(prompt || ''),
                    outputTokens: 0,
                    latencyMs: Date.now() - startTime,
                    apiKeyType: usageTracking.apiKeyType,
                    success: false,
                    errorMessage: error instanceof Error ? error.message : String(error),
                });
            } catch (trackingError) {
                console.error('[UsageTracking] Failed to track failed Gemini request:', trackingError);
            }
        }
        throw error;
    }
}

/**
 * Complete a vision task with Gemini (image + text)
 * @param options - Object containing prompt and image data
 * @param usageTracking - Optional usage tracking context
 * @returns Text response from Gemini
 */
export async function geminiVisionComplete({
    prompt,
    image,
    usageTracking,
}: {
    prompt: string;
    image: { data: Buffer; mimeType: string };
    usageTracking?: GeminiUsageTrackingContext;
}): Promise<string> {
    const startTime = Date.now();
    const client = getClient();
    const model = client.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp'
    });
    
    try {
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: image.data.toString('base64'),
                    mimeType: image.mimeType
                }
            }
        ]);

        const responseText = result.response.text();

        // Track usage if context is provided
        if (usageTracking) {
            try {
                const estimatedInputTokens = estimateTokens(prompt) + Math.ceil(image.data.length / 100);
                const estimatedOutputTokens = estimateTokens(responseText);

                await trackApiCall({
                    userId: usageTracking.userId,
                    sessionId: usageTracking.sessionId,
                    agentType: usageTracking.agentType,
                    model: 'gemini-2.0-flash-exp',
                    provider: 'google',
                    inputTokens: estimatedInputTokens,
                    outputTokens: estimatedOutputTokens,
                    latencyMs: Date.now() - startTime,
                    apiKeyType: usageTracking.apiKeyType,
                    success: true,
                });
            } catch (trackingError) {
                console.error('[UsageTracking] Failed to track Gemini vision complete:', trackingError);
            }
        }
        
        return responseText;
    } catch (error) {
        // Track failed request
        if (usageTracking) {
            try {
                await trackApiCall({
                    userId: usageTracking.userId,
                    sessionId: usageTracking.sessionId,
                    agentType: usageTracking.agentType,
                    model: 'gemini-2.0-flash-exp',
                    provider: 'google',
                    inputTokens: estimateTokens(prompt),
                    outputTokens: 0,
                    latencyMs: Date.now() - startTime,
                    apiKeyType: usageTracking.apiKeyType,
                    success: false,
                    errorMessage: error instanceof Error ? error.message : String(error),
                });
            } catch (trackingError) {
                console.error('[UsageTracking] Failed to track failed Gemini request:', trackingError);
            }
        }
        throw error;
    }
}

/**
 * Complete a text-only task with Gemini
 * @param prompt - Text prompt
 * @param usageTracking - Optional usage tracking context
 * @returns Text response from Gemini
 */
export async function geminiComplete(
    prompt: string,
    usageTracking?: GeminiUsageTrackingContext
): Promise<string> {
    const startTime = Date.now();
    const client = getClient();
    const model = client.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp'
    });
    
    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Track usage if context is provided
        if (usageTracking) {
            try {
                const estimatedInputTokens = estimateTokens(prompt);
                const estimatedOutputTokens = estimateTokens(responseText);

                await trackApiCall({
                    userId: usageTracking.userId,
                    sessionId: usageTracking.sessionId,
                    agentType: usageTracking.agentType,
                    model: 'gemini-2.0-flash-exp',
                    provider: 'google',
                    inputTokens: estimatedInputTokens,
                    outputTokens: estimatedOutputTokens,
                    latencyMs: Date.now() - startTime,
                    apiKeyType: usageTracking.apiKeyType,
                    success: true,
                });
            } catch (trackingError) {
                console.error('[UsageTracking] Failed to track Gemini complete:', trackingError);
            }
        }
        
        return responseText;
    } catch (error) {
        // Track failed request
        if (usageTracking) {
            try {
                await trackApiCall({
                    userId: usageTracking.userId,
                    sessionId: usageTracking.sessionId,
                    agentType: usageTracking.agentType,
                    model: 'gemini-2.0-flash-exp',
                    provider: 'google',
                    inputTokens: estimateTokens(prompt),
                    outputTokens: 0,
                    latencyMs: Date.now() - startTime,
                    apiKeyType: usageTracking.apiKeyType,
                    success: false,
                    errorMessage: error instanceof Error ? error.message : String(error),
                });
            } catch (trackingError) {
                console.error('[UsageTracking] Failed to track failed Gemini request:', trackingError);
            }
        }
        throw error;
    }
}