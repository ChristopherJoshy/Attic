import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const envSchema = z.object({
    OPENROUTER_API_KEY: z.string().min(1),
    OPENROUTER_MODEL: z.string().default('nvidia/nemotron-3-nano-30b-a3b:free'),
    OPENROUTER_SITE_URL: z.string().url().optional(),
    OPENROUTER_SITE_NAME: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    SEARXNG_URL: z.string().url().default('http://localhost:8080'),
    TAVILY_API_KEY: z.string().optional(),
    SEARCH_PROVIDER: z.enum(['searxng', 'tavily']).default('searxng'),
    VECTOR_PROVIDER: z.enum(['pinecone', 'qdrant']).default('pinecone'),
    PINECONE_API_KEY: z.string().optional(),
    PINECONE_INDEX: z.string().default('orito-rag'),
    QDRANT_URL: z.string().url().optional(),
    MONGODB_URI: z.string().default('mongodb://localhost:27017/orito'),
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().default('./firebase-credentials.json'),
    JWT_SECRET: z.string().min(32),
    GOOGLE_FORM_PRO_URL: z.string().url().optional(),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    SUPER_ADMIN_EMAIL: z.string().email().default('chriss@orito.ai'),
    CACHE_TTL_SECONDS: z.coerce.number().default(300),
    CACHE_MAX_ENTRIES: z.coerce.number().default(500),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}
export const config = parsed.data;
export const TIER_LIMITS = {
    trial: {
        requestsTotal: 12,
        requestsPerMinute: Infinity,
        imagesPerDay: 0,
        searchesPerMinute: 5,
        maxConcurrentAgents: 2,
        persistChats: false,
        geminiImageAnalysis: 0,
    },
    free: {
        requestsTotal: Infinity,
        requestsPerMinute: 40,
        imagesPerDay: 5,
        searchesPerMinute: 20,
        maxConcurrentAgents: 2,
        persistChats: true,
        geminiImageAnalysis: 5,
    },
    pro: {
        requestsTotal: Infinity,
        requestsPerMinute: Infinity,
        imagesPerDay: Infinity,
        searchesPerMinute: Infinity,
        maxConcurrentAgents: Infinity,
        persistChats: true,
        geminiImageAnalysis: Infinity,
    },
};
//# sourceMappingURL=index.js.map