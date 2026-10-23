/**
 * Analyze an image using Gemini vision capabilities
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - MIME type of the image
 * @param prompt - Prompt/question about the image
 * @returns Analysis text from Gemini
 */
export declare function analyzeImage(imageBase64: string, mimeType: string, prompt: string): Promise<string>;
/**
 * Complete a vision task with Gemini (image + text)
 * @param options - Object containing prompt and image data
 * @returns Text response from Gemini
 */
export declare function geminiVisionComplete({ prompt, image }: {
    prompt: string;
    image: {
        data: Buffer;
        mimeType: string;
    };
}): Promise<string>;
/**
 * Complete a text-only task with Gemini
 * @param prompt - Text prompt
 * @returns Text response from Gemini
 */
export declare function geminiComplete(prompt: string): Promise<string>;
//# sourceMappingURL=gemini-client.d.ts.map