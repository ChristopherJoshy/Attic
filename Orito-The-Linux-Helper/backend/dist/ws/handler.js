import '@fastify/websocket';
import { Orchestrator } from '../agents/orchestrator.js';
import { Chat } from '../models/chat.js';
import { analyzeImage } from '../llm/gemini-client.js';
import { openRouterComplete } from '../llm/openrouter-client.js';
import { TIER_LIMITS } from '../config/index.js';
import { getOrCreateUsage, incrementRequestCount, incrementGeminiImageCount } from '../models/usage.js';
import { convertToLegacyProfile } from '../agents/system-profile.js';
// Track active WebSocket connections for monitoring
const activeConnections = new Map();
const MAX_CONNECTIONS_PER_USER = 5; // Prevent abuse
// Cleanup function to remove stale connections
setInterval(() => {
    const now = Date.now();
    for (const [key, conn] of activeConnections.entries()) {
        // Remove connections older than 6 hours or closed sockets
        if (now - conn.connectedAt.getTime() > 6 * 60 * 60 * 1000 || conn.socket.readyState === 3) {
            activeConnections.delete(key);
        }
    }
}, 60000); // Cleanup every minute
/**
 * Generate an intelligent chat title using OpenRouter.
 * Uses the LLM to create a concise, descriptive title from the user's first message.
 */
async function generateChatTitle(firstMessage) {
    try {
        const prompt = `Generate a very short, descriptive chat title (max 5 words) for this user message. Only return the title, nothing else.

User message: "${firstMessage.substring(0, 200)}"

Title:`;
        const response = await openRouterComplete([
            { role: 'user', content: prompt }
        ], {
            maxTokens: 20,
            temperature: 0.7,
            skipCache: true, // Don't cache title generation
        });
        const title = response.content.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
        // Fallback to simple truncation if LLM returns empty/invalid
        if (!title || title.length === 0) {
            const cleaned = firstMessage.trim().replace(/\s+/g, ' ');
            return cleaned.length <= 50 ? cleaned : cleaned.substring(0, 47) + '...';
        }
        // Ensure max length
        return title.length <= 60 ? title : title.substring(0, 57) + '...';
    }
    catch (err) {
        // Fallback: use simple truncation if OpenRouter fails
        const cleaned = firstMessage.trim().replace(/\s+/g, ' ');
        return cleaned.length <= 50 ? cleaned : cleaned.substring(0, 47) + '...';
    }
}
/**
 * WebSocket authentication middleware
 * Accepts JWT via Authorization header (preferred) or query parameter (fallback with warning)
 */
