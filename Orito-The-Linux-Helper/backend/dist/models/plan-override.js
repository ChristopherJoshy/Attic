import mongoose, { Schema } from 'mongoose';
const planOverrideSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalTier: { type: String, enum: ['trial', 'free', 'pro'], required: true },
    newTier: { type: String, enum: ['free', 'pro'], required: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    grantedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    revokedAt: { type: Date, default: null },
    reason: { type: String, maxlength: 500, default: '' },
}, { timestamps: true });
// Compound index for finding active overrides for a user
planOverrideSchema.index({ userId: 1, isActive: 1 });
// Static method to find active override for a user
planOverrideSchema.statics.findActiveOverride = function (userId) {
    return this.findOne({
        userId,
        isActive: true,
        expiresAt: { $gt: new Date() },
    });
};
// Static method to expire overrides that have passed their expiresAt
planOverrideSchema.statics.expireOldOverrides = async function () {
    const now = new Date();
    const expired = await this.find({ isActive: true, expiresAt: { $lte: now } });
    for (const override of expired) {
        override.isActive = false;
        await override.save();
        // Revert the user's tier
        const User = mongoose.model('User');
        await User.updateOne({ _id: override.userId }, { $set: { tier: override.originalTier } });
    }
    return expired.length;
};
export const PlanOverride = mongoose.model('PlanOverride', planOverrideSchema);
//# sourceMappingURL=plan-override.js.map