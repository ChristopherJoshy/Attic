import { User } from '../models/user.js';
import { PlanOverride } from '../models/plan-override.js';
import { requireAdmin } from '../middleware/admin.js';
export async function adminRoutes(app) {
    // All routes require admin
    app.addHook('preHandler', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        await requireAdmin(request, reply);
    });
    // GET /api/v1/admin/users/lookup?email=... - Find user by email
    app.get('/api/v1/admin/users/lookup', async (request, reply) => {
        const { email } = request.query;
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return reply.status(400).send({ error: 'Valid email is required' });
        }
        const user = await User.findOne({ email: email.toLowerCase() }).select('_id email name tier isAdmin lastLogin createdAt');
        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Check for active plan override
        const activeOverride = await PlanOverride.findOne({
            userId: user._id,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });
        return {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                tier: user.tier,
                isAdmin: user.isAdmin,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt,
            },
            activeOverride: activeOverride ? {
                id: activeOverride._id,
                originalTier: activeOverride.originalTier,
                newTier: activeOverride.newTier,
                grantedAt: activeOverride.grantedAt,
                expiresAt: activeOverride.expiresAt,
                reason: activeOverride.reason,
            } : null,
        };
    });
    // PATCH /api/v1/admin/users/:userId/plan - Change user plan
    app.patch('/api/v1/admin/users/:userId/plan', async (request, reply) => {
        const { userId } = request.params;
        const { newTier, duration, reason } = request.body;
        // Validate inputs
        if (!['free', 'pro'].includes(newTier)) {
            return reply.status(400).send({ error: 'Invalid tier. Must be "free" or "pro"' });
        }
        if (!duration) {
            return reply.status(400).send({ error: 'Duration is required' });
        }
        // Calculate expiry date
        const now = new Date();
        let expiresAt;
        switch (duration) {
            case '1w':
                expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;
            case '1m':
                expiresAt = new Date(now.setMonth(now.getMonth() + 1));
                break;
            case '3m':
                expiresAt = new Date(now.setMonth(now.getMonth() + 3));
                break;
            case '6m':
                expiresAt = new Date(now.setMonth(now.getMonth() + 6));
                break;
            case '1y':
                expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
                break;
            default: {
                // Try parsing as ISO date
                const parsed = new Date(duration);
                if (isNaN(parsed.getTime()) || parsed <= new Date()) {
                    return reply.status(400).send({ error: 'Invalid duration. Use 1w, 1m, 3m, 6m, 1y, or a future ISO date' });
                }
                expiresAt = parsed;
            }
        }
        // Find the target user
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Prevent modifying own plan
        const adminUser = request.user;
        if (targetUser._id.toString() === adminUser.userId) {
            return reply.status(400).send({ error: 'Cannot modify your own plan' });
        }
        // Deactivate any existing active override
        await PlanOverride.updateMany({ userId: targetUser._id, isActive: true }, { $set: { isActive: false, revokedAt: new Date() } });
        // Create new override
        const override = new PlanOverride({
            userId: targetUser._id,
            originalTier: targetUser.tier,
            newTier,
            grantedBy: adminUser.userId,
            expiresAt,
            reason: reason || '',
        });
        await override.save();
        // Update user's tier
        targetUser.tier = newTier;
        await targetUser.save();
        return {
            success: true,
            override: {
                id: override._id,
                userId: targetUser._id,
                userName: targetUser.name,
                userEmail: targetUser.email,
                originalTier: override.originalTier,
                newTier: override.newTier,
                expiresAt: override.expiresAt,
                reason: override.reason,
            },
        };
    });
    // DELETE /api/v1/admin/users/:userId/plan - Revoke plan override
    app.delete('/api/v1/admin/users/:userId/plan', async (request, reply) => {
        const { userId } = request.params;
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Find active override
        const activeOverride = await PlanOverride.findOne({
            userId: targetUser._id,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });
        if (!activeOverride) {
            return reply.status(404).send({ error: 'No active plan override found' });
        }
        // Deactivate override
        activeOverride.isActive = false;
        activeOverride.revokedAt = new Date();
        await activeOverride.save();
        // Revert user's tier
        targetUser.tier = activeOverride.originalTier;
        await targetUser.save();
        return {
            success: true,
            message: `Plan reverted to ${activeOverride.originalTier} for ${targetUser.email}`,
        };
    });
}
//# sourceMappingURL=admin.js.map