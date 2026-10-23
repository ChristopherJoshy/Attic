import { z } from 'zod';
/**
 * Validation schemas for API routes
 */
// Auth routes
export const firebaseAuthSchema = z.object({
    body: z.object({
        idToken: z.string().min(1, 'idToken is required').max(4096, 'idToken too long'),
    }),
});
// Chat routes
export const createChatSchema = z.object({
    body: z.object({
        title: z.string().max(200, 'Title too long').optional(),
        systemProfile: z.record(z.unknown()).optional(),
    }).optional(),
});
export const chatIdParamSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid chat ID format'),
    }),
});
export const addMessageSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid chat ID format'),
    }),
    body: z.object({
        content: z.string()
            .min(1, 'Message content is required')
            .max(50000, 'Message content too long (max 50000 characters)'),
    }),
});
// Search routes
export const searchQuerySchema = z.object({
    querystring: z.object({
        q: z.string()
            .min(1, 'Query is required')
            .max(500, 'Query too long (max 500 characters)'),
    }),
});
// Preferences routes
const responseStyleSchema = z.enum(['concise', 'balanced', 'detailed']).optional();
const technicalLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional();
const fontSizeSchema = z.enum(['small', 'medium', 'large']).optional();
export const updatePreferencesSchema = z.object({
    body: z.object({
        responseStyle: responseStyleSchema,
        technicalLevel: technicalLevelSchema,
        defaultDistro: z.string().max(100).optional(),
        defaultShell: z.string().max(50).optional(),
        fontSize: fontSizeSchema,
        showAgentCards: z.boolean().optional(),
        autoApproveLowRisk: z.boolean().optional(),
        compactMode: z.boolean().optional(),
        showCitationsInline: z.boolean().optional(),
        explainBeforeCommands: z.boolean().optional(),
        includeAlternatives: z.boolean().optional(),
        warnAboutSideEffects: z.boolean().optional(),
        customInstructions: z.string().max(2000, 'Custom instructions too long (max 2000 characters)').optional(),
        memory: z.record(z.unknown()).optional(),
        docSources: z.array(z.string().max(500)).max(20).optional(),
    }).strict(), // Reject unknown fields
});
// Generic ID validation
export const mongoIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID format');
/**
 * Helper to validate request data
 */
export function validateOrThrow(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new Error(`Validation error: ${errors}`);
    }
    return result.data;
}
//# sourceMappingURL=schemas.js.map