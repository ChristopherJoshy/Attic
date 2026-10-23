import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import '@fastify/websocket';
import { Orchestrator } from '../agents/orchestrator.js';
import { Chat } from '../models/chat.js';
import { UserPreferences } from '../models/user-preferences.js';
import { analyzeImage, type GeminiUsageTrackingContext } from '../llm/gemini-client.js';
import { openRouterComplete, type UsageTrackingContext } from '../llm/openrouter-client.js';
import { TIER_LIMITS, type Tier } from '../config/index.js';
import { getOrCreateUsage, incrementRequestCount, incrementGeminiImageCount } from '../models/usage.js';
import type { AgentEventType, OrchestratorContext, ChatMessage, Citation, CommandProposal } from '../types.js';
import { getExistingSystemProfile, convertToLegacyProfile, type SystemProfileData } from '../agents/system-profile.js';
import { getOpenRouterApiKey } from '../utils/api-key-resolver.js';

// Track active WebSocket connections for monitoring
const activeConnections = new Map<string, { socket: WebSocket; userId: string | null; chatId: string; connectedAt: Date }>();
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
async function generateChatTitle(firstMessage: string, usageTracking?: UsageTrackingContext): Promise<string> {
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
            usageTracking,
        });

        const title = response.content.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present

        // Fallback to simple truncation if LLM returns empty/invalid
        if (!title || title.length === 0) {
            const cleaned = firstMessage.trim().replace(/\s+/g, ' ');
            return cleaned.length <= 50 ? cleaned : cleaned.substring(0, 47) + '...';
        }

        // Ensure max length
        return title.length <= 60 ? title : title.substring(0, 57) + '...';
    } catch (err) {
        // Fallback: use simple truncation if OpenRouter fails
        const cleaned = firstMessage.trim().replace(/\s+/g, ' ');
        return cleaned.length <= 50 ? cleaned : cleaned.substring(0, 47) + '...';
    }
}

// Interface for tracking assistant message state
interface AssistantMessageState {
    content: string;
    citations: Citation[];
    commands: CommandProposal[];
    startTime: number;
}

/**
 * WebSocket authentication middleware
 * Accepts JWT via Authorization header (preferred) or query parameter (fallback with warning)
 */
