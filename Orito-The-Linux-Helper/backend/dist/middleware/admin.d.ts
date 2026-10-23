import type { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Middleware to require admin access.
 * Must be called after JWT verification (request.user must be populated).
 */
export declare function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=admin.d.ts.map