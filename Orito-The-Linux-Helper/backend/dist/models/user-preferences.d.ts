import mongoose, { Document } from 'mongoose';
interface MemoryItem {
    key: string;
    value: string;
    source: 'model' | 'user';
    createdAt: Date;
}
interface DocSource {
    url: string;
    label: string;
    addedAt: Date;
}
export interface IUserPreferences extends Document {
    userId: mongoose.Types.ObjectId;
    responseStyle: 'concise' | 'balanced' | 'verbose';
    technicalLevel: 'beginner' | 'intermediate' | 'advanced';
    defaultDistro: string;
    defaultShell: string;
    fontSize: number;
    showAgentCards: boolean;
    autoApproveLowRisk: boolean;
    compactMode: boolean;
    showCitationsInline: boolean;
    explainBeforeCommands: boolean;
    includeAlternatives: boolean;
    warnAboutSideEffects: boolean;
    customInstructions: string;
    memory: MemoryItem[];
    docSources: DocSource[];
}
export declare const UserPreferences: mongoose.Model<IUserPreferences, {}, {}, {}, mongoose.Document<unknown, {}, IUserPreferences, {}, {}> & IUserPreferences & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export {};
//# sourceMappingURL=user-preferences.d.ts.map