import dotenv from 'dotenv';
import { z } from 'zod';
import { DEFAULT_MODEL } from './models.js';

dotenv.config();

const envSchema = z.object({
    OPENROUTER_API_KEY: z.string().min(1),
    OPENROUTER_MODEL: z.string().default(DEFAULT_MODEL),
    OPENROUTER_SITE_URL: z.string().url().optional(),
    OPENROUTER_SITE_NAME: z.string().optional(),

    GEMINI_API_KEY: z.string().optional(),

    // SearXNG Configuration
    SEARXNG_URL: z.string().url().default('http://localhost:8080'),
    SEARXNG_ENABLED: z.coerce.boolean().default(true),
    SEARXNG_AUTO_START: z.coerce.boolean().default(true),
    SEARXNG_PORT: z.coerce.number().default(8080),
    SEARXNG_INSTANCE_TYPE: z.enum(['local', 'remote']).default('local'),
    SEARXNG_HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
    SEARXNG_HEALTH_CHECK_TIMEOUT: z.coerce.number().default(5000),
    SEARXNG_MAX_RESTART_ATTEMPTS: z.coerce.number().default(3),
    SEARXNG_RESTART_COOLDOWN: z.coerce.number().default(5000),
    
    // Tavily fallback
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

    // Super admin email - must be explicitly configured via environment variable
    // No hardcoded default for security reasons
    SUPER_ADMIN_EMAIL: z.string().email().optional(),

    // Cache Configuration
    CACHE_ENABLED: z.coerce.boolean().default(true),
    CACHE_DEFAULT_TTL: z.coerce.number().default(300), // Default TTL in seconds
    CACHE_MAX_SIZE: z.coerce.number().default(500), // Maximum cache size
    CACHE_STRATEGY: z.enum(['lru', 'lfu', 'simple']).default('lru'),
    CACHE_TTL_SECONDS: z.coerce.number().default(300), // Alias for CACHE_DEFAULT_TTL
    CACHE_MAX_ENTRIES: z.coerce.number().default(500), // Alias for CACHE_MAX_SIZE
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
} as const;

export type Tier = keyof typeof TIER_LIMITS;