async function wsAuthenticate(app, request, reply) {
    // Try Authorization header first (secure method)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = await app.jwt.verify(token);
            request.user = decoded;
            return true;
        }
        catch (err) {
            app.log.warn({
                event: 'ws_auth_header_invalid',
                ip: request.ip,
                path: request.url
            }, 'WebSocket authentication failed - invalid token in header');
            return false;
        }
    }
    // Fallback: Check query parameter (less secure, logs warning)
    const query = request.query;
    const tokenFromQuery = query?.token;
    if (tokenFromQuery) {
        app.log.warn({
            event: 'ws_auth_query_param_used',
            ip: request.ip,
            path: request.url,
            message: 'JWT passed via query parameter - this may be logged and is less secure. Use Authorization header instead.'
        }, 'WebSocket auth using query parameter (deprecated)');
        try {
            const decoded = await app.jwt.verify(tokenFromQuery);
            request.user = decoded;
            return true;
        }
        catch (err) {
            app.log.warn({
                event: 'ws_auth_query_invalid',
                ip: request.ip
            }, 'WebSocket authentication failed - invalid token in query');
            return false;
        }
    }
    app.log.warn({
        event: 'ws_auth_no_token',
        ip: request.ip,
        path: request.url
    }, 'WebSocket connection attempt without authentication');
    return false;
}
export async function wsHandler(app) {
    app.get('/ws/chat/:chatId', { websocket: true }, async (socket, request) => {
        // Authenticate the WebSocket connection
        const isAuthenticated = await wsAuthenticate(app, request, null);
        if (!isAuthenticated) {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            }));
            socket.close(1008, 'Policy Violation');
            return;
        }
        const { chatId } = request.params;
        const user = request.user;
        const { userId, sessionId, tier } = user;
        // Check connection limits per user
        const userKey = userId || sessionId;
        const userConnections = Array.from(activeConnections.values()).filter(c => (c.userId === userId && userId) || (c.chatId && userId === null));
        if (userConnections.length >= MAX_CONNECTIONS_PER_USER) {
            app.log.warn({
                event: 'ws_connection_limit_exceeded',
                user: { userId, sessionId, tier },
                activeConnections: userConnections.length
            }, 'User exceeded maximum concurrent WebSocket connections');
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Too many concurrent connections. Please close some tabs.',
                code: 'CONNECTION_LIMIT_EXCEEDED'
            }));
            socket.close(1008, 'Policy Violation');
            return;
        }
        // Validate chatId format
        if (!chatId || typeof chatId !== 'string' || !/^[a-fA-F0-9]{24}$/.test(chatId)) {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Invalid chat ID format',
                code: 'INVALID_CHAT_ID'
            }));
            socket.close(1008, 'Policy Violation');
            return;
        }
        try {
            const chat = await Chat.findOne({
                _id: chatId,
                $or: [{ userId }, { sessionId }],
            });
            if (!chat) {
                socket.send(JSON.stringify({
                    type: 'error',
                    message: 'Chat not found',
                    code: 'CHAT_NOT_FOUND'
                }));
                socket.close();
                return;
            }
            // Check rate limits for trial tier
            const limits = TIER_LIMITS[tier];
            const identifier = userId || sessionId;
            const identifierType = userId ? 'user' : 'session';
            try {
                const usage = await getOrCreateUsage(identifier, identifierType);
                if (limits.requestsTotal !== Infinity && usage.requestCount >= limits.requestsTotal) {
                    app.log.warn({
                        event: 'ws_rate_limit_exceeded',
                        user: { identifier, tier },
                        limits: { total: limits.requestsTotal, used: usage.requestCount }
                    }, 'WebSocket rate limit exceeded');
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: `Rate limit exceeded. You have used all ${limits.requestsTotal} requests for this month.`,
                        code: 'RATE_LIMIT_EXCEEDED',
                        currentUsage: usage.requestCount,
                        limit: limits.requestsTotal
                    }));
                    socket.close(1008, 'Policy Violation');
                    return;
                }
            }
            catch (usageError) {
                app.log.error({
                    event: 'ws_usage_check_error',
                    error: usageError instanceof Error ? usageError.message : 'Unknown error'
                }, 'Error checking usage for WebSocket');
                // Continue on error (fail open)
            }
            // Parse system profile from chat context or legacy systemProfile field
            let systemProfile = chat.systemProfile || null;
            // Check for profile in chat.context (question-based collection)
            if (!systemProfile && chat.context?.systemProfile) {
                const profileData = chat.context.systemProfile;
                systemProfile = convertToLegacyProfile(profileData);
            }
            const context = {
                chatId,
                userId,
                sessionId,
                tier,
                systemProfile,
                messageHistory: chat.messages || [],
            };
            const orchestrator = new Orchestrator(context);
            // Track active connection
            const connectionKey = `${userKey}-${chatId}-${Date.now()}`;
            activeConnections.set(connectionKey, {
                socket,
                userId,
                chatId,
                connectedAt: new Date()
            });
            app.log.info({
                event: 'ws_connected',
                user: { userId, tier },
                chat: { id: chatId },
                activeConnections: activeConnections.size
            }, 'WebSocket connection established');
            // Track assistant message state for persistence
            let assistantMessageState = null;
            orchestrator.on('event', (event) => {
                try {
                    socket.send(JSON.stringify(event));
                    // Track assistant message content for persistence
                    if (event.type === 'message:chunk') {
                        if (!assistantMessageState) {
                            assistantMessageState = {
                                content: '',
                                citations: [],
                                commands: [],
                                startTime: Date.now(),
                            };
                        }
                        assistantMessageState.content += event.content;
                    }
                    // Save assistant message when done
                    if (event.type === 'message:done' && assistantMessageState) {
                        console.log('[DEBUG-WS] Received message:done event');
                        assistantMessageState.citations = event.citations || [];
                        assistantMessageState.commands = event.commands || [];
                        const assistantMessage = {
                            role: 'assistant',
                            content: assistantMessageState.content,
                            citations: assistantMessageState.citations,
                            commands: assistantMessageState.commands,
                            timestamp: new Date().toISOString(),
                        };
                        console.log('[DEBUG-WS] Saving assistant message to DB:', assistantMessage.content.substring(0, 50));
                        // Persist assistant message to database
                        Chat.updateOne({ _id: chatId }, {
                            $push: { messages: assistantMessage },
                            $set: { updatedAt: new Date() }
                        }).then(() => {
                            console.log('[DEBUG-WS] Assistant message saved successfully');
                        }).catch((err) => {
                            app.log.error({
                                event: 'ws_assistant_message_save_error',
                                error: err instanceof Error ? err.message : 'Unknown error',
                                chatId
                            }, 'Failed to save assistant message');
                        });
                        // Reset state for next message
                        assistantMessageState = null;
                        console.log('[DEBUG-WS] Reset assistantMessageState');
                    }
                }
                catch (sendError) {
                    app.log.error({
                        event: 'ws_send_error',
                        error: sendError instanceof Error ? sendError.message : 'Unknown error'
                    }, 'Error sending WebSocket message');
                }
            });
            socket.on('message', async (rawData) => {
                try {
                    const data = JSON.parse(rawData.toString());
                    if (data.type === 'message') {
                        // Input validation
                        const content = data.content || '';
                        const image = data.image;
                        // Allow messages with content OR image
                        if ((!content || content.trim().length === 0) && !image) {
                            socket.send(JSON.stringify({
                                type: 'error',
                                message: 'Message content or image is required',
                                code: 'INVALID_MESSAGE'
                            }));
                            return;
                        }
                        if (content && content.length > 50000) {
                            socket.send(JSON.stringify({
                                type: 'error',
                                message: 'Message content too long (max 50000 characters)',
                                code: 'MESSAGE_TOO_LONG'
                            }));
                            return;
                        }
                        // Build user message with optional image
                        const userMessage = {
                            role: 'user',
                            content: content.trim() || (image ? '[Image uploaded]' : ''),
                            timestamp: new Date().toISOString(),
                        };
                        // Add image URL if present
                        if (image && image.data && image.mimeType) {
                            userMessage.imageUrl = `data:${image.mimeType};base64,${image.data}`;
                        }
                        // Check if this is the first user message (chat title is still "New Chat")
                        const isFirstMessage = chat.title === 'New Chat' && chat.messages.length === 0;
                        await Chat.updateOne({ _id: chatId }, { $push: { messages: userMessage } });
                        // Auto-generate title from first message using OpenRouter
                        if (isFirstMessage) {
                            const newTitle = await generateChatTitle(content.trim() || 'Image analysis');
                            await Chat.updateOne({ _id: chatId }, { $set: { title: newTitle } });
                            // Notify frontend of title update
                            socket.send(JSON.stringify({
                                type: 'chat_title_updated',
                                title: newTitle,
                            }));
                            app.log.info({
                                event: 'chat_title_generated',
                                chat: { id: chatId, title: newTitle }
                            }, 'Auto-generated chat title using OpenRouter');
                        }
                        // Increment request count for rate limiting
                        try {
                            await incrementRequestCount(identifier, identifierType);
                        }
                        catch (incrementError) {
                            app.log.error({
                                event: 'ws_increment_usage_error',
                                error: incrementError instanceof Error ? incrementError.message : 'Unknown error'
                            }, 'Error incrementing usage count');
                        }
                        // Handle image with message - route to Gemini
                        if (image && image.data && image.mimeType) {
                            // Check Gemini-specific limits
                            const geminiLimit = limits.geminiImageAnalysis;
                            const usage = await getOrCreateUsage(identifier, identifierType);
                            if (geminiLimit !== Infinity && usage.geminiImageCount >= geminiLimit) {
                                socket.send(JSON.stringify({
                                    type: 'error',
                                    message: `Gemini image analysis limit exceeded. You have used all ${geminiLimit} analyses this month. Upgrade to Pro for unlimited access.`,
                                    code: 'GEMINI_LIMIT_EXCEEDED',
                                }));
                                return;
                            }
                            // Validate image format
                            if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.mimeType)) {
                                socket.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Invalid image format. Supported: JPEG, PNG, WebP, GIF',
                                    code: 'INVALID_IMAGE_FORMAT'
                                }));
                                return;
                            }
                            try {
                                const analysis = await analyzeImage(image.data, image.mimeType, content.trim() || 'Describe this image');
                                // Increment usage after successful analysis
                                await incrementGeminiImageCount(identifier, identifierType);
                                // Save assistant response to chat history
                                const assistantMessage = {
                                    role: 'assistant',
                                    content: analysis,
                                    timestamp: new Date().toISOString(),
                                };
                                await Chat.updateOne({ _id: chatId }, {
                                    $push: { messages: assistantMessage },
                                    $set: { updatedAt: new Date() }
                                });
                                // Send response to client
                                socket.send(JSON.stringify({
                                    type: 'message:chunk',
                                    content: analysis,
                                }));
                                socket.send(JSON.stringify({
                                    type: 'message:done',
                                    citations: [],
                                    commands: [],
                                }));
                            }
                            catch (imageError) {
                                app.log.error({
                                    event: 'ws_image_analysis_error',
                                    error: imageError instanceof Error ? imageError.message : 'Unknown error'
                                }, 'Image analysis failed');
                                socket.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Image analysis failed. Please try again.',
                                    code: 'IMAGE_ANALYSIS_ERROR'
                                }));
                            }
                        }
                        else {
                            // Normal text-only flow - route through orchestrator
                            console.log('[DEBUG-WS] Calling orchestrator.process() with message:', content.trim().substring(0, 50));
                            await orchestrator.process(content.trim());
                            console.log('[DEBUG-WS] orchestrator.process() completed');
                        }
                    }
                    if (data.type === 'system_info') {
                        const profile = await Orchestrator.parseDiscoveryOutput(data.outputs);
                        orchestrator.updateSystemProfile(profile);
                        // Update both legacy systemProfile and new context.systemProfile
                        await Chat.updateOne({ _id: chatId }, {
                            $set: {
                                systemProfile: { ...context.systemProfile, ...profile },
                                'context.systemProfile': { ...context.systemProfile, ...profile }
                            }
                        });
                        socket.send(JSON.stringify({
                            type: 'system_profile_updated',
                            profile: { ...context.systemProfile, ...profile },
                        }));
                        if (data.pendingQuery) {
                            await orchestrator.process(data.pendingQuery);
                        }
                    }
                    // Handle system profile updates from question-based collection
                    if (data.type === 'system_profile_update') {
                        const profile = data.profile;
                        if (profile) {
                            orchestrator.updateSystemProfile(convertToLegacyProfile(profile));
                            // Save to database in both formats
                            await Chat.updateOne({ _id: chatId }, {
                                $set: {
                                    systemProfile: convertToLegacyProfile(profile),
                                    'context.systemProfile': profile
                                }
                            });
                            socket.send(JSON.stringify({
                                type: 'system_profile_updated',
                                profile: convertToLegacyProfile(profile),
                            }));
                        }
                    }
                    // Handle user answer to agent question
                    if (data.type === 'question_response') {
                        const { questionId, answer } = data;
                        if (questionId && typeof answer === 'string') {
                            orchestrator.resolveUserAnswer(questionId, answer);
                        }
                    }
                }
                catch (err) {
                    app.log.error({
                        event: 'ws_message_error',
                        error: {
                            message: err.message,
                            stack: err.stack
                        }
                    }, 'Error processing WebSocket message');
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: err.message || 'Internal error',
                        code: 'INTERNAL_ERROR'
                    }));
                }
            });
            socket.on('close', () => {
                orchestrator.removeAllListeners();
                activeConnections.delete(connectionKey);
                app.log.info({
                    event: 'ws_disconnected',
                    user: { userId, tier },
                    chat: { id: chatId },
                    activeConnections: activeConnections.size
                }, 'WebSocket connection closed');
            });
            socket.on('error', (error) => {
                app.log.error({
                    event: 'ws_socket_error',
                    error: error.message
                }, 'WebSocket error');
                orchestrator.removeAllListeners();
                activeConnections.delete(connectionKey);
            });
        }
        catch (err) {
            app.log.error({
                event: 'ws_handler_error',
                error: { message: err.message, stack: err.stack },
                chat: { id: chatId },
                user: { userId, sessionId }
            }, 'Error in WebSocket handler');
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }));
            socket.close(1011, 'Internal Error');
        }
    });
}
//# sourceMappingURL=handler.js.map