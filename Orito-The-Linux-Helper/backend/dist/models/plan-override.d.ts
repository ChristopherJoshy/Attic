import mongoose, { Document } from 'mongoose';
export interface IPlanOverride extends Document {
    userId: mongoose.Types.ObjectId;
    originalTier: 'trial' | 'free' | 'pro';
    newTier: 'free' | 'pro';
    grantedBy: mongoose.Types.ObjectId;
    grantedAt: Date;
    expiresAt: Date;
    isActive: boolean;
    revokedAt?: Date;
    reason?: string;
}
export declare const PlanOverride: mongoose.Model<IPlanOverride, {}, {}, {}, mongoose.Document<unknown, {}, IPlanOverride, {}, {}> & IPlanOverride & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=plan-override.d.ts.map