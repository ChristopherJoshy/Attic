import mongoose, { Schema } from 'mongoose';
const memoryItemSchema = new Schema({
    key: { type: String, required: true },
    value: { type: String, required: true },
    source: { type: String, enum: ['model', 'user'], default: 'model' },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
const docSourceSchema = new Schema({
    url: { type: String, required: true },
    label: { type: String, default: '' },
    addedAt: { type: Date, default: Date.now },
}, { _id: true });
const userPreferencesSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    responseStyle: { type: String, enum: ['concise', 'balanced', 'verbose'], default: 'balanced' },
    technicalLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
    defaultDistro: { type: String, default: 'not_selected' },
    defaultShell: { type: String, default: 'not_selected' },
    fontSize: { type: Number, default: 14, min: 10, max: 24 },
    showAgentCards: { type: Boolean, default: true },
    autoApproveLowRisk: { type: Boolean, default: false },
    compactMode: { type: Boolean, default: false },
    showCitationsInline: { type: Boolean, default: true },
    explainBeforeCommands: { type: Boolean, default: true },
    includeAlternatives: { type: Boolean, default: true },
    warnAboutSideEffects: { type: Boolean, default: true },
    customInstructions: { type: String, default: '', maxlength: 2000 },
    memory: { type: [memoryItemSchema], default: [] },
    docSources: { type: [docSourceSchema], default: [] },
}, { timestamps: true });
export const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);
//# sourceMappingURL=user-preferences.js.map