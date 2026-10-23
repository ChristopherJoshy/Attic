import { Chat } from '../models/chat.js';
import { tierMiddleware } from '../middleware/tier.js';
import { incrementRequestCount } from '../models/usage.js';
import { mongoIdSchema } from '../validation/schemas.js';
import crypto from 'crypto';
export async function chatRoutes(app) {
    // Apply tier middleware to all chat routes
    app.addHook('preHandler', async (request, reply) => {
        // Run authenticate first
        if (app.authenticate) {
            await app.authenticate(request, reply);
        }
        // Then run tier middleware
        if (!reply.sent) {
            await tierMiddleware(request, reply);
        }
    });
    app.post('/api/v1/chats', async (request, reply) => {
        const { userId, sessionId, tier } = request.user;
        try {
            const chat = await Chat.create({
                userId: userId || null,
                sessionId,
                title: 'New Chat',
                messages: [],
                systemProfile: null,
                expiresAt: tier === 'trial' ? new Date(Date.now() + 60 * 60 * 1000) : null,
            });
            app.log.info({
                event: 'chat_created',
                chat: {
                    id: chat._id.toString(),
                    title: chat.title
                },
                user: {
                    id: userId,
                    sessionId,
                    tier
                }
            }, 'New chat created');
            return { id: chat._id.toString(), title: chat.title, createdAt: chat.createdAt };
        }
        catch (err) {
            app.log.error({
                event: 'chat_create_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId, sessionId }
            }, 'Failed to create chat');
            return reply.code(500).send({ error: 'Failed to create chat' });
        }
    });
    app.get('/api/v1/chats', async (request, reply) => {
        const { userId, tier } = request.user;
        if (tier === 'trial') {
            app.log.warn({
                event: 'chat_list_trial_denied',
                user: { userId, tier }
            }, 'Trial user attempted to access chat history');
            return reply.code(403).send({ error: 'Chat history requires login' });
        }
        try {
            const chats = await Chat.find({ userId })
                .select('title createdAt updatedAt')
                .sort({ updatedAt: -1 })
                .limit(50)
                .lean();
            app.log.info({
                event: 'chat_list_retrieved',
                user: { id: userId },
                count: chats.length
            }, 'Retrieved chat history');
            return {
                chats: chats.map((c) => ({
                    id: c._id.toString(),
                    title: c.title,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                })),
            };
        }
        catch (err) {
            app.log.error({
                event: 'chat_list_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                userId
            }, 'Failed to retrieve chat history');
            return reply.code(500).send({ error: 'Failed to retrieve chats' });
        }
    });
    app.get('/api/v1/chats/:id', async (request, reply) => {
        const { id } = request.params;
        const { userId, sessionId } = request.user;
        // Validate chat ID format
        if (!mongoIdSchema.safeParse(id).success) {
            return reply.code(400).send({ error: 'Invalid chat ID format' });
        }
        try {
            const chat = await Chat.findOne({
                _id: id,
                $or: [{ userId }, { sessionId }],
            }).lean();
            if (!chat) {
                app.log.warn({
                    event: 'chat_get_not_found',
                    chat: { id },
                    user: { userId, sessionId }
                }, 'Chat not found or access denied');
                return reply.code(404).send({ error: 'Chat not found' });
            }
            app.log.info({
                event: 'chat_retrieved',
                chat: { id },
                user: { userId }
            }, 'Retrieved chat');
            return chat;
        }
        catch (err) {
            app.log.error({
                event: 'chat_get_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                chat: { id },
                user: { userId }
            }, 'Failed to retrieve chat');
            return reply.code(500).send({ error: 'Failed to retrieve chat' });
        }
    });
    app.delete('/api/v1/chats/:id', async (request, reply) => {
        const { id } = request.params;
        const { userId, sessionId } = request.user;
        // Validate chat ID format
        if (!mongoIdSchema.safeParse(id).success) {
            return reply.code(400).send({ error: 'Invalid chat ID format' });
        }
        try {
            // Allow deletion by userId or sessionId
            const result = await Chat.deleteOne({
                _id: id,
                $or: [{ userId }, { sessionId }],
            });
            if (result.deletedCount === 0) {
                app.log.warn({
                    event: 'chat_delete_not_found',
                    chat: { id },
                    user: { userId, sessionId }
                }, 'Chat deletion failed - not found or access denied');
                return reply.code(404).send({ error: 'Chat not found' });
            }
            app.log.info({
                event: 'chat_deleted',
                chat: { id },
                user: { userId, sessionId }
            }, 'Chat deleted');
            return { deleted: true };
        }
        catch (err) {
            app.log.error({
                event: 'chat_delete_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                chat: { id },
                user: { userId, sessionId }
            }, 'Failed to delete chat');
            return reply.code(500).send({ error: 'Failed to delete chat' });
        }
    });
    // Rename chat endpoint
    app.patch('/api/v1/chats/:id/title', async (request, reply) => {
        const { id } = request.params;
        const { title } = request.body;
        const { userId, sessionId } = request.user;
        // Validate chat ID format
        if (!mongoIdSchema.safeParse(id).success) {
            return reply.code(400).send({ error: 'Invalid chat ID format' });
        }
        // Validate title
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return reply.code(400).send({ error: 'Title is required' });
        }
        if (title.length > 100) {
            return reply.code(400).send({ error: 'Title too long (max 100 characters)' });
        }
        try {
            const result = await Chat.updateOne({
                _id: id,
                $or: [{ userId }, { sessionId }],
            }, {
                $set: { title: title.trim(), updatedAt: new Date() }
            });
            if (result.matchedCount === 0) {
                app.log.warn({
                    event: 'chat_rename_not_found',
                    chat: { id },
                    user: { userId, sessionId }
                }, 'Chat rename failed - not found or access denied');
                return reply.code(404).send({ error: 'Chat not found' });
            }
            app.log.info({
                event: 'chat_renamed',
                chat: { id, newTitle: title.trim() },
                user: { userId, sessionId }
            }, 'Chat renamed');
            return { success: true, title: title.trim() };
        }
        catch (err) {
            app.log.error({
                event: 'chat_rename_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                chat: { id },
                user: { userId, sessionId }
            }, 'Failed to rename chat');
            return reply.code(500).send({ error: 'Failed to rename chat' });
        }
    });
    // Message routes with rate limit tracking
    app.post('/api/v1/chats/:id/messages', async (request, reply) => {
        const { id } = request.params;
        const { content } = request.body;
        const { userId, sessionId } = request.user;
        const tierInfo = request.tierInfo;
        // Validate chat ID format
        if (!mongoIdSchema.safeParse(id).success) {
            return reply.code(400).send({ error: 'Invalid chat ID format' });
        }
        // Input validation
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return reply.code(400).send({ error: 'Message content is required' });
        }
        if (content.length > 10000) {
            return reply.code(400).send({ error: 'Message content too long (max 10000 characters)' });
        }
        try {
            const chat = await Chat.findOne({
                _id: id,
                $or: [{ userId }, { sessionId }],
            });
            if (!chat) {
                return reply.code(404).send({ error: 'Chat not found' });
            }
            // Add user message - timestamp must be a string as per schema
            chat.messages.push({ role: 'user', content: content.trim(), timestamp: new Date().toISOString() });
            // Increment request count for rate limiting
            if (tierInfo) {
                await incrementRequestCount(tierInfo.identifier, tierInfo.identifierType);
            }
            await chat.save();
            app.log.info({
                event: 'message_added',
                chat: { id },
                user: { userId }
            }, 'Message added to chat');
            return { success: true, messageCount: chat.messages.length };
        }
        catch (err) {
            app.log.error({
                event: 'message_add_error',
                error: { message: err.message, stack: err.stack },
                chat: { id },
                user: { userId }
            }, 'Failed to add message');
            return reply.code(500).send({ error: 'Failed to add message' });
        }
    });
    // Share chat endpoint - generates a shareable link
    app.post('/api/v1/chats/:id/share', async (request, reply) => {
        const { id } = request.params;
        const { userId, sessionId } = request.user;
        // Validate chat ID format
        if (!mongoIdSchema.safeParse(id).success) {
            return reply.code(400).send({ error: 'Invalid chat ID format' });
        }
        try {
            const chat = await Chat.findOne({
                _id: id,
                $or: [{ userId }, { sessionId }],
            });
            if (!chat) {
                return reply.code(404).send({ error: 'Chat not found' });
            }
            // Generate a unique share token if not exists
            if (!chat.shareToken) {
                chat.shareToken = crypto.randomBytes(16).toString('hex');
                await chat.save();
            }
            app.log.info({
                event: 'chat_shared',
                chat: { id },
                user: { userId, sessionId }
            }, 'Chat shared');
            return { shareToken: chat.shareToken };
        }
        catch (err) {
            app.log.error({
                event: 'chat_share_error',
                error: { message: err.message, stack: err.stack },
                chat: { id },
                user: { userId }
            }, 'Failed to share chat');
            return reply.code(500).send({ error: 'Failed to share chat' });
        }
    });
    // Unshare chat endpoint - removes the share token
    app.delete('/api/v1/chats/:id/share', async (request, reply) => {
        const { id } = request.params;
        const { userId, sessionId } = request.user;
        // Validate chat ID format
        if (!mongoIdSchema.safeParse(id).success) {
            return reply.code(400).send({ error: 'Invalid chat ID format' });
        }
        try {
            const result = await Chat.updateOne({
                _id: id,
                $or: [{ userId }, { sessionId }],
            }, {
                $set: { shareToken: null }
            });
            if (result.matchedCount === 0) {
                return reply.code(404).send({ error: 'Chat not found' });
            }
            app.log.info({
                event: 'chat_unshared',
                chat: { id },
                user: { userId, sessionId }
            }, 'Chat unshared');
            return { success: true };
        }
        catch (err) {
            app.log.error({
                event: 'chat_unshare_error',
                error: { message: err.message, stack: err.stack },
                chat: { id },
                user: { userId }
            }, 'Failed to unshare chat');
            return reply.code(500).send({ error: 'Failed to unshare chat' });
        }
    });
    // Get shared chat (public, no auth required)
    app.get('/api/v1/shared/:token', async (request, reply) => {
        const { token } = request.params;
        // Basic token validation
        if (!token || token.length !== 32) {
            return reply.code(400).send({ error: 'Invalid share token' });
        }
        try {
            const chat = await Chat.findOne({ shareToken: token })
                .select('title messages createdAt updatedAt')
                .lean();
            if (!chat) {
                return reply.code(404).send({ error: 'Shared chat not found' });
            }
            app.log.info({
                event: 'shared_chat_accessed',
                chat: { id: chat._id, token }
            }, 'Shared chat accessed');
            return {
                id: chat._id.toString(),
                title: chat.title,
                messages: chat.messages,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
            };
        }
        catch (err) {
            app.log.error({
                event: 'shared_chat_error',
                error: { message: err.message, stack: err.stack },
                token
            }, 'Failed to retrieve shared chat');
            return reply.code(500).send({ error: 'Failed to retrieve shared chat' });
        }
    });
}
//# sourceMappingURL=chat.js.map