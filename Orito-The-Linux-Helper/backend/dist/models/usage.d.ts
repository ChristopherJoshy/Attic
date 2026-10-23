import mongoose, { Document } from 'mongoose';
export interface IUsage extends Document {
    identifier: string;
    identifierType: 'user' | 'session';
    month: string;
    requestCount: number;
    imageCount: number;
    geminiImageCount: number;
    searchCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Usage: mongoose.Model<IUsage, {}, {}, {}, mongoose.Document<unknown, {}, IUsage, {}, {}> & IUsage & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
/**
 * Get current month in YYYY-MM format
 */
export declare function getCurrentMonth(): string;
/**
 * Get or create usage record for an identifier
 */
export declare function getOrCreateUsage(identifier: string, identifierType: 'user' | 'session'): Promise<IUsage>;
/**
 * Increment request count for an identifier
 */
export declare function incrementRequestCount(identifier: string, identifierType: 'user' | 'session'): Promise<number>;
/**
 * Increment Gemini image count for an identifier
 */
export declare function incrementGeminiImageCount(identifier: string, identifierType: 'user' | 'session'): Promise<number>;
//# sourceMappingURL=usage.d.ts.map