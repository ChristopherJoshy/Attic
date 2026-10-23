import mongoose, { Schema, Document } from 'mongoose';

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

// Agent-specific configuration
export interface AgentConfig {
    enabled: boolean;
    priority: number;
    settings: Record<string, any>;
}

// Model configuration settings
export interface ModelConfig {
    preferred: string;
    fallback: string;
    temperature: number;
    maxTokens: number;
}

// Behavior configuration settings
export interface BehaviorConfig {
    responseStyle: 'concise' | 'balanced' | 'verbose';
    streamResponses: boolean;
    showAgentCards: boolean;
    autoExecuteCommands: boolean;
}

// System configuration settings
export interface SystemConfig {
    defaultShell: string;
    packageManager: string;
    editor: string;
}

export interface IUserPreferences extends Document {
    userId: mongoose.Types.ObjectId;
    // Legacy fields (kept for backward compatibility)
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
    distroVersion: string;
    packageManager: string;
    desktopEnvironment: string;
    memory: MemoryItem[];
    docSources: DocSource[];
    openRouterKey?: string;
    streamResponses: boolean;
    language: string;
    
    // New system configuration fields
    modelConfig: ModelConfig;
    agents: Record<string, AgentConfig>;
    behavior: BehaviorConfig;
    system: SystemConfig;
}

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

// Agent configuration schema
const agentConfigSchema = new Schema({
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: 0, min: 0, max: 100 },
    settings: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

// Model configuration schema
const modelConfigSchema = new Schema({
    preferred: { type: String, default: '' },
    fallback: { type: String, default: '' },
    temperature: { type: Number, default: 0.7, min: 0, max: 2 },
    maxTokens: { type: Number, default: 4096, min: 256, max: 32000 },
}, { _id: false });

// Behavior configuration schema
const behaviorConfigSchema = new Schema({
    responseStyle: { type: String, enum: ['concise', 'balanced', 'verbose'], default: 'balanced' },
    streamResponses: { type: Boolean, default: true },
    showAgentCards: { type: Boolean, default: true },
    autoExecuteCommands: { type: Boolean, default: false },
}, { _id: false });

// System configuration schema
const systemConfigSchema = new Schema({
    defaultShell: { type: String, default: 'bash' },
    packageManager: { type: String, default: 'apt' },
    editor: { type: String, default: 'nano' },
}, { _id: false });

const userPreferencesSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Legacy fields (kept for backward compatibility)
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
    distroVersion: { type: String, default: '' },
    packageManager: { type: String, default: '' },
    desktopEnvironment: { type: String, default: '' },
    memory: { type: [memoryItemSchema], default: [] },
    docSources: { type: [docSourceSchema], default: [] },
    openRouterKey: { type: String, select: false }, // Hidden by default for security
    streamResponses: { type: Boolean, default: true },
    language: { type: String, default: 'en' },
    
    // New system configuration fields
    modelConfig: { type: modelConfigSchema, default: () => ({}) },
    agents: { type: Map, of: agentConfigSchema, default: {} },
    behavior: { type: behaviorConfigSchema, default: () => ({}) },
    system: { type: systemConfigSchema, default: () => ({}) },
}, { timestamps: true });

// Helper method to get agent configuration
userPreferencesSchema.methods.getAgentConfig = function(agentType: string): AgentConfig {
    const defaultConfig: AgentConfig = { enabled: true, priority: 0, settings: {} };
    const agentConfig = this.agents?.get?.(agentType);
    return agentConfig || defaultConfig;
};

// Helper method to set agent configuration
userPreferencesSchema.methods.setAgentConfig = function(agentType: string, config: Partial<AgentConfig>): void {
    if (!this.agents) {
        this.agents = new Map();
    }
    const existing = this.getAgentConfig(agentType);
    this.agents.set(agentType, { ...existing, ...config });
};

// Helper method to get full system configuration
userPreferencesSchema.methods.getSystemConfiguration = function(): {
    model: ModelConfig;
    agents: Record<string, AgentConfig>;
    behavior: BehaviorConfig;
    system: SystemConfig;
} {
    const agentsMap: Record<string, AgentConfig> = {};
    if (this.agents) {
        for (const [key, value] of this.agents) {
            agentsMap[key] = value;
        }
    }
    
    return {
        model: this.modelConfig || { preferred: '', fallback: '', temperature: 0.7, maxTokens: 4096 },
        agents: agentsMap,
        behavior: this.behavior || { responseStyle: 'balanced', streamResponses: true, showAgentCards: true, autoExecuteCommands: false },
        system: this.system || { defaultShell: 'bash', packageManager: 'apt', editor: 'nano' },
    };
};

export const UserPreferences = mongoose.model<IUserPreferences>('UserPreferences', userPreferencesSchema);
