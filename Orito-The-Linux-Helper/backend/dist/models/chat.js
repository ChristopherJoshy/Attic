import mongoose, { Schema } from 'mongoose';
const citationSchema = new Schema({
    url: String,
    title: String,
    excerpt: String,
    sourceWeight: Number,
    confidence: Number,
    crawledAt: String,
}, { _id: false });
const commandSchema = new Schema({
    command: String,
    privilegeLevel: { type: String, enum: ['read-only', 'user', 'root'] },
    risk: { type: String, enum: ['low', 'medium', 'high'] },
    riskExplanation: String,
    dryRunHint: String,
    citations: [citationSchema],
}, { _id: false });
const agentEventSchema = new Schema({
    type: { type: String, required: true },
    agentId: String,
    name: String,
    agentType: String,
    color: String,
    task: String,
    tool: String,
    input: String,
    status: String,
    output: String,
    summary: String,
    content: String,
    questionId: String,
    question: String,
    options: [String],
    allowCustom: Boolean,
    parentAgentId: String,
    depth: Number,
    title: String,
    timestamp: String,
    totalTokensUsed: Number,
    agentMetrics: [{
            agentId: String,
            agentType: String,
            tokensUsed: Number,
            modelName: String,
        }],
}, { _id: false });
const messageSchema = new Schema({
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    citations: [citationSchema],
    commands: [commandSchema],
    agentEvents: [agentEventSchema],
    imageUrl: String,
    timestamp: { type: String, required: true },
    tokens: { type: Number, default: null },
    model: { type: String, default: null },
    totalTokensUsed: { type: Number, default: null },
}, { _id: false });
const systemProfileSchema = new Schema({
    distro: String,
    distroVersion: String,
    kernel: String,
    packageManager: String,
    cpuModel: String,
    gpuInfo: String,
    shell: String,
    displayServer: String,
    windowManager: String,
    collectedAt: String,
}, { _id: false });
const contextSystemProfileSchema = new Schema({
    distro: String,
    version: String,
    packageManager: String,
    shell: String,
    desktopEnvironment: String,
    detectedAt: Date,
}, { _id: false });
const contextSchema = new Schema({
    systemProfile: { type: contextSystemProfileSchema, default: null },
}, { _id: false });
const chatSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    title: { type: String, default: 'New Chat' },
    messages: [messageSchema],
    systemProfile: { type: systemProfileSchema, default: null },
    context: { type: contextSchema, default: {} },
    expiresAt: { type: Date, default: null, index: { expireAfterSeconds: 0 } },
    shareToken: { type: String, default: null, index: true, unique: true, sparse: true },
}, { timestamps: true });
// Compound indexes for common queries
chatSchema.index({ userId: 1, updatedAt: -1 });
chatSchema.index({ sessionId: 1, updatedAt: -1 });
chatSchema.index({ userId: 1, sessionId: 1 });
// Static method to delete all chats for a session (for cleanup)
chatSchema.statics.deleteBySessionId = async function (sessionId) {
    const result = await this.deleteMany({ sessionId });
    return result.deletedCount;
};
// Static method to delete all chats for a user (for account deletion)
chatSchema.statics.deleteByUserId = async function (userId) {
    const result = await this.deleteMany({ userId });
    return result.deletedCount;
};
// Instance method to add a message
chatSchema.methods.addMessage = async function (message) {
    this.messages.push(message);
    this.updatedAt = new Date();
    await this.save();
};
export const Chat = mongoose.model('Chat', chatSchema);
//# sourceMappingURL=chat.js.map