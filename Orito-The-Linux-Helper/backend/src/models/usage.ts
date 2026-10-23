import mongoose, { Schema, Document } from 'mongoose';

// Legacy usage interface for backward compatibility
export interface IUsage extends Document {
    identifier: string; // userId or sessionId
    identifierType: 'user' | 'session';
    month: string; // Format: YYYY-MM
    requestCount: number;
    imageCount: number;
    geminiImageCount: number;
    searchCount: number;
    createdAt: Date;
    updatedAt: Date;
}

// New detailed usage record interface
// Note: Omit 'model' from Document to avoid conflict with the model property
export interface IUsageRecord extends Omit<Document, 'model'> {
    userId: string;
    sessionId?: string;
    agentType: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
    apiKeyType: 'user' | 'system';
    success: boolean;
    errorMessage?: string;
    timestamp: Date;
    cost: number;
    requestId?: string;
    metadata?: Record<string, unknown>;
}

const usageSchema = new Schema<IUsage>(
    {
        identifier: { type: String, required: true, index: true },
        identifierType: { type: String, enum: ['user', 'session'], required: true },
        month: { type: String, required: true }, // YYYY-MM format
        requestCount: { type: Number, default: 0 },
        imageCount: { type: Number, default: 0 },
        geminiImageCount: { type: Number, default: 0 },
        searchCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Compound index for efficient lookups
usageSchema.index({ identifier: 1, month: 1 }, { unique: true });

export const Usage = mongoose.model<IUsage>('Usage', usageSchema);

// New detailed usage record schema
const usageRecordSchema = new Schema<IUsageRecord>(
    {
        userId: { type: String, required: true, index: true },
        sessionId: { type: String, index: true },
        agentType: { type: String, required: true, index: true },
        model: { type: String, required: true, index: true },
        provider: { type: String, required: true },
        inputTokens: { type: Number, required: true, default: 0 },
        outputTokens: { type: Number, required: true, default: 0 },
        totalTokens: { type: Number, required: true, default: 0 },
        latencyMs: { type: Number, required: true, default: 0 },
        apiKeyType: { type: String, enum: ['user', 'system'], required: true, default: 'system' },
        success: { type: Boolean, required: true, default: true },
        errorMessage: { type: String },
        timestamp: { type: Date, required: true, default: Date.now, index: true },
        cost: { type: Number, required: true, default: 0 },
        requestId: { type: String, index: true },
        metadata: { type: Schema.Types.Mixed },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for common queries
usageRecordSchema.index({ userId: 1, timestamp: -1 });
usageRecordSchema.index({ userId: 1, agentType: 1 });
usageRecordSchema.index({ userId: 1, model: 1 });
usageRecordSchema.index({ userId: 1, timestamp: 1 }); // For date range queries
usageRecordSchema.index({ sessionId: 1, timestamp: -1 });

export const UsageRecord = mongoose.model<IUsageRecord>('UsageRecord', usageRecordSchema);

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get or create usage record for an identifier (legacy support)
 */
export async function getOrCreateUsage(identifier: string, identifierType: 'user' | 'session'): Promise<IUsage> {
    const month = getCurrentMonth();

    let usage = await Usage.findOne({ identifier, month });

    if (!usage) {
        usage = await Usage.create({
            identifier,
            identifierType,
            month,
            requestCount: 0,
            imageCount: 0,
            geminiImageCount: 0,
            searchCount: 0,
        });
    }

    return usage;
}

/**
 * Increment request count for an identifier
 */
export async function incrementRequestCount(identifier: string, identifierType: 'user' | 'session'): Promise<number> {
    const month = getCurrentMonth();

    const usage = await Usage.findOneAndUpdate(
        { identifier, month },
        { $inc: { requestCount: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return usage.requestCount;
}

/**
 * Increment Gemini image count for an identifier
 */
export async function incrementGeminiImageCount(
    identifier: string,
    identifierType: 'user' | 'session'
): Promise<number> {
    const month = getCurrentMonth();

    const usage = await Usage.findOneAndUpdate(
        { identifier, month },
        { $inc: { geminiImageCount: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return usage.geminiImageCount;
}

/**
 * Increment Search count for an identifier
 */
export async function incrementSearchCount(
    identifier: string,
    identifierType: 'user' | 'session'
): Promise<number> {
    const month = getCurrentMonth();

    const usage = await Usage.findOneAndUpdate(
        { identifier, month },
        { $inc: { searchCount: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return usage.searchCount;
}

// ============= New Detailed Usage Tracking Functions =============

/**
 * Input type for creating a usage record
 */
export interface CreateUsageRecordInput {
    userId: string;
    sessionId?: string;
    agentType: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
    apiKeyType: 'user' | 'system';
    success: boolean;
    errorMessage?: string;
    cost: number;
    requestId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Create a new detailed usage record
 */
export async function createUsageRecord(input: CreateUsageRecordInput): Promise<IUsageRecord> {
    return UsageRecord.create({
        ...input,
        timestamp: new Date(),
    });
}

/**
 * Get usage records for a user within a date range
 */
export async function getUsageByUser(
    userId: string,
    startDate?: Date,
    endDate?: Date
): Promise<IUsageRecord[]> {
    const query: Record<string, unknown> = { userId };
    
    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) (query.timestamp as Record<string, Date>).$gte = startDate;
        if (endDate) (query.timestamp as Record<string, Date>).$lte = endDate;
    }

    return UsageRecord.find(query).sort({ timestamp: -1 });
}

/**
 * Get usage records for a session
 */
export async function getUsageBySession(sessionId: string): Promise<IUsageRecord[]> {
    return UsageRecord.find({ sessionId }).sort({ timestamp: -1 });
}

/**
 * Get aggregated usage statistics by user
 */
export async function getUserUsageStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
}> {
    const matchStage: Record<string, unknown> = { userId };
    
    if (startDate || endDate) {
        matchStage.timestamp = {} as { $gte?: Date; $lte?: Date };
        if (startDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$gte = startDate;
        if (endDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$lte = endDate;
    }

    const result = await UsageRecord.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalRequests: { $sum: 1 },
                successfulRequests: { $sum: { $cond: ['$success', 1, 0] } },
                failedRequests: { $sum: { $cond: ['$success', 0, 1] } },
                totalInputTokens: { $sum: '$inputTokens' },
                totalOutputTokens: { $sum: '$outputTokens' },
                totalTokens: { $sum: '$totalTokens' },
                totalCost: { $sum: '$cost' },
                totalLatency: { $sum: '$latencyMs' },
            }
        },
        {
            $project: {
                _id: 0,
                totalRequests: 1,
                successfulRequests: 1,
                failedRequests: 1,
                totalInputTokens: 1,
                totalOutputTokens: 1,
                totalTokens: 1,
                totalCost: 1,
                avgLatencyMs: { $cond: [{ $eq: ['$totalRequests', 0] }, 0, { $divide: ['$totalLatency', '$totalRequests'] }] },
            }
        }
    ]);

    return result[0] || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        avgLatencyMs: 0,
    };
}

/**
 * Get usage breakdown by agent type
 */
export async function getUsageByAgentType(
    userId: string,
    startDate?: Date,
    endDate?: Date
): Promise<Array<{
    agentType: string;
    count: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
}>> {
    const matchStage: Record<string, unknown> = { userId };
    
    if (startDate || endDate) {
        matchStage.timestamp = {} as { $gte?: Date; $lte?: Date };
        if (startDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$gte = startDate;
        if (endDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$lte = endDate;
    }

    return UsageRecord.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$agentType',
                count: { $sum: 1 },
                totalTokens: { $sum: '$totalTokens' },
                totalCost: { $sum: '$cost' },
                totalLatency: { $sum: '$latencyMs' },
            }
        },
        {
            $project: {
                _id: 0,
                agentType: '$_id',
                count: 1,
                totalTokens: 1,
                totalCost: 1,
                avgLatencyMs: { $cond: [{ $eq: ['$count', 0] }, 0, { $divide: ['$totalLatency', '$count'] }] },
            }
        },
        { $sort: { count: -1 } }
    ]);
}

/**
 * Get usage breakdown by model
 */
export async function getUsageByModel(
    userId: string,
    startDate?: Date,
    endDate?: Date
): Promise<Array<{
    model: string;
    provider: string;
    count: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCost: number;
    avgLatencyMs: number;
}>> {
    const matchStage: Record<string, unknown> = { userId };
    
    if (startDate || endDate) {
        matchStage.timestamp = {} as { $gte?: Date; $lte?: Date };
        if (startDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$gte = startDate;
        if (endDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$lte = endDate;
    }

    return UsageRecord.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: { model: '$model', provider: '$provider' },
                count: { $sum: 1 },
                inputTokens: { $sum: '$inputTokens' },
                outputTokens: { $sum: '$outputTokens' },
                totalTokens: { $sum: '$totalTokens' },
                totalCost: { $sum: '$cost' },
                totalLatency: { $sum: '$latencyMs' },
            }
        },
        {
            $project: {
                _id: 0,
                model: '$_id.model',
                provider: '$_id.provider',
                count: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 1,
                totalCost: 1,
                avgLatencyMs: { $cond: [{ $eq: ['$count', 0] }, 0, { $divide: ['$totalLatency', '$count'] }] },
            }
        },
        { $sort: { count: -1 } }
    ]);
}

/**
 * Get daily usage timeline
 */
export async function getUsageTimeline(
    userId: string,
    startDate?: Date,
    endDate?: Date
): Promise<Array<{
    date: string;
    requests: number;
    totalTokens: number;
    totalCost: number;
}>> {
    const matchStage: Record<string, unknown> = { userId };
    
    if (startDate || endDate) {
        matchStage.timestamp = {} as { $gte?: Date; $lte?: Date };
        if (startDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$gte = startDate;
        if (endDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$lte = endDate;
    }

    return UsageRecord.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                },
                requests: { $sum: 1 },
                totalTokens: { $sum: '$totalTokens' },
                totalCost: { $sum: '$cost' },
            }
        },
        {
            $project: {
                _id: 0,
                date: '$_id',
                requests: 1,
                totalTokens: 1,
                totalCost: 1,
            }
        },
        { $sort: { date: 1 } }
    ]);
}

/**
 * Get all users' usage stats (admin only)
 */
export async function getAllUsersUsageStats(
    startDate?: Date,
    endDate?: Date,
    limit: number = 100,
    offset: number = 0
): Promise<Array<{
    userId: string;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
}>> {
    const matchStage: Record<string, unknown> = {};
    
    if (startDate || endDate) {
        matchStage.timestamp = {} as { $gte?: Date; $lte?: Date };
        if (startDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$gte = startDate;
        if (endDate) (matchStage.timestamp as { $gte?: Date; $lte?: Date }).$lte = endDate;
    }

    return UsageRecord.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$userId',
                totalRequests: { $sum: 1 },
                totalTokens: { $sum: '$totalTokens' },
                totalCost: { $sum: '$cost' },
            }
        },
        {
            $project: {
                _id: 0,
                userId: '$_id',
                totalRequests: 1,
                totalTokens: 1,
                totalCost: 1,
            }
        },
        { $sort: { totalCost: -1 } },
        { $skip: offset },
        { $limit: limit }
    ]);
}

/**
 * Delete usage records older than a specified date (for data retention)
 */
export async function deleteOldUsageRecords(olderThan: Date): Promise<number> {
    const result = await UsageRecord.deleteMany({
        timestamp: { $lt: olderThan }
    });
    return result.deletedCount;
}