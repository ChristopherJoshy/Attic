import mongoose, { Schema } from 'mongoose';
const usageSchema = new Schema({
    identifier: { type: String, required: true, index: true },
    identifierType: { type: String, enum: ['user', 'session'], required: true },
    month: { type: String, required: true }, // YYYY-MM format
    requestCount: { type: Number, default: 0 },
    imageCount: { type: Number, default: 0 },
    geminiImageCount: { type: Number, default: 0 },
    searchCount: { type: Number, default: 0 },
}, { timestamps: true });
// Compound index for efficient lookups
usageSchema.index({ identifier: 1, month: 1 }, { unique: true });
export const Usage = mongoose.model('Usage', usageSchema);
/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
/**
 * Get or create usage record for an identifier
 */
export async function getOrCreateUsage(identifier, identifierType) {
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
export async function incrementRequestCount(identifier, identifierType) {
    const month = getCurrentMonth();
    const usage = await Usage.findOneAndUpdate({ identifier, month }, { $inc: { requestCount: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return usage.requestCount;
}
/**
 * Increment Gemini image count for an identifier
 */
export async function incrementGeminiImageCount(identifier, identifierType) {
    const month = getCurrentMonth();
    const usage = await Usage.findOneAndUpdate({ identifier, month }, { $inc: { geminiImageCount: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return usage.geminiImageCount;
}
//# sourceMappingURL=usage.js.map