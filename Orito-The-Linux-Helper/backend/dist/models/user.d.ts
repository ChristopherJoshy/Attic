import mongoose, { Document } from 'mongoose';
import type { Tier } from '../types.js';
export interface IUserPreferences {
    theme: 'light' | 'dark' | 'system';
    language: string;
    notifications: boolean;
    defaultDistro: string;
    defaultShell: string;
}
export interface IUserMetadata {
    signupIp?: string;
    signupUserAgent?: string;
    lastLoginIp?: string;
    lastLoginUserAgent?: string;
    referralSource?: string;
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
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=user.d.ts.map