export declare const config: {
    OPENROUTER_API_KEY: string;
    OPENROUTER_MODEL: string;
    SEARXNG_URL: string;
    SEARCH_PROVIDER: "searxng" | "tavily";
    VECTOR_PROVIDER: "pinecone" | "qdrant";
    PINECONE_INDEX: string;
    MONGODB_URI: string;
    FIREBASE_PROJECT_ID: string;
    FIREBASE_SERVICE_ACCOUNT_PATH: string;
    JWT_SECRET: string;
    CORS_ORIGIN: string;
    PORT: number;
    NODE_ENV: "development" | "production" | "test";
    SUPER_ADMIN_EMAIL: string;
    CACHE_TTL_SECONDS: number;
    CACHE_MAX_ENTRIES: number;
    OPENROUTER_SITE_URL?: string | undefined;
    OPENROUTER_SITE_NAME?: string | undefined;
    GEMINI_API_KEY?: string | undefined;
    TAVILY_API_KEY?: string | undefined;
    PINECONE_API_KEY?: string | undefined;
    QDRANT_URL?: string | undefined;
    GOOGLE_FORM_PRO_URL?: string | undefined;
};
export declare const TIER_LIMITS: {
    readonly trial: {
        readonly requestsTotal: 12;
        readonly requestsPerMinute: number;
        readonly imagesPerDay: 0;
        readonly searchesPerMinute: 5;
        readonly maxConcurrentAgents: 2;
        readonly persistChats: false;
        readonly geminiImageAnalysis: 0;
    };
    readonly free: {
        readonly requestsTotal: number;
        readonly requestsPerMinute: 40;
        readonly imagesPerDay: 5;
        readonly searchesPerMinute: 20;
        readonly maxConcurrentAgents: 2;
        readonly persistChats: true;
        readonly geminiImageAnalysis: 5;
    };
    readonly pro: {
        readonly requestsTotal: number;
        readonly requestsPerMinute: number;
        readonly imagesPerDay: number;
        readonly searchesPerMinute: number;
        readonly maxConcurrentAgents: number;
        readonly persistChats: true;
        readonly geminiImageAnalysis: number;
    };
};
export type Tier = keyof typeof TIER_LIMITS;
//# sourceMappingURL=index.d.ts.map