import mongoose, { Schema, Document } from 'mongoose';
import type { Tier } from '../types.js';

// User preferences interface
export interface IUserPreferences {
    theme: 'light' | 'dark' | 'system';
    language: string;
    notifications: boolean;
    defaultDistro: string;
    defaultShell: string;
}

// User metadata interface
export interface IUserMetadata {
    signupIp?: string;
    signupUserAgent?: string;
    lastLoginIp?: string;
    lastLoginUserAgent?: string;
    referralSource?: string;
}

// Plan change history entry
export interface IPlanChangeEntry {
    fromTier: string;
    toTier: string;
    changedAt: Date;
    changedBy: mongoose.Types.ObjectId;
    reason?: string;
}

export interface IUser extends Document {
    googleId: string;
    email: string;
    name: string;
    avatar: string;
    tier: Tier;
    isAdmin: boolean;
    lastLogin: Date | null;
    loginCount: number;
    preferences: IUserPreferences;
    metadata: IUserMetadata;
    planChangeHistory?: IPlanChangeEntry[];
    createdAt: Date;
    updatedAt: Date;
}

const defaultPreferences: IUserPreferences = {
    theme: 'system',
    language: 'en',
    notifications: true,
    defaultDistro: 'ubuntu',
    defaultShell: 'bash',
};

const userSchema = new Schema<IUser>(
    {
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
        planChangeHistory: [{
            fromTier: { type: String, required: true },
            toTier: { type: String, required: true },
            changedAt: { type: Date, default: Date.now },
            changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
            reason: { type: String },
        }],
    },
    { timestamps: true }
);

// Compound indexes for common queries
userSchema.index({ tier: 1, createdAt: -1 });
userSchema.index({ isAdmin: 1, createdAt: -1 });

// Instance method to update login stats
userSchema.methods.updateLoginStats = async function(ip: string, userAgent: string): Promise<void> {
    this.lastLogin = new Date();
    this.loginCount += 1;
    this.metadata.lastLoginIp = ip;
    this.metadata.lastLoginUserAgent = userAgent;
    await this.save();
};

// Static method to find admin users
userSchema.statics.findAdmins = function() {
    return this.find({ isAdmin: true });
};

export const User = mongoose.model<IUser>('User', userSchema);
