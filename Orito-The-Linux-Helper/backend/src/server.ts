import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import { config } from './config/index.js';
import { connectDB } from './db/connection.js';
import { authRoutes } from './routes/auth.js';
import { chatRoutes } from './routes/chat.js';
import { searchRoutes } from './routes/search.js';
import { preferencesRoutes } from './routes/preferences.js';
import { adminRoutes } from './routes/admin.js';
import { proxyImageRoutes } from './routes/proxy-image.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import usageRoutes from './routes/usage.js';
import { wsHandler } from './ws/handler.js';
import { Session } from './models/session.js';
import { initializeSearXNGManager } from './services/searxng-manager.js';
import { getSearXNGConfig } from './config/searxng.js';

// Configure logger with proper JSON formatting
const loggerConfig = config.NODE_ENV === 'development'
    ? {
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
                colorize: true,
                singleLine: false,
            }
        },
        level: 'info'
    }
    : {
        level: 'info',
        serializers: {
            req(request: any) {
                return {
                    method: request.method,
                    url: request.url,
                    path: request.routeOptions?.url,
                    params: request.params,
                    query: request.query,
                    headers: {
                        host: request.headers.host,
                        userAgent: request.headers['user-agent'],
                        origin: request.headers.origin,
                    },
                    remoteAddress: request.ip,
                };
            },
            res(reply: any) {
                return {
                    statusCode: reply.statusCode,
                };
            },
            err(error: any) {
                return {
                    type: error.constructor.name,
                    message: error.message,
                    stack: error.stack,
                    code: error.code,
                    statusCode: error.statusCode,
                };
            }
        }
    };

const app = Fastify({
    logger: loggerConfig,
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
});

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: any;
    }
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: { userId: string | null; sessionId: string; tier: string; isAdmin: boolean };
        user: { userId: string | null; sessionId: string; tier: string; isAdmin: boolean };
    }
}

