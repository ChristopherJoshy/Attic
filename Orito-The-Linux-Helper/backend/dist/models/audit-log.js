import mongoose, { Schema } from 'mongoose';
const auditLogSchema = new Schema({
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
}, { timestamps: true });
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
//# sourceMappingURL=audit-log.js.map