async function wsAuthenticate(app: FastifyInstance, request: FastifyRequest, reply: any): Promise<boolean> {
    // Try Authorization header first (secure method)
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = await app.jwt.verify(token);
            (request as any).user = decoded;
            return true;
        } catch (err) {
            app.log.warn({
                event: 'ws_auth_header_invalid',
                ip: request.ip,
                path: request.url
            }, 'WebSocket authentication failed - invalid token in header');
            return false;
        }
    }

    // Fallback: Check query parameter (less secure, logs warning)
    const query = request.query as Record<string, string | undefined>;
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
            (request as any).user = decoded;
            return true;
        } catch (err) {
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

export async function wsHandler(app: FastifyInstance) {
    app.get('/ws/chat/:chatId', { websocket: true } as any, async (socket: WebSocket, request: FastifyRequest) => {
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

        const { chatId } = request.params as { chatId: string };
        const user = (request as any).user as { userId: string | null; sessionId: string; tier: Tier };
        const { userId, sessionId, tier } = user;

        // Check connection limits per user
        const userKey = userId || sessionId;
        const userConnections = Array.from(activeConnections.values()).filter(c =>
            (c.userId === userId && userId) || (c.chatId && userId === null)
        );

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
            const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];
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
            } catch (usageError) {
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
                const profileData = chat.context.systemProfile as SystemProfileData;
                systemProfile = convertToLegacyProfile(profileData);
            }

            // Fetch user preferences including the API key
            let openRouterKey: string | undefined;
            let isUserApiKey = false;
            if (userId) {
                try {
                    // First, try to get user's personal API key from the new secure storage
                    const keyResult = await getOpenRouterApiKey(userId);
                    if (keyResult.isUserKey) {
                        openRouterKey = keyResult.apiKey;
                        isUserApiKey = true;
                        app.log.info({
                            event: 'ws_using_user_api_key',
                            userId
                        }, 'Using user\'s personal OpenRouter API key');
                    } else {
                        openRouterKey = keyResult.apiKey;
                    }

                    // Also fetch user preferences for system profile
                    const prefs = await UserPreferences.findOne({ userId });
                    if (prefs) {
                        // Fallback: If no profile in chat, check user preferences for system profile
                        if (!systemProfile && (prefs.defaultDistro !== 'not_selected' || prefs.distroVersion)) {
                            systemProfile = {
                                distro: prefs.defaultDistro !== 'not_selected' ? prefs.defaultDistro : 'Linux',
                                distroVersion: prefs.distroVersion,
                                packageManager: prefs.packageManager,
                                shell: prefs.defaultShell !== 'not_selected' ? prefs.defaultShell : 'bash',
                                desktopEnvironment: prefs.desktopEnvironment,
                                kernel: '', // Kernel typicaly requires discovery
                                cpuModel: null,
                                gpuInfo: null,
                                displayServer: null,
                                windowManager: null,
                                collectedAt: new Date().toISOString(),
                            };

                            // Update chat with this profile so we don't fetch again
                            await Chat.updateOne(
                                { _id: chatId },
                                { $set: { systemProfile } }
                            );
                        }
                    }
                } catch (err) {
                    app.log.warn({ event: 'ws_prefs_fetch_error', userId, error: err }, 'Failed to fetch preferences');
                }
            }

            // Enforce OpenRouter API Key for non-trial users
            if (tier !== 'trial' && !openRouterKey) {
                socket.send(JSON.stringify({
                    type: 'error',
                    message: 'Please add your OpenRouter API Key in Settings.',
                    code: 'API_KEY_REQUIRED'
                }));
                // Close the connection as they are not allowed to use system resources without a key
                socket.close(1008, 'Policy Violation');
                return;
            }

            const context: OrchestratorContext = {
                chatId,
                userId,
                sessionId,
                tier,
                systemProfile,
                messageHistory: chat.messages || [],
                apiKey: openRouterKey,
                logger: app.log,
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
            let assistantMessageState: AssistantMessageState | null = null;

            orchestrator.on('event', (event: AgentEventType) => {
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
                        app.log.debug({ component: 'ws', event: 'message:done' }, 'Received message:done event');
                        assistantMessageState.citations = event.citations || [];
                        assistantMessageState.commands = event.commands || [];

                        const assistantMessage: ChatMessage = {
                            role: 'assistant',
                            content: assistantMessageState.content,
                            citations: assistantMessageState.citations,
                            commands: assistantMessageState.commands,
                            timestamp: new Date().toISOString(),
                        };

                        app.log.debug({
                            component: 'ws',
                            preview: assistantMessage.content.substring(0, 50)
                        }, 'Saving assistant message to DB');

                        // Persist assistant message to database
                        Chat.updateOne(
                            { _id: chatId },
                            {
                                $push: { messages: assistantMessage },
                                $set: { updatedAt: new Date() }
                            }
                        ).then(() => {
                            app.log.debug({ component: 'ws' }, 'Assistant message saved successfully');
                        }).catch((err) => {
                            app.log.error({
                                event: 'ws_assistant_message_save_error',
                                error: err instanceof Error ? err.message : 'Unknown error',
                                chatId
                            }, 'Failed to save assistant message');
                        });

                        // Reset state for next message
                        assistantMessageState = null;
                        app.log.debug({ component: 'ws' }, 'Reset assistantMessageState');
                    }
                } catch (sendError) {
                    app.log.error({
                        event: 'ws_send_error',
                        error: sendError instanceof Error ? sendError.message : 'Unknown error'
                    }, 'Error sending WebSocket message');
                }
            });

            socket.on('message', async (rawData: Buffer) => {
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
                        const userMessage: ChatMessage = {
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

                        await Chat.updateOne(
                            { _id: chatId },
                            { $push: { messages: userMessage } }
                        );

                        // Auto-generate title from first message using OpenRouter
                        if (isFirstMessage) {
                            // Build usage tracking context for title generation
                            const titleUsageTracking: UsageTrackingContext | undefined = userId ? {
                                userId,
                                sessionId,
                                agentType: 'system',
                                apiKeyType: isUserApiKey ? 'user' : 'system',
                            } : undefined;

                            const newTitle = await generateChatTitle(
                                content.trim() || 'Image analysis',
                                titleUsageTracking
                            );
                            await Chat.updateOne(
                                { _id: chatId },
                                { $set: { title: newTitle } }
                            );

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
                        } catch (incrementError) {
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
                                // Build usage tracking context for Gemini
                                const geminiUsageTracking: GeminiUsageTrackingContext | undefined = userId ? {
                                    userId,
                                    sessionId,
                                    agentType: 'system',
                                    apiKeyType: 'system',
                                } : undefined;

                                const analysis = await analyzeImage(
                                    image.data,
                                    image.mimeType,
                                    content.trim() || 'Describe this image',
                                    geminiUsageTracking
                                );

                                // Increment usage after successful analysis
                                await incrementGeminiImageCount(identifier, identifierType);

                                // Save assistant response to chat history
                                const assistantMessage: ChatMessage = {
                                    role: 'assistant',
                                    content: analysis,
                                    timestamp: new Date().toISOString(),
                                };

                                await Chat.updateOne(
                                    { _id: chatId },
                                    {
                                        $push: { messages: assistantMessage },
                                        $set: { updatedAt: new Date() }
                                    }
                                );

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
                            } catch (imageError) {
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
                        } else {
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
                        await Chat.updateOne(
                            { _id: chatId },
                            {
                                $set: {
                                    systemProfile: { ...context.systemProfile, ...profile },
                                    'context.systemProfile': { ...context.systemProfile, ...profile }
                                }
                            }
                        );

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
                            await Chat.updateOne(
                                { _id: chatId },
                                {
                                    $set: {
                                        systemProfile: convertToLegacyProfile(profile),
                                        'context.systemProfile': profile
                                    }
                                }
                            );

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
                } catch (err: any) {
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

        } catch (err: any) {
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