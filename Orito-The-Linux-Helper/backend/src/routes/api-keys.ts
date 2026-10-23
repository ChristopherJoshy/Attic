import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { 
    UserApiKey, 
    type APIKeyProvider, 
    PROVIDER_DISPLAY_NAMES,
    validateApiKeyFormat 
} from '../models/user-api-keys.js';
import { AuditLog } from '../models/audit-log.js';

// Supported providers with their descriptions - OpenRouter only
const SUPPORTED_PROVIDERS: Array<{ id: APIKeyProvider; name: string; description: string; keyPrefix: string }> = [
    { 
        id: 'openrouter', 
        name: 'OpenRouter', 
        description: 'Access multiple LLM providers through a single API',
        keyPrefix: 'sk-or-v1-'
    },
];

/**
 * Create an audit log entry for API key operations
 */
async function createApiKeyAuditLog(
    action: 'add' | 'update' | 'delete',
    userId: mongoose.Types.ObjectId,
    provider: APIKeyProvider,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    errorMessage?: string
): Promise<void> {
    try {
        await AuditLog.create({
            chatId: null,
            sessionId: null,
            userId,
            actionId: `apikey_${action}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            command: `API_KEY: ${action.toUpperCase()} ${provider}`,
            risk: 'medium', // API key operations are medium risk
            userDecision: success ? 'approved' : 'rejected',
            exitCode: success ? 0 : 1,
            stdout: JSON.stringify({ 
                action, 
                provider, 
                success,
                timestamp: new Date().toISOString()
            }),
            stderr: errorMessage || '',
            hmac: 'apikey_event',
            previousHmac: '',
        } as any);
    } catch (error) {
        // Silently fail audit logging - don't block the operation
        console.error('Failed to create API key audit log:', error);
    }
}

export async function apiKeyRoutes(app: FastifyInstance) {
    /**
     * GET /api/v1/keys/providers
     * List all supported API key providers
     */
    app.get('/api/v1/keys/providers', async (request, reply) => {
        return {
            providers: SUPPORTED_PROVIDERS.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                keyPrefix: p.keyPrefix
            }))
        };
    });

    /**
     * GET /api/v1/keys
     * List user's configured API keys (masked)
     */
    app.get('/api/v1/keys', { preHandler: [app.authenticate] }, async (request, reply) => {
        const decoded = request.user;
        
        // Only authenticated users can manage API keys
        if (!decoded.userId) {
            return reply.code(401).send({ error: 'Authentication required to manage API keys' });
        }

        try {
            const userId = new mongoose.Types.ObjectId(decoded.userId);
            const configuredKeys = await UserApiKey.listConfiguredProviders(userId);

            app.log.info({
                event: 'api_keys_listed',
                userId: decoded.userId,
                keyCount: configuredKeys.length
            }, 'User listed their API keys');

            return {
                keys: configuredKeys.map((k: { provider: APIKeyProvider; keyHint: string; createdAt: Date; updatedAt: Date }) => ({
                    provider: k.provider,
                    providerName: PROVIDER_DISPLAY_NAMES[k.provider],
                    keyHint: `••••${k.keyHint}`,
                    createdAt: k.createdAt.toISOString(),
                    updatedAt: k.updatedAt.toISOString()
                }))
            };
        } catch (err: any) {
            app.log.error({
                event: 'api_keys_list_error',
                error: { message: err.message, stack: err.stack },
                userId: decoded.userId
            }, 'Error listing API keys');
            return reply.code(500).send({ error: 'Failed to list API keys' });
        }
    });

    /**
     * POST /api/v1/keys
     * Add or update an API key for a provider
     */
    app.post('/api/v1/keys', { preHandler: [app.authenticate] }, async (request, reply) => {
        const decoded = request.user;
        
        // Only authenticated users can manage API keys
        if (!decoded.userId) {
            return reply.code(401).send({ error: 'Authentication required to manage API keys' });
        }

        // Validate request body
        const body = request.body as { provider?: string; apiKey?: string };
        const { provider, apiKey } = body;

        if (!provider || !apiKey) {
            return reply.code(400).send({ 
                error: 'Missing required fields',
                details: 'Both provider and apiKey are required'
            });
        }

        // Validate provider
        const validProviders: APIKeyProvider[] = ['openrouter'];
        if (!validProviders.includes(provider as APIKeyProvider)) {
            return reply.code(400).send({ 
                error: 'Invalid provider',
                details: `Supported providers: ${validProviders.join(', ')}`
            });
        }

        const typedProvider = provider as APIKeyProvider;

        // Validate API key format
        const validation = validateApiKeyFormat(typedProvider, apiKey);
        if (!validation.valid) {
            return reply.code(400).send({ 
                error: 'Invalid API key format',
                details: validation.error
            });
        }

        try {
            const userId = new mongoose.Types.ObjectId(decoded.userId);
            
            // Check if this is an update or a new key
            const existingKey = await UserApiKey.findOne({ userId, provider: typedProvider });
            const action = existingKey ? 'update' : 'add';

            // Set the key (will encrypt automatically)
            await UserApiKey.setKey(userId, typedProvider, apiKey);

            // Create audit log
            await createApiKeyAuditLog(
                action,
                userId,
                typedProvider,
                request.ip,
                request.headers['user-agent'] || '',
                true
            );

            app.log.info({
                event: 'api_key_saved',
                userId: decoded.userId,
                provider: typedProvider,
                action
            }, `API key ${action === 'add' ? 'added' : 'updated'} for provider`);

            return {
                success: true,
                message: `API key for ${PROVIDER_DISPLAY_NAMES[typedProvider]} ${action === 'add' ? 'added' : 'updated'} successfully`,
                provider: typedProvider,
                providerName: PROVIDER_DISPLAY_NAMES[typedProvider],
                keyHint: `••••${apiKey.slice(-4)}`
            };
        } catch (err: any) {
            app.log.error({
                event: 'api_key_save_error',
                error: { message: err.message, stack: err.stack },
                userId: decoded.userId,
                provider: typedProvider
            }, 'Error saving API key');

            // Create audit log for failed attempt
            await createApiKeyAuditLog(
                'add',
                new mongoose.Types.ObjectId(decoded.userId),
                typedProvider,
                request.ip,
                request.headers['user-agent'] || '',
                false,
                err.message
            );

            return reply.code(500).send({ error: 'Failed to save API key' });
        }
    });

    /**
     * DELETE /api/v1/keys/:provider
     * Remove an API key for a provider
     */
    app.delete('/api/v1/keys/:provider', { preHandler: [app.authenticate] }, async (request, reply) => {
        const decoded = request.user;
        
        // Only authenticated users can manage API keys
        if (!decoded.userId) {
            return reply.code(401).send({ error: 'Authentication required to manage API keys' });
        }

        const { provider } = request.params as { provider: string };

        // Validate provider
        const validProviders: APIKeyProvider[] = ['openrouter'];
        if (!validProviders.includes(provider as APIKeyProvider)) {
            return reply.code(400).send({ 
                error: 'Invalid provider',
                details: `Supported providers: ${validProviders.join(', ')}`
            });
        }

        const typedProvider = provider as APIKeyProvider;

        try {
            const userId = new mongoose.Types.ObjectId(decoded.userId);
            
            // Delete the key
            const deleted = await UserApiKey.deleteKey(userId, typedProvider);

            if (!deleted) {
                return reply.code(404).send({ 
                    error: 'API key not found',
                    details: `No API key configured for ${PROVIDER_DISPLAY_NAMES[typedProvider]}`
                });
            }

            // Create audit log
            await createApiKeyAuditLog(
                'delete',
                userId,
                typedProvider,
                request.ip,
                request.headers['user-agent'] || '',
                true
            );

            app.log.info({
                event: 'api_key_deleted',
                userId: decoded.userId,
                provider: typedProvider
            }, 'API key deleted');

            return {
                success: true,
                message: `API key for ${PROVIDER_DISPLAY_NAMES[typedProvider]} deleted successfully`
            };
        } catch (err: any) {
            app.log.error({
                event: 'api_key_delete_error',
                error: { message: err.message, stack: err.stack },
                userId: decoded.userId,
                provider: typedProvider
            }, 'Error deleting API key');

            return reply.code(500).send({ error: 'Failed to delete API key' });
        }
    });

    /**
     * GET /api/v1/keys/status
     * Check if user has custom API keys configured
     */
    app.get('/api/v1/keys/status', { preHandler: [app.authenticate] }, async (request, reply) => {
        const decoded = request.user;
        
        if (!decoded.userId) {
            return { hasCustomKeys: false };
        }

        try {
            const userId = new mongoose.Types.ObjectId(decoded.userId);
            const hasCustomKeys = await UserApiKey.hasCustomKeys(userId);
            return { hasCustomKeys };
        } catch (err: any) {
            app.log.error({
                event: 'api_keys_status_error',
                error: { message: err.message },
                userId: decoded.userId
            }, 'Error checking API key status');
            return { hasCustomKeys: false };
        }
    });
}
