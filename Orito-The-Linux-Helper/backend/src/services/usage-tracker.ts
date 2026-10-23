/**
 * Usage Tracker Service
 * Tracks API usage with detailed metadata per user, agent, and model
 */

import {
    createUsageRecord,
    getUserUsageStats,
    getUsageByAgentType,
    getUsageByModel,
    getUsageTimeline,
    getUsageByUser,
    getAllUsersUsageStats,
    type CreateUsageRecordInput,
    type IUsageRecord,
} from '../models/usage.js';
import {
    calculateCost,
    getModelPricing,
    getProviderFromModel,
    formatCost,
} from '../config/pricing.js';

// Agent types that can be tracked
export type AgentType =
    | 'orchestrator'
    | 'planner'
    | 'researcher'
    | 'synthesizer'
    | 'validator'
    | 'curious'
    | 'base'
    | 'system'
    | 'unknown';

// Provider types
export type Provider = 'openrouter' | 'google' | 'anthropic' | 'openai' | 'unknown';

/**
 * Input for tracking an API call
 */
export interface TrackApiCallInput {
    userId: string;
    sessionId?: string;
    agentType: AgentType | string;
    model: string;
    provider?: Provider | string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    apiKeyType: 'user' | 'system';
    success: boolean;
    errorMessage?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Result of tracking an API call
 */
export interface TrackApiCallResult {
    recordId: string;
    cost: number;
    totalTokens: number;
}

/**
 * Usage summary for a user
 */
export interface UsageSummary {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    formattedCost: string;
    avgLatencyMs: number;
    byAgent: Array<{
        agentType: string;
        count: number;
        totalTokens: number;
        totalCost: number;
        formattedCost: string;
        avgLatencyMs: number;
    }>;
    byModel: Array<{
        model: string;
        provider: string;
        count: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        totalCost: number;
        formattedCost: string;
        avgLatencyMs: number;
    }>;
    timeline: Array<{
        date: string;
        requests: number;
        totalTokens: number;
        totalCost: number;
        formattedCost: string;
    }>;
}

/**
 * Real-time usage cache entry
 */
interface UsageCacheEntry {
    timestamp: number;
    data: UsageSummary;
}

// In-memory cache for real-time usage summaries (5 minute TTL)
const usageCache = new Map<string, UsageCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Track an API call with all metadata
 */
export async function trackApiCall(input: TrackApiCallInput): Promise<TrackApiCallResult> {
    const totalTokens = input.inputTokens + input.outputTokens;
    const cost = calculateCost(input.inputTokens, input.outputTokens, input.model);
    const provider = input.provider ?? getProviderFromModel(input.model);

    const recordInput: CreateUsageRecordInput = {
        userId: input.userId,
        sessionId: input.sessionId,
        agentType: input.agentType,
        model: input.model,
        provider,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens,
        latencyMs: input.latencyMs,
        apiKeyType: input.apiKeyType,
        success: input.success,
        errorMessage: input.errorMessage,
        cost,
        requestId: input.requestId,
        metadata: input.metadata,
    };

    const record = await createUsageRecord(recordInput);

    // Invalidate cache for this user
    usageCache.delete(input.userId);

    return {
        recordId: record._id.toString(),
        cost,
        totalTokens,
    };
}

/**
 * Track an API call with timing wrapper
 * Use this to automatically measure latency
 */
export async function trackWithTiming<T>(
    input: Omit<TrackApiCallInput, 'latencyMs' | 'success' | 'errorMessage'>,
    fn: () => Promise<T>
): Promise<{ result: T; tracking: TrackApiCallResult }> {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;

    try {
        const result = await fn();
        return {
            result,
            tracking: await trackApiCall({
                ...input,
                latencyMs: Date.now() - startTime,
                success: true,
            }),
        };
    } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
    } finally {
        if (!success) {
            await trackApiCall({
                ...input,
                latencyMs: Date.now() - startTime,
                success: false,
                errorMessage,
            });
        }
    }
}

/**
 * Get usage summary for a user
 */
