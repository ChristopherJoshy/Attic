import type { FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../models/user.js';
import { PlanOverride } from '../models/plan-override.js';

/**
 * Middleware to require admin access.
 * Must be called after JWT verification (request.user must be populated).
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { userId: string | null; isAdmin: boolean; tier?: string };

    if (!user?.userId) {
        reply.code(401).send({ error: 'Authentication required' });
        return;
    }

    if (!user.isAdmin) {
        request.log.warn({
            event: 'admin_access_denied',
            user: { userId: user.userId },
            path: request.url,
            method: request.method,
            ip: request.ip,
        }, 'Non-admin user attempted admin access');
        reply.code(403).send({ error: 'Admin access required' });
        return;
    }

    // After verifying isAdmin, ensure they have appropriate tier
    // Admins should have unrestricted access, so we ensure they have 'pro' or 'admin' tier
    if (user.tier !== 'pro' && user.tier !== 'admin') {
        request.log.info({ 
            userId: user.userId, 
            tier: user.tier 
        }, 'Admin user has restricted tier - checking for override');
        
        // Check if there's an active override
        const activeOverride = await PlanOverride.findOne({
            userId: user.userId,
            isActive: true,
            $or: [
                { expiresAt: { $gt: new Date() } },
                { expiresAt: null },
                { isPermanent: true }
            ],
        });

        if (!activeOverride) {
            request.log.warn({ 
                userId: user.userId, 
                tier: user.tier 
            }, 'Admin user does not have Pro/Admin tier and no override - auto-upgrading');
            
            // Auto-fix in background - give them pro tier
            User.findByIdAndUpdate(user.userId, { tier: 'pro' }).catch(err => {
                request.log.error({ err, userId: user.userId }, 'Failed to auto-upgrade admin tier');
            });
        }
    }
}

/**
 * Middleware to check if user has plan override capabilities.
 * This is used for routes that need to verify plan-based access.
 */
export async function checkPlanOverride(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { userId: string | null; isAdmin: boolean; tier?: string };

    if (!user?.userId) {
        reply.code(401).send({ error: 'Authentication required' });
        return;
    }

    // Admins bypass all plan restrictions
    if (user.isAdmin) {
        return;
    }

    // Check for active plan override
    const activeOverride = await PlanOverride.findOne({
        userId: user.userId,
        isActive: true,
        $or: [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: null },
            { isPermanent: true }
        ],
    });

    if (activeOverride) {
        // User has an active override, update their tier in the request
        (request.user as any).effectiveTier = activeOverride.newTier;
    }
}

/**
 * Helper function to get effective tier for a user.
 * Returns the override tier if active, otherwise returns the user's actual tier.
 */
export async function getEffectiveTier(userId: string, actualTier: string): Promise<string> {
    const activeOverride = await PlanOverride.findOne({
        userId,
        isActive: true,
        $or: [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: null },
            { isPermanent: true }
        ],
    });

    return activeOverride?.newTier || actualTier;
}
