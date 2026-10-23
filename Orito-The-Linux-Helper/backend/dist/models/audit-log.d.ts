import mongoose, { Document } from 'mongoose';
import type { RiskLevel } from '../types.js';
export interface IAuditLog extends Document {
    chatId: mongoose.Types.ObjectId;
    sessionId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId | null;
    actionId: string;
    command: string;
    risk: RiskLevel;
    userDecision: 'approved' | 'denied' | 'pending';
    exitCode: number | null;
    stdout: string;
    stderr: string;
    hmac: string;
    previousHmac: string;
    createdAt: Date;
}
export declare const AuditLog: mongoose.Model<IAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, IAuditLog, {}, {}> & IAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=audit-log.d.ts.map