export async function getUsageSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    useCache: boolean = true
): Promise<UsageSummary> {
    // Check cache if enabled and no date range specified
    if (useCache && !startDate && !endDate) {
        const cached = usageCache.get(userId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return cached.data;
        }
    }

    // Fetch all data in parallel
    const [stats, byAgent, byModel, timeline] = await Promise.all([
        getUserUsageStats(userId, startDate, endDate),
        getUsageByAgentType(userId, startDate, endDate),
        getUsageByModel(userId, startDate, endDate),
        getUsageTimeline(userId, startDate, endDate),
    ]);

    const summary: UsageSummary = {
        ...stats,
        formattedCost: formatCost(stats.totalCost),
        byAgent: byAgent.map(a => ({
            ...a,
            formattedCost: formatCost(a.totalCost),
        })),
        byModel: byModel.map(m => ({
            ...m,
            formattedCost: formatCost(m.totalCost),
        })),
        timeline: timeline.map(t => ({
            ...t,
            formattedCost: formatCost(t.totalCost),
        })),
    };

    // Cache if no date range specified
    if (!startDate && !endDate) {
        usageCache.set(userId, {
            timestamp: Date.now(),
            data: summary,
        });
    }

    return summary;
}

/**
 * Get detailed usage records for a user
 */
export async function getDetailedUsage(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100,
    offset: number = 0
): Promise<{
    records: IUsageRecord[];
    total: number;
}> {
    const records = await getUsageByUser(userId, startDate, endDate);
    
    return {
        records: records.slice(offset, offset + limit),
        total: records.length,
    };
}

/**
 * Get usage statistics for all users (admin only)
 */
export async function getAllUsersSummary(
    startDate?: Date,
    endDate?: Date,
    limit: number = 100,
    offset: number = 0
): Promise<Array<{
    userId: string;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    formattedCost: string;
}>> {
    const stats = await getAllUsersUsageStats(startDate, endDate, limit, offset);
    
    return stats.map(s => ({
        ...s,
        formattedCost: formatCost(s.totalCost),
    }));
}

/**
 * Export usage data as JSON
 */
export async function exportUsageAsJson(
    userId: string,
    startDate?: Date,
    endDate?: Date
): Promise<string> {
    const [records, summary] = await Promise.all([
        getUsageByUser(userId, startDate, endDate),
        getUsageSummary(userId, startDate, endDate, false),
    ]);

    return JSON.stringify({
        exportedAt: new Date().toISOString(),
        dateRange: {
            start: startDate?.toISOString(),
            end: endDate?.toISOString(),
        },
        summary: {
            totalRequests: summary.totalRequests,
            totalTokens: summary.totalTokens,
            totalCost: summary.totalCost,
        },
        records: records.map(r => ({
            timestamp: r.timestamp.toISOString(),
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
        })),
    }, null, 2);
}

/**
 * Export usage data as CSV
 */
export async function exportUsageAsCsv(
    userId: string,
    startDate?: Date,
    endDate?: Date
): Promise<string> {
    const records = await getUsageByUser(userId, startDate, endDate);
    
    const headers = [
        'timestamp',
        'agentType',
        'model',
        'provider',
        'inputTokens',
        'outputTokens',
        'totalTokens',
        'latencyMs',
        'apiKeyType',
        'success',
        'errorMessage',
        'cost',
    ];
    
    const rows = records.map(r => [
        r.timestamp.toISOString(),
        r.agentType,
        r.model,
        r.provider,
        r.inputTokens.toString(),
        r.outputTokens.toString(),
        r.totalTokens.toString(),
        r.latencyMs.toString(),
        r.apiKeyType,
        r.success ? 'true' : 'false',
        r.errorMessage ?? '',
        r.cost.toFixed(6),
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
    
    return csvContent;
}

/**
 * Get real-time usage stats (lightweight, cached)
 */
export async function getRealtimeUsage(userId: string): Promise<{
    today: { requests: number; tokens: number; cost: number };
    thisMonth: { requests: number; tokens: number; cost: number };
}> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayStats, monthStats] = await Promise.all([
        getUserUsageStats(userId, startOfToday, now),
        getUserUsageStats(userId, startOfMonth, now),
    ]);

    return {
        today: {
            requests: todayStats.totalRequests,
            tokens: todayStats.totalTokens,
            cost: todayStats.totalCost,
        },
        thisMonth: {
            requests: monthStats.totalRequests,
            tokens: monthStats.totalTokens,
            cost: monthStats.totalCost,
        },
    };
}

/**
 * Clear the usage cache for a user
 */
export function clearUsageCache(userId: string): void {
    usageCache.delete(userId);
}

/**
 * Clear all usage cache
 */
export function clearAllUsageCache(): void {
    usageCache.clear();
}

/**
 * Get model pricing info
 */
export function getModelPricingInfo(modelId: string): {
    inputPerMillion: number;
    outputPerMillion: number;
    isFree: boolean;
} {
    return getModelPricing(modelId);
}

// Re-export formatCost for convenience
export { formatCost };