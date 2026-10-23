import { UserPreferences } from '../models/user-preferences.js';
import { updatePreferencesSchema, mongoIdSchema, validateOrThrow } from '../validation/schemas.js';
const TIER_ALLOWED_FIELDS = {
    trial: [],
    free: [
        'responseStyle', 'technicalLevel', 'defaultDistro', 'defaultShell',
        'fontSize', 'showAgentCards', 'compactMode', 'showCitationsInline',
        'explainBeforeCommands', 'includeAlternatives', 'warnAboutSideEffects',
        'customInstructions',
    ],
    pro: [
        'responseStyle', 'technicalLevel', 'defaultDistro', 'defaultShell',
        'fontSize', 'showAgentCards', 'autoApproveLowRisk', 'compactMode',
        'showCitationsInline', 'explainBeforeCommands', 'includeAlternatives',
        'warnAboutSideEffects', 'customInstructions', 'memory', 'docSources',
    ],
};
function filterByTier(data, tier) {
    const allowed = TIER_ALLOWED_FIELDS[tier] || [];
    const filtered = {};
    for (const key of allowed) {
        if (key in data)
            filtered[key] = data[key];
    }
    return filtered;
}
export async function preferencesRoutes(app) {
    app.get('/api/v1/preferences', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user;
        if (!userId || tier === 'trial') {
            app.log.warn({
                event: 'preferences_get_trial_denied',
                user: { userId, tier }
            }, 'Trial user attempted to access preferences');
            return reply.code(403).send({ error: 'Settings not available on trial tier' });
        }
        try {
            let prefs = await UserPreferences.findOne({ userId });
            if (!prefs) {
                app.log.info({
                    event: 'preferences_created',
                    user: { userId }
                }, 'Creating default preferences');
                prefs = await UserPreferences.create({ userId });
            }
            const obj = prefs.toObject();
            const allowed = TIER_ALLOWED_FIELDS[tier] || [];
            const result = { tier, allowedFields: allowed };
            for (const key of allowed) {
                result[key] = obj[key];
            }
            app.log.info({
                event: 'preferences_retrieved',
                user: { userId, tier }
            }, 'Retrieved user preferences');
            return result;
        }
        catch (err) {
            app.log.error({
                event: 'preferences_get_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId }
            }, 'Failed to retrieve preferences');
            return reply.code(500).send({ error: 'Failed to retrieve preferences' });
        }
    });
    app.patch('/api/v1/preferences', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user;
        if (!userId || tier === 'trial') {
            app.log.warn({
                event: 'preferences_update_trial_denied',
                user: { userId, tier }
            }, 'Trial user attempted to update preferences');
            return reply.code(403).send({ error: 'Settings not available on trial tier' });
        }
        // Input validation
        let validatedBody;
        try {
            const validated = validateOrThrow(updatePreferencesSchema, { body: request.body });
            validatedBody = validated.body;
        }
        catch (err) {
            app.log.warn({
                event: 'preferences_validation_error',
                error: err.message,
                user: { userId }
            }, 'Preferences validation failed');
            return reply.code(400).send({ error: err.message });
        }
        const updates = filterByTier(validatedBody, tier);
        if (Object.keys(updates).length === 0) {
            app.log.warn({
                event: 'preferences_update_no_fields',
                user: { userId },
                attemptedFields: Object.keys(request.body)
            }, 'No allowed fields in preference update');
            return reply.code(400).send({ error: 'No allowed fields to update' });
        }
        if (updates.docSources && tier !== 'pro') {
            app.log.warn({
                event: 'preferences_update_tier_violation',
                user: { userId, tier },
                field: 'docSources'
            }, 'Non-pro user attempted to update doc sources');
            delete updates.docSources;
        }
        try {
            const prefs = await UserPreferences.findOneAndUpdate({ userId }, { $set: updates }, { new: true, upsert: true });
            app.log.info({
                event: 'preferences_updated',
                user: { userId },
                updatedFields: Object.keys(updates)
            }, 'Updated user preferences');
            return { updated: true, preferences: prefs };
        }
        catch (err) {
            app.log.error({
                event: 'preferences_update_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId },
                updates: Object.keys(updates)
            }, 'Failed to update preferences');
            return reply.code(500).send({ error: 'Failed to update preferences' });
        }
    });
    app.post('/api/v1/preferences/memory', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user;
        if (!userId || tier !== 'pro') {
            app.log.warn({
                event: 'memory_add_tier_denied',
                user: { userId, tier }
            }, 'Non-pro user attempted memory management');
            return reply.code(403).send({ error: 'Memory management requires Pro tier' });
        }
        // Input validation
        const body = request.body;
        if (!body.key || typeof body.key !== 'string' || body.key.trim().length === 0) {
            return reply.code(400).send({ error: 'Memory key is required' });
        }
        if (body.key.length > 200) {
            return reply.code(400).send({ error: 'Memory key too long (max 200 characters)' });
        }
        if (!body.value || typeof body.value !== 'string') {
            return reply.code(400).send({ error: 'Memory value is required' });
        }
        if (body.value.length > 5000) {
            return reply.code(400).send({ error: 'Memory value too long (max 5000 characters)' });
        }
        if (body.source && body.source.length > 100) {
            return reply.code(400).send({ error: 'Source too long (max 100 characters)' });
        }
        const key = body.key.trim();
        const value = body.value;
        const source = body.source?.trim() || 'user';
        try {
            const prefs = await UserPreferences.findOneAndUpdate({ userId }, { $push: { memory: { key, value, source, createdAt: new Date() } } }, { new: true, upsert: true });
            app.log.info({
                event: 'memory_added',
                user: { userId },
                memory: { key, source }
            }, 'Added memory entry');
            return { memory: prefs.memory };
        }
        catch (err) {
            app.log.error({
                event: 'memory_add_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId },
                memory: { key }
            }, 'Failed to add memory entry');
            return reply.code(500).send({ error: 'Failed to add memory' });
        }
    });
    app.delete('/api/v1/preferences/memory/:memoryId', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user;
        const { memoryId } = request.params;
        if (!userId || tier !== 'pro') {
            app.log.warn({
                event: 'memory_delete_tier_denied',
                user: { userId, tier },
                memory: { id: memoryId }
            }, 'Non-pro user attempted memory deletion');
            return reply.code(403).send({ error: 'Memory management requires Pro tier' });
        }
        // Validate memoryId format
        if (!mongoIdSchema.safeParse(memoryId).success) {
            return reply.code(400).send({ error: 'Invalid memory ID format' });
        }
        try {
            await UserPreferences.findOneAndUpdate({ userId }, { $pull: { memory: { _id: memoryId } } });
            app.log.info({
                event: 'memory_deleted',
                user: { userId },
                memory: { id: memoryId }
            }, 'Deleted memory entry');
            return { deleted: true };
        }
        catch (err) {
            app.log.error({
                event: 'memory_delete_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId },
                memory: { id: memoryId }
            }, 'Failed to delete memory entry');
            return reply.code(500).send({ error: 'Failed to delete memory' });
        }
    });
    app.put('/api/v1/preferences/memory/:memoryId', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user;
        const { memoryId } = request.params;
        const body = request.body;
        if (!userId || tier !== 'pro') {
            app.log.warn({
                event: 'memory_update_tier_denied',
                user: { userId, tier },
                memory: { id: memoryId }
            }, 'Non-pro user attempted memory update');
            return reply.code(403).send({ error: 'Memory management requires Pro tier' });
        }
        // Validate memoryId format
        if (!mongoIdSchema.safeParse(memoryId).success) {
            return reply.code(400).send({ error: 'Invalid memory ID format' });
        }
        // Input validation
        if (!body.value || typeof body.value !== 'string') {
            return reply.code(400).send({ error: 'Memory value is required' });
        }
        if (body.value.length > 5000) {
            return reply.code(400).send({ error: 'Memory value too long (max 5000 characters)' });
        }
        try {
            await UserPreferences.findOneAndUpdate({ userId, 'memory._id': memoryId }, { $set: { 'memory.$.value': body.value } });
            app.log.info({
                event: 'memory_updated',
                user: { userId },
                memory: { id: memoryId }
            }, 'Updated memory entry');
            return { updated: true };
        }
        catch (err) {
            app.log.error({
                event: 'memory_update_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId },
                memory: { id: memoryId }
            }, 'Failed to update memory entry');
            return reply.code(500).send({ error: 'Failed to update memory' });
        }
    });
    app.post('/api/v1/preferences/doc-sources', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user;
        if (!userId || tier !== 'pro') {
            app.log.warn({
                event: 'doc_source_add_tier_denied',
                user: { userId, tier }
            }, 'Non-pro user attempted to add doc source');
            return reply.code(403).send({ error: 'Custom doc sources require Pro tier' });
        }
        // Input validation
        const body = request.body;
        if (!body.url || typeof body.url !== 'string' || body.url.trim().length === 0) {
            return reply.code(400).send({ error: 'URL is required' });
        }
        if (body.url.length > 2000) {
            return reply.code(400).send({ error: 'URL too long (max 2000 characters)' });
        }
        if (body.label && body.label.length > 200) {
            return reply.code(400).send({ error: 'Label too long (max 200 characters)' });
        }
        const url = body.url.trim();
        const label = body.label?.trim() || '';
        // Validate URL format
        try {
            new URL(url);
        }
        catch {
            app.log.warn({
                event: 'doc_source_add_invalid_url',
                user: { userId },
                url
            }, 'Invalid URL for doc source');
            return reply.code(400).send({ error: 'Invalid URL format' });
        }
        // Only allow http and https protocols
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return reply.code(400).send({ error: 'Only HTTP and HTTPS URLs are allowed' });
        }
        try {
            const prefs = await UserPreferences.findOneAndUpdate({ userId }, { $push: { docSources: { url, label, addedAt: new Date() } } }, { new: true, upsert: true });
            app.log.info({
                event: 'doc_source_added',
                user: { userId },
                docSource: { url, label }
            }, 'Added doc source');
            return { docSources: prefs.docSources };
        }
        catch (err) {
            app.log.error({
                event: 'doc_source_add_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId },
                docSource: { url }
            }, 'Failed to add doc source');
            return reply.code(500).send({ error: 'Failed to add doc source' });
        }
    });
    app.delete('/api/v1/preferences/doc-sources/:sourceId', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user;
        const { sourceId } = request.params;
        if (!userId || tier !== 'pro') {
            app.log.warn({
                event: 'doc_source_delete_tier_denied',
                user: { userId, tier },
                docSource: { id: sourceId }
            }, 'Non-pro user attempted to delete doc source');
            return reply.code(403).send({ error: 'Custom doc sources require Pro tier' });
        }
        // Validate sourceId format
        if (!mongoIdSchema.safeParse(sourceId).success) {
            return reply.code(400).send({ error: 'Invalid source ID format' });
        }
        try {
            await UserPreferences.findOneAndUpdate({ userId }, { $pull: { docSources: { _id: sourceId } } });
            app.log.info({
                event: 'doc_source_deleted',
                user: { userId },
                docSource: { id: sourceId }
            }, 'Deleted doc source');
            return { deleted: true };
        }
        catch (err) {
            app.log.error({
                event: 'doc_source_delete_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId },
                docSource: { id: sourceId }
            }, 'Failed to delete doc source');
            return reply.code(500).send({ error: 'Failed to delete doc source' });
        }
    });
}
//# sourceMappingURL=preferences.js.map