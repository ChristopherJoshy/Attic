import mongoose, { Schema, Document, Model } from 'mongoose';
import * as crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Supported API key providers - OpenRouter only
export type APIKeyProvider = 'openrouter';

// Provider-specific key format patterns for validation
const PROVIDER_KEY_PATTERNS: Record<APIKeyProvider, RegExp> = {
    openrouter: /^sk-or-v1-[a-zA-Z0-9_-]{32,}$/,
};

// Provider display names
export const PROVIDER_DISPLAY_NAMES: Record<APIKeyProvider, string> = {
    openrouter: 'OpenRouter',
};

export interface IUserApiKey extends Document {
    userId: mongoose.Types.ObjectId;
    provider: APIKeyProvider;
    encryptedKey: string;
    keyHint: string; // Last 4 characters for display
    iv: string; // Initialization vector (hex)
    authTag: string; // Authentication tag (hex)
    salt: string; // Key derivation salt (hex)
    createdAt: Date;
    updatedAt: Date;
}

// Interface for static methods
interface IUserApiKeyModel extends Model<IUserApiKey> {
    getDecryptedKey(userId: mongoose.Types.ObjectId, provider: APIKeyProvider): Promise<string | null>;
    setKey(userId: mongoose.Types.ObjectId, provider: APIKeyProvider, plainKey: string): Promise<IUserApiKey>;
    listConfiguredProviders(userId: mongoose.Types.ObjectId): Promise<Array<{ provider: APIKeyProvider; keyHint: string; createdAt: Date; updatedAt: Date }>>;
    deleteKey(userId: mongoose.Types.ObjectId, provider: APIKeyProvider): Promise<boolean>;
    hasCustomKeys(userId: mongoose.Types.ObjectId): Promise<boolean>;
}

/**
 * Get encryption key from environment or derive from JWT secret
 */
function getEncryptionKey(salt: Buffer): Buffer {
    const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('No encryption secret configured. Set API_KEY_ENCRYPTION_SECRET or JWT_SECRET');
    }
    // Derive a 32-byte key using PBKDF2
    return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha512');
}

/**
 * Encrypt an API key using AES-256-GCM
 */
export function encryptApiKey(plainKey: string): { encrypted: string; iv: string; authTag: string; salt: string } {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = getEncryptionKey(salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plainKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex'),
    };
}

/**
 * Decrypt an API key using AES-256-GCM
 */
export function decryptApiKey(encrypted: string, ivHex: string, authTagHex: string, saltHex: string): string {
    const salt = Buffer.from(saltHex, 'hex');
    const key = getEncryptionKey(salt);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

/**
 * Validate API key format for a specific provider
 */
export function validateApiKeyFormat(provider: APIKeyProvider, key: string): { valid: boolean; error?: string } {
    const pattern = PROVIDER_KEY_PATTERNS[provider];
    if (!pattern) {
        return { valid: false, error: `Unknown provider: ${provider}` };
    }
    
    if (!pattern.test(key)) {
        return { 
            valid: false, 
            error: `Invalid ${PROVIDER_DISPLAY_NAMES[provider]} API key format. Key should match pattern: ${pattern.source}` 
        };
    }
    
    return { valid: true };
}

/**
 * Get key hint (last 4 characters) for display
 */
export function getKeyHint(key: string): string {
    if (key.length <= 4) {
        return '****';
    }
    return key.slice(-4);
}

/**
 * Mask API key for display (show only last 4 characters)
 */
export function maskApiKey(key: string): string {
    if (key.length <= 4) {
        return '****';
    }
    return '••••••••••••••••' + key.slice(-4);
}

const userApiKeySchema = new Schema<IUserApiKey>(
    {
        userId: { 
            type: Schema.Types.ObjectId, 
            ref: 'User', 
            required: true, 
            index: true 
        },
        provider: { 
            type: String, 
            enum: ['openrouter'], 
            required: true 
        },
        encryptedKey: { 
            type: String, 
            required: true,
            select: false // Don't return encrypted key by default
        },
        keyHint: { 
            type: String, 
            required: true 
        },
        iv: { 
            type: String, 
            required: true,
            select: false 
        },
        authTag: { 
            type: String, 
            required: true,
            select: false 
        },
        salt: { 
            type: String, 
            required: true,
            select: false 
        },
    },
    { 
        timestamps: true,
        collection: 'user_api_keys'
    }
);

// Compound unique index - one key per provider per user
userApiKeySchema.index({ userId: 1, provider: 1 }, { unique: true });

// Static method to get decrypted API key for a user and provider
userApiKeySchema.statics.getDecryptedKey = async function(
    userId: mongoose.Types.ObjectId, 
    provider: APIKeyProvider
): Promise<string | null> {
    const keyRecord = await this.findOne({ userId, provider }).select('+encryptedKey +iv +authTag +salt');
    
    if (!keyRecord) {
        return null;
    }
    
    try {
        return decryptApiKey(
            keyRecord.encryptedKey,
            keyRecord.iv,
            keyRecord.authTag,
            keyRecord.salt
        );
    } catch (error) {
        console.error(`Failed to decrypt API key for user ${userId}, provider ${provider}:`, error);
        return null;
    }
};

// Static method to set (add or update) an API key
userApiKeySchema.statics.setKey = async function(
    userId: mongoose.Types.ObjectId,
    provider: APIKeyProvider,
    plainKey: string
): Promise<IUserApiKey> {
    // Validate key format
    const validation = validateApiKeyFormat(provider, plainKey);
    if (!validation.valid) {
        throw new Error(validation.error);
    }
    
    // Encrypt the key
    const { encrypted, iv, authTag, salt } = encryptApiKey(plainKey);
    const keyHint = getKeyHint(plainKey);
    
    // Upsert the key
    const result = await this.findOneAndUpdate(
        { userId, provider },
        { 
            encryptedKey: encrypted, 
            keyHint, 
            iv, 
            authTag, 
            salt,
            updatedAt: new Date()
        },
        { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true
        }
    );
    
    return result;
};

// Static method to list configured providers for a user (without exposing keys)
userApiKeySchema.statics.listConfiguredProviders = async function(
    userId: mongoose.Types.ObjectId
): Promise<Array<{ provider: APIKeyProvider; keyHint: string; createdAt: Date; updatedAt: Date }>> {
    const keys = await this.find({ userId }).select('provider keyHint createdAt updatedAt');
    return keys.map((k: IUserApiKey) => ({
        provider: k.provider,
        keyHint: k.keyHint,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt
    }));
};

// Static method to delete a key
userApiKeySchema.statics.deleteKey = async function(
    userId: mongoose.Types.ObjectId,
    provider: APIKeyProvider
): Promise<boolean> {
    const result = await this.deleteOne({ userId, provider });
    return result.deletedCount > 0;
};

// Static method to check if user has any custom keys configured
userApiKeySchema.statics.hasCustomKeys = async function(
    userId: mongoose.Types.ObjectId
): Promise<boolean> {
    const count = await this.countDocuments({ userId });
    return count > 0;
};

export const UserApiKey = mongoose.model<IUserApiKey, IUserApiKeyModel>('UserApiKey', userApiKeySchema);
