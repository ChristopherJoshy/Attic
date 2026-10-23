import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
let genAI = null;
function getClient() {
    if (!config.GEMINI_API_KEY)
        throw new Error('GEMINI_API_KEY not configured');
    if (!genAI)
        genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    return genAI;
}
/**
 * Analyze an image using Gemini vision capabilities
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - MIME type of the image
 * @param prompt - Prompt/question about the image
 * @returns Analysis text from Gemini
 */
export async function analyzeImage(imageBase64, mimeType, prompt) {
    const client = getClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent([
        { text: prompt || 'Describe this image in detail. If it contains an error message, terminal output, or system information, extract and explain it.' },
        { inlineData: { data: imageBase64, mimeType } },
    ]);
    return result.response.text();
}
/**
 * Complete a vision task with Gemini (image + text)
 * @param options - Object containing prompt and image data
 * @returns Text response from Gemini
 */
export async function geminiVisionComplete({ prompt, image }) {
    const client = getClient();
    const model = client.getGenerativeModel({
        model: 'gemini-2.0-flash-exp'
    });
    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: image.data.toString('base64'),
                mimeType: image.mimeType
            }
        }
    ]);
    return result.response.text();
}
/**
 * Complete a text-only task with Gemini
 * @param prompt - Text prompt
 * @returns Text response from Gemini
 */
export async function geminiComplete(prompt) {
    const client = getClient();
    const model = client.getGenerativeModel({
        model: 'gemini-2.0-flash-exp'
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
}
//# sourceMappingURL=gemini-client.js.map