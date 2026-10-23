import mongoose, { Schema } from 'mongoose';
const defaultPreferences = {
    theme: 'system',
    language: 'en',
    notifications: true,
    defaultDistro: 'ubuntu',
    defaultShell: 'bash',
};
const userSchema = new Schema({
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '' },
    tier: { type: String, enum: ['trial', 'free', 'pro'], default: 'free' },
    isAdmin: { type: Boolean, default: false, index: true },
    lastLogin: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
    preferences: {
        theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
        language: { type: String, default: 'en' },
        notifications: { type: Boolean, default: true },
        defaultDistro: { type: String, default: 'ubuntu' },
        defaultShell: { type: String, default: 'bash' },
    },
    metadata: {
        signupIp: { type: String },
        signupUserAgent: { type: String },
        lastLoginIp: { type: String },
        lastLoginUserAgent: { type: String },
        referralSource: { type: String },
    },
}, { timestamps: true });
// Compound indexes for common queries
userSchema.index({ tier: 1, createdAt: -1 });
userSchema.index({ isAdmin: 1, createdAt: -1 });
// Instance method to update login stats
userSchema.methods.updateLoginStats = async function (ip, userAgent) {
    this.lastLogin = new Date();
    this.loginCount += 1;
    this.metadata.lastLoginIp = ip;
    this.metadata.lastLoginUserAgent = userAgent;
    await this.save();
};
// Static method to find admin users
userSchema.statics.findAdmins = function () {
    return this.find({ isAdmin: true });
};
export const User = mongoose.model('User', userSchema);
//# sourceMappingURL=user.js.map