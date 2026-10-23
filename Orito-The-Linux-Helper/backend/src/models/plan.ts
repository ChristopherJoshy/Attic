import mongoose, { Schema, Document } from 'mongoose';

/**
 * Plan feature definitions
 */
export interface PlanFeatures {
    maxMessages: number | 'unlimited';
    maxTokens: number | 'unlimited';
    availableModels: string[] | 'all';
    priority: 'low' | 'normal' | 'high';
    customAgents: boolean;
    apiAccess: boolean;
}

/**
 * Plan definition interface
 */
export interface IPlan {
    id: string;
    name: string;
    description?: string;
    features: PlanFeatures;
    price: number;
    isDefault?: boolean;
    isAdminOnly?: boolean;
}

/**
 * Plan document for database storage (for custom plans)
 */
export interface IPlanDocument extends Document {
    id: string;
    name: string;
    description?: string;
    features: PlanFeatures;
    price: number;
    isDefault?: boolean;
    isAdminOnly?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Plan change history entry
 */
export interface IPlanChangeHistory {
    fromTier: string;
    toTier: string;
    changedBy: mongoose.Types.ObjectId;
    changedAt: Date;
    reason?: string;
    overrideId?: mongoose.Types.ObjectId;
}

/**
 * Predefined plans with their features
 */
export const PLANS: IPlan[] = [
    {
        id: 'trial',
        name: 'Trial',
        description: '14-day trial with Pro features',
        features: {
            maxMessages: 100,
            maxTokens: 100000,
            availableModels: ['gemini-2.0-flash', 'gemini-1.5-flash'],
            priority: 'normal',
            customAgents: false,
            apiAccess: false,
        },
        price: 0,
        isDefault: false,
    },
    {
        id: 'free',
        name: 'Free',
        description: 'Basic access with limited features',
        features: {
            maxMessages: 50,
            maxTokens: 50000,
            availableModels: ['gemini-2.0-flash'],
            priority: 'low',
            customAgents: false,
            apiAccess: false,
        },
        price: 0,
        isDefault: true,
    },
    {
        id: 'pro',
        name: 'Pro',
        description: 'Full access to all features',
        features: {
            maxMessages: 'unlimited',
            maxTokens: 'unlimited',
            availableModels: 'all',
            priority: 'high',
            customAgents: true,
            apiAccess: true,
        },
        price: 200,
        isDefault: false,
    },
    {
        id: 'admin',
        name: 'Admin',
        description: 'Unrestricted access for administrators',
        features: {
            maxMessages: 'unlimited',
            maxTokens: 'unlimited',
            availableModels: 'all',
            priority: 'high',
            customAgents: true,
            apiAccess: true,
        },
        price: 0,
        isDefault: false,
        isAdminOnly: true,
    },
];

/**
 * Get a plan by ID
 */
export function getPlanById(planId: string): IPlan | undefined {
    return PLANS.find(p => p.id === planId);
}

/**
 * Get all available plans (excluding admin-only for non-admins)
 */
export function getAvailablePlans(includeAdmin: boolean = false): IPlan[] {
    if (includeAdmin) {
        return PLANS;
    }
    return PLANS.filter(p => !p.isAdminOnly);
}

/**
 * Get default plan
 */
export function getDefaultPlan(): IPlan {
    return PLANS.find(p => p.isDefault) || PLANS[1]; // fallback to 'free'
}

// Schema for custom plans (if needed in future)
const planSchema = new Schema<IPlanDocument>(
    {
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        description: { type: String },
        features: {
            maxMessages: { type: Schema.Types.Mixed, required: true },
            maxTokens: { type: Schema.Types.Mixed, required: true },
            availableModels: { type: Schema.Types.Mixed, required: true },
            priority: { type: String, enum: ['low', 'normal', 'high'], required: true },
            customAgents: { type: Boolean, required: true },
            apiAccess: { type: Boolean, required: true },
        },
        price: { type: Number, required: true },
        isDefault: { type: Boolean, default: false },
        isAdminOnly: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const PlanModel = mongoose.model<IPlanDocument>('Plan', planSchema);
