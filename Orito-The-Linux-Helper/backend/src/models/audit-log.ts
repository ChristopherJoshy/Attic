import mongoose, { Schema, Document } from 'mongoose';
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

const auditLogSchema = new Schema<IAuditLog>(
    {
        chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
        sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        actionId: { type: String, required: true, unique: true },
        command: { type: String, required: true },
        risk: { type: String, enum: ['low', 'medium', 'high'], required: true },
        userDecision: { type: String, enum: ['approved', 'denied', 'pending'], required: true },
        exitCode: { type: Number, default: null },
        stdout: { type: String, default: '', maxlength: 10000 },
        stderr: { type: String, default: '', maxlength: 10000 },
        hmac: { type: String, required: true },
        previousHmac: { type: String, default: '' },
    },
    { timestamps: true }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
