import { TIER_LIMITS } from '../config/index.js';
import { getOrCreateUsage } from '../models/usage.js';
/**
 * Middleware to check and enforce tier-based rate limits
 */
export async function tierMiddleware(request, reply) {
    const user = request.user;
    if (!user) {
        reply.code(401).send({ error: 'No session' });
        return;
    }
    const tier = user.tier || 'trial';
    const limits = TIER_LIMITS[tier];
    // Determine identifier (userId for logged in users, sessionId for trial)
    const identifier = user.userId || user.sessionId;
    const identifierType = user.userId ? 'user' : 'session';
    try {
        const usage = await getOrCreateUsage(identifier, identifierType);
        const requestCount = usage.requestCount;
        // Check if request limit exceeded for trial tier
        if (limits.requestsTotal !== Infinity && requestCount >= limits.requestsTotal) {
            request.log.warn({
                event: 'rate_limit_exceeded',
                user: { identifier, tier },
                limits: { total: limits.requestsTotal, used: requestCount }
            }, 'Rate limit exceeded');
            reply.code(429).send({
                error: 'Rate limit exceeded',
                message: `You have used all ${limits.requestsTotal} requests for this month. Please upgrade to continue.`,
                currentUsage: requestCount,
                limit: limits.requestsTotal,
                tier
            });
            return;
        }
        // Attach tier info to request for use in route handlers
        request.tierInfo = {
            tier,
            limits,
            requestCount,
            identifier,
            identifierType
        };
    }
    catch (error) {
        request.log.error({
            event: 'tier_middleware_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Error in tier middleware');
        // Allow request to proceed on error (fail open)
        request.tierInfo = {
            tier,
            limits,
            requestCount: 0,
            identifier,
            identifierType
        };
    }
}
/**
 * Middleware to increment request count after successful request
 */
export async function incrementRequestCountMiddleware(request, reply) {
    if (!request.tierInfo)
        return;
    const { identifier, identifierType } = request.tierInfo;
    try {
        const { incrementRequestCount } = await import('../models/usage.js');
        await incrementRequestCount(identifier, identifierType);
    }
    catch (error) {
        request.log.error({
            event: 'increment_usage_error',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Error incrementing request count');
    }
}
/**
 * Helper function to require specific tier(s)
 */
export function requireTier(...allowed) {
    return async (request, reply) => {
        if (!request.tierInfo) {
            reply.code(401).send({ error: 'No tier info available' });
            return;
        }
        const { tier } = request.tierInfo;
        if (!allowed.includes(tier)) {
            reply.code(403).send({
                error: 'Upgrade required',
                currentTier: tier,
                requiredTiers: allowed
            });
            return;
        }
    };
}
//# sourceMappingURL=tier.js.map