async function bootstrap() {
    // CORS configuration - allow multiple origins in development
    const corsOrigin = config.NODE_ENV === 'development'
        ? (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return cb(null, true);
            // Allow localhost and local network IPS
            if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('http://192.') || origin.startsWith('http://10.')) {
                return cb(null, true);
            }
            cb(new Error("Not allowed by CORS"), false);
        }
        : config.CORS_ORIGIN;

    await app.register(cors, {
        origin: corsOrigin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization']
    });
    await app.register(jwt, { secret: config.JWT_SECRET });
    await app.register(websocket, {
        options: {
            maxPayload: 1048576, // 1MB max message size
            perMessageDeflate: true, // Enable compression
            clientTracking: true,
        }
    });
    // Optimized rate limiting for 300+ concurrent users
    // Allow 300 requests per minute (5 req/sec) per IP
    await app.register(rateLimit, {
        max: 300,
        timeWindow: '1 minute',
        cache: 10000, // Cache up to 10k IPs
        skipOnError: false,
        ban: 10, // Ban after 10 violations
    });

    app.decorate('authenticate', async function (request: any, reply: any) {
        try {
            await request.jwtVerify();
        } catch (err) {
            const authHeader = request.headers.authorization;
            app.log.warn({
                event: 'auth_failed',
                reason: !authHeader ? 'missing_token' : 'invalid_token',
                path: request.url,
                method: request.method,
                ip: request.ip,
                userAgent: request.headers['user-agent']
            }, 'Authentication failed');

            if (!authHeader) {
                reply.code(401).send({ error: 'Authentication required' });
                return;
            }
            reply.code(401).send({ error: 'Invalid token' });
        }
    });

    await connectDB();
    app.log.info({ event: 'db_connected', database: 'mongodb' }, 'Connected to MongoDB');

    // Add hooks for enhanced logging - only log non-health check endpoints
    app.addHook('onResponse', async (request, reply) => {
        // Skip logging for health check and public config endpoints
        if (request.url.includes('/health') || request.url.includes('/config/public')) {
            return;
        }

        const responseTime = reply.elapsedTime || 0;
        const logLevel = reply.statusCode >= 400 ? 'warn' : 'info';

        request.log[logLevel]({
            event: 'request_completed',
            request: {
                method: request.method,
                url: request.url,
            },
            response: {
                statusCode: reply.statusCode
            },
            performance: {
                responseTimeMs: Math.round(responseTime)
            }
        }, `${request.method} ${request.url} - ${reply.statusCode} (${Math.round(responseTime)}ms)`);
    });

    // Global error handler
    app.setErrorHandler((error, request, reply) => {
        const err = error as any;

        // Determine log level based on status code
        const statusCode = err.statusCode || 500;
        const logLevel = statusCode >= 500 ? 'error' : 'warn';

        app.log[logLevel]({
            event: 'request_error',
            error: {
                message: err.message,
                code: err.code,
                statusCode: statusCode,
                stack: config.NODE_ENV === 'development' ? err.stack : undefined
            },
            request: {
                method: request.method,
                url: request.url,
                params: request.params,
                query: request.query,
                ip: request.ip,
                userAgent: request.headers['user-agent']
            }
        }, `Request error: ${err.message || 'Unknown error'}`);

        // Don't expose internal errors in production
        if (config.NODE_ENV === 'production' && statusCode === 500) {
            reply.code(500).send({ error: 'Internal server error' });
        } else {
            reply.code(statusCode).send({
                error: err.message || 'Internal server error',
                ...(config.NODE_ENV === 'development' && { stack: err.stack })
            });
        }
    });

    await app.register(authRoutes);
    await app.register(chatRoutes);
    await app.register(searchRoutes);
    await app.register(preferencesRoutes);
    await app.register(adminRoutes);
    await app.register(proxyImageRoutes);
    await app.register(apiKeyRoutes);
    await app.register(usageRoutes, { prefix: '/api/v1/usage' });
    await app.register(wsHandler);

    app.get('/api/v1/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    app.get('/api/v1/config/public', async () => ({
        googleFormProUrl: config.GOOGLE_FORM_PRO_URL || null,
        searchProvider: config.SEARCH_PROVIDER,
        vectorProvider: config.VECTOR_PROVIDER,
    }));

    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info({
        event: 'server_started',
        config: {
            port: config.PORT,
            nodeEnv: config.NODE_ENV,
            corsOrigin: corsOrigin,
            searchProvider: config.SEARCH_PROVIDER,
            vectorProvider: config.VECTOR_PROVIDER
        }
    }, `Server started successfully on port ${config.PORT}`);

    // Auto-start SearXNG if enabled
    const searxngConfig = getSearXNGConfig();
    if (searxngConfig.enabled && searxngConfig.instanceType === 'local') {
        app.log.info({
            event: 'searxng_autostart_attempt',
            config: {
                enabled: searxngConfig.enabled,
                instanceType: searxngConfig.instanceType,
                autoStart: searxngConfig.autoStart,
                port: searxngConfig.port
            }
        }, 'Attempting to auto-start SearXNG container');

        try {
            const instanceInfo = await initializeSearXNGManager();
            app.log.info({
                event: 'searxng_autostart_success',
                status: instanceInfo.status,
                url: instanceInfo.url,
                port: instanceInfo.port
            }, `SearXNG auto-started successfully (status: ${instanceInfo.status})`);
        } catch (error) {
            // Log error but don't crash the server
            const err = error as Error;
            app.log.warn({
                event: 'searxng_autostart_failed',
                error: {
                    message: err.message,
                    stack: config.NODE_ENV === 'development' ? err.stack : undefined
                }
            }, `SearXNG auto-start failed: ${err.message}. Server will continue without SearXNG.`);
        }
    } else if (searxngConfig.enabled && searxngConfig.instanceType === 'remote') {
        app.log.info({
            event: 'searxng_remote_configured',
            url: searxngConfig.url
        }, 'SearXNG remote instance configured - skipping auto-start');
    }
}

bootstrap().catch((err) => {
    const error = {
        event: 'server_startup_failed',
        error: {
            message: err.message,
            stack: err.stack,
            code: err.code
        }
    };
    console.error(JSON.stringify(error));
    process.exit(1);
});
