import { getOrCreateUsage } from '../models/usage.js';
import { TIER_LIMITS } from '../config/index.js';
import { User } from '../models/user.js';
import { Chat } from '../models/chat.js';
// Approximate token costs per 1K tokens (these are estimates)
const MODEL_COSTS = {
    'nvidia/nemotron-3-nano-30b-a3b': { input: 0.0001, output: 0.0002 },
    'nvidia/nemotron-3-nano-30b-a3b:free': { input: 0, output: 0 },
    'google/gemini-flash-1.5': { input: 0.000075, output: 0.0003 },
    'anthropic/claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'meta-llama/llama-3.1-70b-instruct': { input: 0.0004, output: 0.0008 },
    'qwen/qwen-2.5-72b-instruct': { input: 0.0004, output: 0.0006 },
};
export default async function usageRoutes(app) {
    // GET /api/v1/usage/current - Get current month's usage
    app.get('/current', {
        preHandler: [app.authenticate],
        handler: async (request, reply) => {
            try {
                const { userId } = request.user;
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
                const usage = await getOrCreateUsage(user._id.toString(), 'user');
                const limits = TIER_LIMITS[user.tier];
                // Aggregate token usage from recent chats
                const recentChats = await Chat.find({
                    userId: user._id,
                    updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
                }).select('messages');
                // Calculate token totals and model breakdown
                let totalTokens = 0;
                const modelBreakdown = {};
                const agentBreakdown = {};
                for (const chat of recentChats) {
                    for (const message of (chat.messages || [])) {
                        // Count tokens from agent events
                        if (message.agentEvents) {
                            for (const event of message.agentEvents) {
                                if (event.type === 'message:done' && event.agentMetrics) {
                                    for (const metric of event.agentMetrics) {
                                        const tokens = metric.tokensUsed || 0;
                                        totalTokens += tokens;
                                        // Agent breakdown
                                        if (metric.agentType) {
                                            if (!agentBreakdown[metric.agentType]) {
                                                agentBreakdown[metric.agentType] = { tokens: 0 };
                                            }
                                            agentBreakdown[metric.agentType].tokens += tokens;
                                        }
                                        // Model breakdown
                                        const modelName = metric.modelName || 'unknown';
                                        if (!modelBreakdown[modelName]) {
                                            modelBreakdown[modelName] = { tokens: 0, requests: 0, cost: 0 };
                                        }
                                        modelBreakdown[modelName].tokens += tokens;
                                        modelBreakdown[modelName].requests += 1;
                                        // Calculate cost
                                        const costs = MODEL_COSTS[modelName] || MODEL_COSTS['nvidia/nemotron-3-nano-30b-a3b'];
                                        const cost = (tokens / 1000) * (costs.input + costs.output) / 2;
                                        modelBreakdown[modelName].cost += cost;
                                    }
                                }
                            }
                        }
                        // Also count message tokens if available
                        if (message.totalTokensUsed) {
                            totalTokens += message.totalTokensUsed;
                        }
                    }
                }
                // Calculate total estimated cost
                let estimatedCost = 0;
                for (const modelData of Object.values(modelBreakdown)) {
                    estimatedCost += modelData.cost;
                }
                return reply.send({
                    month: usage.month,
                    requestCount: usage.requestCount,
                    imageCount: usage.imageCount,
                    geminiImageCount: usage.geminiImageCount,
                    searchCount: usage.searchCount,
                    totalTokens: totalTokens > 0 ? totalTokens : undefined,
                    estimatedCost: estimatedCost > 0 ? estimatedCost : undefined,
                    limits: {
                        requestsTotal: limits.requestsTotal === Infinity ? 'unlimited' : limits.requestsTotal,
                        requestsPerMinute: limits.requestsPerMinute === Infinity ? 'unlimited' : limits.requestsPerMinute,
                        geminiImageAnalysis: limits.geminiImageAnalysis === Infinity ? 'unlimited' : limits.geminiImageAnalysis,
                        searchesPerMinute: limits.searchesPerMinute === Infinity ? 'unlimited' : limits.searchesPerMinute,
                    },
                    tier: user.tier,
                    modelBreakdown: Object.keys(modelBreakdown).length > 0 ? modelBreakdown : undefined,
                    agentBreakdown: Object.keys(agentBreakdown).length > 0 ? agentBreakdown : undefined,
                });
            }
            catch (error) {
                app.log.error({ error }, 'Failed to fetch usage stats');
                return reply.code(500).send({
                    error: 'InternalServerError',
                    message: 'Failed to fetch usage statistics'
                });
            }
        },
    });
}
//# sourceMappingURL=usage.js.map