import mongoose, { Document } from 'mongoose';
import type { ChatMessage, SystemProfile } from '../types.js';
export interface IChat extends Document {
    userId: mongoose.Types.ObjectId | null;
    sessionId: mongoose.Types.ObjectId;
    title: string;
    messages: ChatMessage[];
    systemProfile: SystemProfile | null;
    context: {
        systemProfile?: {
            distro: string;
            version: string;
            packageManager: string;
            shell: string;
            desktopEnvironment: string;
            detectedAt: Date;
        };
    };
    expiresAt: Date | null;
    shareToken: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Chat: mongoose.Model<IChat, {}, {}, {}, mongoose.Document<unknown, {}, IChat, {}, {}> & IChat & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=chat.d.ts.map