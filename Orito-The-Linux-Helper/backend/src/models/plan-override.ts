import mongoose, { Schema, Document } from 'mongoose';

/**
 * Plan change audit log entry
 */
export interface IPlanAuditLog extends Document {
    userId: mongoose.Types.ObjectId;
    action: 'grant' | 'revoke' | 'expire' | 'self_change' | 'admin_change';
    fromTier: string;
    toTier: string;
    performedBy: mongoose.Types.ObjectId;
    performedAt: Date;
    reason?: string;
    overrideId?: mongoose.Types.ObjectId;
    metadata?: {
        duration?: string;
        expiresAt?: Date;
        ipAddress?: string;
        userAgent?: string;
    };
}

export interface IPlanOverride extends Document {
    userId: mongoose.Types.ObjectId;
    originalTier: 'trial' | 'free' | 'pro';
    newTier: 'free' | 'pro' | 'admin';
    grantedBy: mongoose.Types.ObjectId;
    grantedAt: Date;
    expiresAt: Date | null; // null for permanent overrides (admins)
    isActive: boolean;
    revokedAt?: Date;
    reason?: string;
    isPermanent?: boolean; // For admin self-overrides
}

const planOverrideSchema = new Schema<IPlanOverride>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        originalTier: { type: String, enum: ['trial', 'free', 'pro'], required: true },
        newTier: { type: String, enum: ['free', 'pro', 'admin'], required: true },
        grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        grantedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: false, index: true, default: null },
        isActive: { type: Boolean, default: true, index: true },
        revokedAt: { type: Date, default: null },
        reason: { type: String, maxlength: 500, default: '' },
        isPermanent: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// Audit log schema
const planAuditLogSchema = new Schema<IPlanAuditLog>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        action: { 
            type: String, 
            enum: ['grant', 'revoke', 'expire', 'self_change', 'admin_change'], 
            required: true 
        },
        fromTier: { type: String, required: true },
        toTier: { type: String, required: true },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        performedAt: { type: Date, default: Date.now },
        reason: { type: String, maxlength: 500 },
        overrideId: { type: Schema.Types.ObjectId, ref: 'PlanOverride' },
        metadata: {
            duration: { type: String },
            expiresAt: { type: Date },
            ipAddress: { type: String },
            userAgent: { type: String },
        },
    },
    { timestamps: true }
);

// Indexes for audit log queries
planAuditLogSchema.index({ userId: 1, performedAt: -1 });
planAuditLogSchema.index({ performedBy: 1, performedAt: -1 });
planAuditLogSchema.index({ action: 1, performedAt: -1 });

// Compound index for finding active overrides for a user
planOverrideSchema.index({ userId: 1, isActive: 1 });

// Static method to find active override for a user
planOverrideSchema.statics.findActiveOverride = function (userId: string) {
    return this.findOne({
        userId,
        isActive: true,
        $or: [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: null },
            { isPermanent: true }
        ],
    });
};

// Static method to expire overrides that have passed their expiresAt
planOverrideSchema.statics.expireOldOverrides = async function () {
    const now = new Date();
    const expired = await this.find({ 
        isActive: true, 
        expiresAt: { $lte: now, $ne: null },
        isPermanent: { $ne: true }
    });

    for (const override of expired) {
        override.isActive = false;
        await override.save();

        // Revert the user's tier
        const User = mongoose.model('User');
        await User.updateOne(
            { _id: override.userId },
            { $set: { tier: override.originalTier } }
        );
    }

    return expired.length;
};

export const PlanOverride = mongoose.model<IPlanOverride>('PlanOverride', planOverrideSchema);
export const PlanAuditLog = mongoose.model<IPlanAuditLog>('PlanAuditLog', planAuditLogSchema);
