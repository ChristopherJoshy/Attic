import { z } from 'zod';
/**
 * Validation schemas for API routes
 */
export declare const firebaseAuthSchema: z.ZodObject<{
    body: z.ZodObject<{
        idToken: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        idToken: string;
    }, {
        idToken: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        idToken: string;
    };
}, {
    body: {
        idToken: string;
    };
}>;
export declare const createChatSchema: z.ZodObject<{
    body: z.ZodOptional<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        systemProfile: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        title?: string | undefined;
        systemProfile?: Record<string, unknown> | undefined;
    }, {
        title?: string | undefined;
        systemProfile?: Record<string, unknown> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    body?: {
        title?: string | undefined;
        systemProfile?: Record<string, unknown> | undefined;
    } | undefined;
}, {
    body?: {
        title?: string | undefined;
        systemProfile?: Record<string, unknown> | undefined;
    } | undefined;
}>;
export declare const chatIdParamSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const addMessageSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
    }, {
        content: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        content: string;
    };
}, {
    params: {
        id: string;
    };
    body: {
        content: string;
    };
}>;
export declare const searchQuerySchema: z.ZodObject<{
    querystring: z.ZodObject<{
        q: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        q: string;
    }, {
        q: string;
    }>;
}, "strip", z.ZodTypeAny, {
    querystring: {
        q: string;
    };
}, {
    querystring: {
        q: string;
    };
}>;
export declare const updatePreferencesSchema: z.ZodObject<{
    body: z.ZodObject<{
        responseStyle: z.ZodOptional<z.ZodEnum<["concise", "balanced", "detailed"]>>;
        technicalLevel: z.ZodOptional<z.ZodEnum<["beginner", "intermediate", "advanced", "expert"]>>;
        defaultDistro: z.ZodOptional<z.ZodString>;
        defaultShell: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodEnum<["small", "medium", "large"]>>;
        showAgentCards: z.ZodOptional<z.ZodBoolean>;
        autoApproveLowRisk: z.ZodOptional<z.ZodBoolean>;
        compactMode: z.ZodOptional<z.ZodBoolean>;
        showCitationsInline: z.ZodOptional<z.ZodBoolean>;
        explainBeforeCommands: z.ZodOptional<z.ZodBoolean>;
        includeAlternatives: z.ZodOptional<z.ZodBoolean>;
        warnAboutSideEffects: z.ZodOptional<z.ZodBoolean>;
        customInstructions: z.ZodOptional<z.ZodString>;
        memory: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        docSources: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        defaultDistro?: string | undefined;
        defaultShell?: string | undefined;
        responseStyle?: "concise" | "balanced" | "detailed" | undefined;
        technicalLevel?: "beginner" | "intermediate" | "advanced" | "expert" | undefined;
        fontSize?: "medium" | "small" | "large" | undefined;
        showAgentCards?: boolean | undefined;
        autoApproveLowRisk?: boolean | undefined;
        compactMode?: boolean | undefined;
        showCitationsInline?: boolean | undefined;
        explainBeforeCommands?: boolean | undefined;
        includeAlternatives?: boolean | undefined;
        warnAboutSideEffects?: boolean | undefined;
        customInstructions?: string | undefined;
        memory?: Record<string, unknown> | undefined;
        docSources?: string[] | undefined;
    }, {
        defaultDistro?: string | undefined;
        defaultShell?: string | undefined;
        responseStyle?: "concise" | "balanced" | "detailed" | undefined;
        technicalLevel?: "beginner" | "intermediate" | "advanced" | "expert" | undefined;
        fontSize?: "medium" | "small" | "large" | undefined;
        showAgentCards?: boolean | undefined;
        autoApproveLowRisk?: boolean | undefined;
        compactMode?: boolean | undefined;
        showCitationsInline?: boolean | undefined;
        explainBeforeCommands?: boolean | undefined;
        includeAlternatives?: boolean | undefined;
        warnAboutSideEffects?: boolean | undefined;
        customInstructions?: string | undefined;
        memory?: Record<string, unknown> | undefined;
        docSources?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        defaultDistro?: string | undefined;
        defaultShell?: string | undefined;
        responseStyle?: "concise" | "balanced" | "detailed" | undefined;
        technicalLevel?: "beginner" | "intermediate" | "advanced" | "expert" | undefined;
        fontSize?: "medium" | "small" | "large" | undefined;
        showAgentCards?: boolean | undefined;
        autoApproveLowRisk?: boolean | undefined;
        compactMode?: boolean | undefined;
        showCitationsInline?: boolean | undefined;
        explainBeforeCommands?: boolean | undefined;
        includeAlternatives?: boolean | undefined;
        warnAboutSideEffects?: boolean | undefined;
        customInstructions?: string | undefined;
        memory?: Record<string, unknown> | undefined;
        docSources?: string[] | undefined;
    };
}, {
    body: {
        defaultDistro?: string | undefined;
        defaultShell?: string | undefined;
        responseStyle?: "concise" | "balanced" | "detailed" | undefined;
        technicalLevel?: "beginner" | "intermediate" | "advanced" | "expert" | undefined;
        fontSize?: "medium" | "small" | "large" | undefined;
        showAgentCards?: boolean | undefined;
        autoApproveLowRisk?: boolean | undefined;
        compactMode?: boolean | undefined;
        showCitationsInline?: boolean | undefined;
        explainBeforeCommands?: boolean | undefined;
        includeAlternatives?: boolean | undefined;
        warnAboutSideEffects?: boolean | undefined;
        customInstructions?: string | undefined;
        memory?: Record<string, unknown> | undefined;
        docSources?: string[] | undefined;
    };
}>;
export declare const mongoIdSchema: z.ZodString;
/**
 * Helper to validate request data
 */
export declare function validateOrThrow<T extends z.ZodSchema>(schema: T, data: unknown): z.infer<T>;
/**
 * Type for Fastify request validation
 */
export type ValidationSchema = {
    body?: z.ZodSchema;
    querystring?: z.ZodSchema;
    params?: z.ZodSchema;
    headers?: z.ZodSchema;
};
//# sourceMappingURL=schemas.d.ts.map