import { FastifyInstance } from 'fastify';
import { getOrCreateUsage } from '../models/usage.js';
import { TIER_LIMITS } from '../config/index.js';
import { User } from '../models/user.js';
import { requireAdmin } from '../middleware/admin.js';
import {
    getUsageSummary,
    getDetailedUsage,
    getAllUsersSummary,
    exportUsageAsJson,
    exportUsageAsCsv,
    getRealtimeUsage,
    formatCost,
} from '../services/usage-tracker.js';

interface AgentMetrics {
    agentId: string;
    agentType: string;
    tokensUsed: number;
    modelName?: string;
}

// Query parameter schemas
interface UsageQuery {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}

interface ExportQuery {
    startDate?: string;
    endDate?: string;
    format?: 'json' | 'csv';
}

export default async function usageRoutes(app: FastifyInstance) {
    // GET /api/v1/usage - Get user's own usage statistics (enhanced)
    app.get('/', {
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            try {
                const { userId } = request.user as { userId: string | null };
                
                if (!userId) {
                    return reply.code(401).send({ 
                        error: 'Unauthorized',
                        message: 'Authentication required' 
                    });
                }

                // Fetch the user to get tier information
                const user = await User.findById(userId);
                if (!user) {
                    return reply.code(404).send({ 
                        error: 'NotFound',
                        message: 'User not found' 
                    });
                }

                const query = request.query as UsageQuery;
                const startDate = query.startDate ? new Date(query.startDate) : undefined;
                const endDate = query.endDate ? new Date(query.endDate) : undefined;

                // Get enhanced usage summary
                const usageSummary = await getUsageSummary(userId, startDate, endDate);
                const legacyUsage = await getOrCreateUsage(user._id.toString(), 'user');
                const limits = TIER_LIMITS[user.tier];
                const realtimeUsage = await getRealtimeUsage(userId);

                return reply.send({
                    // Legacy fields for backward compatibility
                    month: legacyUsage.month,
                    requestCount: legacyUsage.requestCount,
                    imageCount: legacyUsage.imageCount,
                    geminiImageCount: legacyUsage.geminiImageCount,
                    searchCount: legacyUsage.searchCount,
                    
                    // Enhanced usage data
                    summary: {
                        totalRequests: usageSummary.totalRequests,
                        successfulRequests: usageSummary.successfulRequests,
                        failedRequests: usageSummary.failedRequests,
                        totalInputTokens: usageSummary.totalInputTokens,
                        totalOutputTokens: usageSummary.totalOutputTokens,
                        totalTokens: usageSummary.totalTokens,
                        totalCost: usageSummary.totalCost,
                        formattedCost: usageSummary.formattedCost,
                        avgLatencyMs: usageSummary.avgLatencyMs,
                    },
                    
                    // Real-time stats
                    realtime: {
                        today: {
                            ...realtimeUsage.today,
                            formattedCost: formatCost(realtimeUsage.today.cost),
                        },
                        thisMonth: {
                            ...realtimeUsage.thisMonth,
                            formattedCost: formatCost(realtimeUsage.thisMonth.cost),
                        },
                    },
                    
                    // Limits
                    limits: {
                        requestsTotal: limits.requestsTotal === Infinity ? 'unlimited' : limits.requestsTotal,
                        requestsPerMinute: limits.requestsPerMinute === Infinity ? 'unlimited' : limits.requestsPerMinute,
                        geminiImageAnalysis: limits.geminiImageAnalysis === Infinity ? 'unlimited' : limits.geminiImageAnalysis,
                        searchesPerMinute: limits.searchesPerMinute === Infinity ? 'unlimited' : limits.searchesPerMinute,
                    },
                    tier: user.tier,
                });
            } catch (error) {
                app.log.error({ error }, 'Failed to fetch usage stats');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to fetch usage statistics' 
                });
            }
        },
    });

    // GET /api/v1/usage/current - Get current month's usage (legacy endpoint)
    app.get('/current', {
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            try {
                const { userId } = request.user as { userId: string | null };
                
                if (!userId) {
                    return reply.code(401).send({ 
                        error: 'Unauthorized',
                        message: 'Authentication required' 
                    });
                }

                const user = await User.findById(userId);
                if (!user) {
                    return reply.code(404).send({ 
                        error: 'NotFound',
                        message: 'User not found' 
                    });
                }

                const usage = await getOrCreateUsage(user._id.toString(), 'user');
                const limits = TIER_LIMITS[user.tier];
                const usageSummary = await getUsageSummary(userId);

                return reply.send({
                    month: usage.month,
                    requestCount: usage.requestCount,
                    imageCount: usage.imageCount,
                    geminiImageCount: usage.geminiImageCount,
                    searchCount: usage.searchCount,
                    totalTokens: usageSummary.totalTokens > 0 ? usageSummary.totalTokens : undefined,
                    estimatedCost: usageSummary.totalCost > 0 ? usageSummary.totalCost : undefined,
                    limits: {
                        requestsTotal: limits.requestsTotal === Infinity ? 'unlimited' : limits.requestsTotal,
                        requestsPerMinute: limits.requestsPerMinute === Infinity ? 'unlimited' : limits.requestsPerMinute,
                        geminiImageAnalysis: limits.geminiImageAnalysis === Infinity ? 'unlimited' : limits.geminiImageAnalysis,
                        searchesPerMinute: limits.searchesPerMinute === Infinity ? 'unlimited' : limits.searchesPerMinute,
                    },
                    tier: user.tier,
                    modelBreakdown: usageSummary.byModel.length > 0 
                        ? Object.fromEntries(usageSummary.byModel.map(m => [m.model, { 
                            tokens: m.totalTokens, 
                            requests: m.count, 
                            cost: m.totalCost 
                        }])) 
                        : undefined,
                    agentBreakdown: usageSummary.byAgent.length > 0 
                        ? Object.fromEntries(usageSummary.byAgent.map(a => [a.agentType, { 
                            tokens: a.totalTokens 
                        }])) 
                        : undefined,
                });
            } catch (error) {
                app.log.error({ error }, 'Failed to fetch usage stats');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to fetch usage statistics' 
                });
            }
        },
    });

    // GET /api/v1/usage/details - Get detailed usage breakdown
    app.get('/details', {
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            try {
                const { userId } = request.user as { userId: string | null };
                
                if (!userId) {
                    return reply.code(401).send({ 
                        error: 'Unauthorized',
                        message: 'Authentication required' 
                    });
                }

                const query = request.query as UsageQuery;
                const startDate = query.startDate ? new Date(query.startDate) : undefined;
                const endDate = query.endDate ? new Date(query.endDate) : undefined;
                const limit = query.limit ?? 100;
                const offset = query.offset ?? 0;

                const { records, total } = await getDetailedUsage(userId, startDate, endDate, limit, offset);

                return reply.send({
                    records: records.map(r => ({
                        id: r._id,
                        timestamp: r.timestamp,
                        sessionId: r.sessionId,
                        agentType: r.agentType,
                        model: r.model,
                        provider: r.provider,
                        inputTokens: r.inputTokens,
                        outputTokens: r.outputTokens,
                        totalTokens: r.totalTokens,
                        latencyMs: r.latencyMs,
                        apiKeyType: r.apiKeyType,
                        success: r.success,
                        errorMessage: r.errorMessage,
                        cost: r.cost,
                        formattedCost: formatCost(r.cost),
                    })),
                    pagination: {
                        total,
                        limit,
                        offset,
                        hasMore: offset + limit < total,
                    },
                });
            } catch (error) {
                app.log.error({ error }, 'Failed to fetch detailed usage');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to fetch detailed usage' 
                });
            }
        },
    });

    // GET /api/v1/usage/by-agent - Usage grouped by agent type
    app.get('/by-agent', {
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            try {
                const { userId } = request.user as { userId: string | null };
                
                if (!userId) {
                    return reply.code(401).send({ 
                        error: 'Unauthorized',
                        message: 'Authentication required' 
                    });
                }

                const query = request.query as UsageQuery;
                const startDate = query.startDate ? new Date(query.startDate) : undefined;
                const endDate = query.endDate ? new Date(query.endDate) : undefined;

                const usageSummary = await getUsageSummary(userId, startDate, endDate);

                return reply.send({
                    byAgent: usageSummary.byAgent,
                    total: {
                        requests: usageSummary.byAgent.reduce((sum, a) => sum + a.count, 0),
                        tokens: usageSummary.byAgent.reduce((sum, a) => sum + a.totalTokens, 0),
                        cost: usageSummary.byAgent.reduce((sum, a) => sum + a.totalCost, 0),
                    },
                });
            } catch (error) {
                app.log.error({ error }, 'Failed to fetch usage by agent');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to fetch usage by agent' 
                });
            }
        },
    });

    // GET /api/v1/usage/by-model - Usage grouped by model
    app.get('/by-model', {
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            try {
                const { userId } = request.user as { userId: string | null };
                
                if (!userId) {
                    return reply.code(401).send({ 
                        error: 'Unauthorized',
                        message: 'Authentication required' 
                    });
                }

                const query = request.query as UsageQuery;
                const startDate = query.startDate ? new Date(query.startDate) : undefined;
                const endDate = query.endDate ? new Date(query.endDate) : undefined;

                const usageSummary = await getUsageSummary(userId, startDate, endDate);

                return reply.send({
                    byModel: usageSummary.byModel,
                    total: {
                        requests: usageSummary.byModel.reduce((sum, m) => sum + m.count, 0),
                        inputTokens: usageSummary.byModel.reduce((sum, m) => sum + m.inputTokens, 0),
                        outputTokens: usageSummary.byModel.reduce((sum, m) => sum + m.outputTokens, 0),
                        tokens: usageSummary.byModel.reduce((sum, m) => sum + m.totalTokens, 0),
                        cost: usageSummary.byModel.reduce((sum, m) => sum + m.totalCost, 0),
                    },
                });
            } catch (error) {
                app.log.error({ error }, 'Failed to fetch usage by model');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to fetch usage by model' 
                });
            }
        },
    });

    // GET /api/v1/usage/timeline - Usage timeline
    app.get('/timeline', {
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            try {
                const { userId } = request.user as { userId: string | null };
                
                if (!userId) {
                    return reply.code(401).send({ 
                        error: 'Unauthorized',
                        message: 'Authentication required' 
                    });
                }

                const query = request.query as UsageQuery;
                const startDate = query.startDate ? new Date(query.startDate) : undefined;
                const endDate = query.endDate ? new Date(query.endDate) : undefined;

                const usageSummary = await getUsageSummary(userId, startDate, endDate);

                return reply.send({
                    timeline: usageSummary.timeline,
                    total: {
                        requests: usageSummary.timeline.reduce((sum, t) => sum + t.requests, 0),
                        tokens: usageSummary.timeline.reduce((sum, t) => sum + t.totalTokens, 0),
                        cost: usageSummary.timeline.reduce((sum, t) => sum + t.totalCost, 0),
                    },
                });
            } catch (error) {
                app.log.error({ error }, 'Failed to fetch usage timeline');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to fetch usage timeline' 
                });
            }
        },
    });

    // GET /api/v1/usage/export - Export usage data as CSV/JSON
    app.get('/export', {
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            try {
                const { userId } = request.user as { userId: string | null };
                
                if (!userId) {
                    return reply.code(401).send({ 
                        error: 'Unauthorized',
                        message: 'Authentication required' 
                    });
                }

                const query = request.query as ExportQuery;
                const startDate = query.startDate ? new Date(query.startDate) : undefined;
                const endDate = query.endDate ? new Date(query.endDate) : undefined;
                const format = query.format ?? 'json';

                if (format === 'csv') {
                    const csv = await exportUsageAsCsv(userId, startDate, endDate);
                    
                    reply.header('Content-Type', 'text/csv');
                    reply.header('Content-Disposition', `attachment; filename="usage-export-${new Date().toISOString().split('T')[0]}.csv"`);
                    return reply.send(csv);
                } else {
                    const json = await exportUsageAsJson(userId, startDate, endDate);
                    
                    reply.header('Content-Type', 'application/json');
                    reply.header('Content-Disposition', `attachment; filename="usage-export-${new Date().toISOString().split('T')[0]}.json"`);
                    return reply.send(json);
                }
            } catch (error) {
                app.log.error({ error }, 'Failed to export usage data');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to export usage data' 
                });
            }
        },
    });

    // GET /api/v1/usage/realtime - Get real-time usage stats
    app.get('/realtime', {
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            try {
                const { userId } = request.user as { userId: string | null };
                
                if (!userId) {
                    return reply.code(401).send({ 
                        error: 'Unauthorized',
                        message: 'Authentication required' 
                    });
                }

                const realtimeUsage = await getRealtimeUsage(userId);

                return reply.send({
                    today: {
                        ...realtimeUsage.today,
                        formattedCost: formatCost(realtimeUsage.today.cost),
                    },
                    thisMonth: {
                        ...realtimeUsage.thisMonth,
                        formattedCost: formatCost(realtimeUsage.thisMonth.cost),
                    },
                });
            } catch (error) {
                app.log.error({ error }, 'Failed to fetch realtime usage');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to fetch realtime usage' 
                });
            }
        },
    });

    // ============= Admin Routes =============

    // GET /api/v1/usage/admin/all - Get all users' usage (admin only)
    app.get('/admin/all', {
        preHandler: [app.authenticate, requireAdmin],
        handler: async (request, reply) => {
            try {
                const query = request.query as UsageQuery & { userId?: string };
                const startDate = query.startDate ? new Date(query.startDate) : undefined;
                const endDate = query.endDate ? new Date(query.endDate) : undefined;
                const limit = query.limit ?? 100;
                const offset = query.offset ?? 0;

                // If userId is specified, get that user's usage
                if (query.userId) {
                    const usageSummary = await getUsageSummary(query.userId, startDate, endDate, false);
                    const user = await User.findById(query.userId);
                    
                    return reply.send({
                        userId: query.userId,
                        email: user?.email,
                        tier: user?.tier,
                        ...usageSummary,
                    });
                }

                // Otherwise, get all users' usage
                const allUsers = await getAllUsersSummary(startDate, endDate, limit, offset);

                return reply.send({
                    users: allUsers,
                    pagination: {
                        limit,
                        offset,
                    },
                });
            } catch (error) {
                app.log.error({ error }, 'Failed to fetch all users usage');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to fetch all users usage' 
                });
            }
        },
    });

    // GET /api/v1/usage/admin/user/:userId - Get specific user's usage (admin only)
    app.get('/admin/user/:userId', {
        preHandler: [app.authenticate, requireAdmin],
        handler: async (request, reply) => {
            try {
                const { userId } = request.params as { userId: string };
                const query = request.query as UsageQuery;
                const startDate = query.startDate ? new Date(query.startDate) : undefined;
                const endDate = query.endDate ? new Date(query.endDate) : undefined;

                const user = await User.findById(userId);
                if (!user) {
                    return reply.code(404).send({ 
                        error: 'NotFound',
                        message: 'User not found' 
                    });
                }

                const usageSummary = await getUsageSummary(userId, startDate, endDate, false);

                return reply.send({
                    userId,
                    email: user.email,
                    tier: user.tier,
                    createdAt: user.createdAt,
                    ...usageSummary,
                });
            } catch (error) {
                app.log.error({ error }, 'Failed to fetch user usage');
                return reply.code(500).send({ 
                    error: 'InternalServerError',
                    message: 'Failed to fetch user usage' 
                });
            }
        },
    });
}