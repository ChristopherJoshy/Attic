import type { FastifyRequest, FastifyReply } from 'fastify';
import { TIER_LIMITS, type Tier } from '../config/index.js';
export interface TierInfo {
    tier: Tier;
    limits: typeof TIER_LIMITS[Tier];
    requestCount: number;
    identifier: string;
    identifierType: 'user' | 'session';
}
declare module 'fastify' {
    interface FastifyRequest {
        tierInfo?: TierInfo;
    }
}
/**
 * Middleware to check and enforce tier-based rate limits
 */
export declare function tierMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Middleware to increment request count after successful request
 */
export declare function incrementRequestCountMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Helper function to require specific tier(s)
 */
export declare function requireTier(...allowed: Tier[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
//# sourceMappingURL=tier.d.ts.map