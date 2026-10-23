import mongoose, { Document } from 'mongoose';
import type { Tier } from '../types.js';
export interface ISession extends Document {
    userId: mongoose.Types.ObjectId | null;
    tier: Tier;
    ipAddress: string;
    userAgent: string;
    lastActiveAt: Date;
    expiresAt: Date;
    createdAt: Date;
    refreshTokenHash?: string;
    deviceInfo?: {
        deviceType?: string;
        browser?: string;
        os?: string;
    };
}
export declare const Session: mongoose.Model<ISession, {}, {}, {}, mongoose.Document<unknown, {}, ISession, {}, {}> & ISession & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=session.d.ts.map