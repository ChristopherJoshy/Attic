import { User } from '../models/user.js';
/**
 * Middleware to require admin access.
 * Must be called after JWT verification (request.user must be populated).
 */
export async function requireAdmin(request, reply) {
    const user = request.user;
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
    // After verifying isAdmin, also check tier
    if (user.tier !== 'pro') {
        request.log.warn({
            userId: user.userId,
            tier: user.tier
        }, 'Admin user does not have Pro tier - auto-upgrading');
        // Auto-fix in background
        User.findByIdAndUpdate(user.userId, { tier: 'pro' }).catch(err => {
            request.log.error({ err, userId: user.userId }, 'Failed to auto-upgrade admin tier');
        });
    }
}
//# sourceMappingURL=admin.js.map