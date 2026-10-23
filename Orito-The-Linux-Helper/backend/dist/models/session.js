import mongoose, { Schema } from 'mongoose';
const sessionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    tier: { type: String, enum: ['trial', 'free', 'pro'], default: 'trial' },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, default: '' },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    refreshTokenHash: { type: String, select: false },
    deviceInfo: {
        deviceType: { type: String },
        browser: { type: String },
        os: { type: String },
    },
}, { timestamps: true });
// Compound indexes for common queries
sessionSchema.index({ userId: 1, expiresAt: 1 });
sessionSchema.index({ tier: 1, expiresAt: 1 });
// Static method to clean up expired sessions and associated data
sessionSchema.statics.cleanupExpiredSessions = async function () {
    const now = new Date();
    // Find expired sessions
    const expiredSessions = await this.find({ expiresAt: { $lt: now } }).lean();
    const sessionIds = expiredSessions.map((s) => s._id);
    // Delete associated chats for trial sessions (non-persisted)
    const { Chat } = await import('./chat.js');
    const deletedChatsResult = await Chat.deleteMany({
        sessionId: { $in: sessionIds }
    });
    // Delete the sessions
    const deletedSessionsResult = await this.deleteMany({ expiresAt: { $lt: now } });
    return {
        deletedSessions: deletedSessionsResult.deletedCount,
        deletedChats: deletedChatsResult.deletedCount,
    };
};
// Static method to clean up orphaned chats (chats without valid sessions)
sessionSchema.statics.cleanupOrphanedChats = async function () {
    const { Chat } = await import('./chat.js');
    // Find chats with sessions that no longer exist
    const chats = await Chat.find({}).lean();
    const sessionIds = [...new Set(chats.map((c) => c.sessionId.toString()))];
    const existingSessions = await this.find({ _id: { $in: sessionIds } }).lean();
    const existingSessionIds = new Set(existingSessions.map((s) => s._id.toString()));
    const orphanedSessionIds = sessionIds.filter(id => !existingSessionIds.has(id));
    if (orphanedSessionIds.length === 0) {
        return 0;
    }
    const result = await Chat.deleteMany({
        sessionId: { $in: orphanedSessionIds.map(id => new mongoose.Types.ObjectId(id)) }
    });
    return result.deletedCount;
};
// Instance method to update last active timestamp
sessionSchema.methods.updateLastActive = async function () {
    this.lastActiveAt = new Date();
    await this.save();
};
// Instance method to extend session
sessionSchema.methods.extendSession = async function (extensionMs) {
    this.expiresAt = new Date(Date.now() + extensionMs);
    this.lastActiveAt = new Date();
    await this.save();
};
export const Session = mongoose.model('Session', sessionSchema);
//# sourceMappingURL=session.js.map