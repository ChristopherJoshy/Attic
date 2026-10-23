import type { FastifyInstance } from 'fastify';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { User } from '../models/user.js';
import { Session } from '../models/session.js';
import { AuditLog } from '../models/audit-log.js';
import { PlanOverride } from '../models/plan-override.js';
import { firebaseAuthSchema, validateOrThrow } from '../validation/schemas.js';

// Firebase error codes mapping
const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
    'auth/id-token-expired': 'Your session has expired. Please sign in again.',
    'auth/id-token-revoked': 'Your session has been revoked. Please sign in again.',
    'auth/invalid-id-token': 'Invalid authentication token. Please sign in again.',
    'auth/user-not-found': 'User account not found.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/argument-error': 'Invalid authentication request.',
};

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
        readFileSync(config.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf-8')
    );
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.FIREBASE_PROJECT_ID,
    });
}

// Helper function to create audit log entry
async function createAuthAuditLog(
    action: string,
    userId: mongoose.Types.ObjectId | null,
    sessionId: mongoose.Types.ObjectId | null,
    details: Record<string, unknown>,
    ipAddress: string,
    userAgent: string
): Promise<void> {
    try {
        await AuditLog.create({
            chatId: null,
            sessionId: sessionId || undefined,
            userId,
            actionId: `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            command: `AUTH: ${action}`,
            risk: 'low',
            userDecision: 'approved',
            exitCode: 0,
            stdout: JSON.stringify(details),
            stderr: '',
            hmac: 'auth_event',
            previousHmac: '',
        } as any);
    } catch (error) {
        // Silently fail audit logging - don't block auth
    }
}

export async function authRoutes(app: FastifyInstance) {
    app.post('/api/v1/auth/firebase', async (request, reply) => {
        // Input validation
        let validatedBody: { idToken: string };
        try {
            const validated = validateOrThrow(firebaseAuthSchema, { body: request.body });
            validatedBody = validated.body;
        } catch (err: any) {
            app.log.warn({
                event: 'auth_firebase_validation_error',
                error: err.message,
                ip: request.ip
            }, 'Firebase auth validation failed');
            return reply.code(400).send({ error: err.message });
        }

        const { idToken } = validatedBody;

        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(idToken, true);
        } catch (err: any) {
            const errorCode = err.code || err.errorInfo?.code || 'unknown';
            const errorMessage = FIREBASE_ERROR_MESSAGES[errorCode] || 'Invalid Firebase token';

            app.log.warn({
                event: 'auth_firebase_invalid_token',
                error: { message: err.message, code: errorCode },
                ip: request.ip
            }, 'Failed to verify Firebase token');

            return reply.code(401).send({
                error: errorMessage,
                code: errorCode
            });
        }

        // Check if token has required fields
        if (!decoded.uid) {
            app.log.warn({
                event: 'auth_firebase_missing_uid',
                ip: request.ip
            }, 'Firebase token missing uid');
            return reply.code(401).send({ error: 'Invalid token: missing user identifier' });
        }

        try {
            let user = await User.findOne({ googleId: decoded.uid });
            const isNewUser = !user;
            // Check if user email matches configured super admin email
            // If SUPER_ADMIN_EMAIL is not configured, no one gets admin privileges by default
            const isAdminEmail = config.SUPER_ADMIN_EMAIL ? decoded.email === config.SUPER_ADMIN_EMAIL : false;

            if (!user) {
                app.log.info({
                    event: 'user_created',
                    user: {
                        email: decoded.email,
                        uid: decoded.uid,
                        tier: 'free',
                        isAdmin: isAdminEmail
                    }
                }, 'Creating new user');

                user = await User.create({
                    googleId: decoded.uid,
                    email: decoded.email || '',
                    name: decoded.name || decoded.email?.split('@')[0] || 'User',
                    avatar: decoded.picture || '',
                    tier: isAdminEmail ? 'pro' : 'free', // Admins start with Pro tier
                    isAdmin: isAdminEmail,
                    lastLogin: new Date(),
                    loginCount: 1,
                    metadata: {
                        signupIp: request.ip,
                        signupUserAgent: request.headers['user-agent'] || '',
                        lastLoginIp: request.ip,
                        lastLoginUserAgent: request.headers['user-agent'] || '',
                    },
                });
            } else {
                // Update login stats for existing user
                user.lastLogin = new Date();
                user.loginCount += 1;
                user.metadata.lastLoginIp = request.ip;
                user.metadata.lastLoginUserAgent = request.headers['user-agent'] || '';

                // Update admin status if email matches
                if (isAdminEmail && !user.isAdmin) {
                    user.isAdmin = true;
                    user.tier = 'pro'; // Admins are automatically pro users
                } else if (isAdminEmail && user.tier !== 'pro') {
                    user.tier = 'pro'; // Ensure existing admins are pro
                }

                // Auto-upgrade admins to Pro tier
                if (user.isAdmin && user.tier !== 'pro') {
                    app.log.info({ userId: user._id, email: user.email }, 'Auto-upgrading admin user to Pro tier');
                    user.tier = 'pro';
                }

                await user.save();
            }

            const session = await Session.create({
                userId: user._id,
                tier: user.tier,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || '',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });

            const token = app.jwt.sign(
                {
                    userId: user._id.toString(),
                    sessionId: session._id.toString(),
                    tier: user.tier,
                    isAdmin: user.isAdmin
                },
                { expiresIn: '30d' }
            );

            // Create audit log for successful authentication
            await createAuthAuditLog(
                isNewUser ? 'signup' : 'login',
                user._id,
                session._id,
                { method: 'firebase', email: user.email, isNewUser },
                request.ip,
                request.headers['user-agent'] || ''
            );

            app.log.info({
                event: 'auth_firebase_success',
                user: {
                    id: user._id.toString(),
                    email: user.email,
                    tier: user.tier,
                    isAdmin: user.isAdmin
                },
                session: {
                    id: session._id.toString()
                },
                isNewUser
            }, 'User authenticated via Firebase');

            return {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    tier: user.tier,
                    isAdmin: user.isAdmin
                }
            };
        } catch (err: any) {
            app.log.error({
                event: 'auth_firebase_error',
                error: {
                    message: err.message,
                    stack: err.stack
                }
            }, 'Database error during Firebase authentication');
            return reply.code(500).send({ error: 'Authentication failed' });
        }
    });

    app.post('/api/v1/auth/anonymous', async (request, reply) => {
        // Rate limit check for anonymous sessions (prevent abuse)
        const existingSessions = await Session.countDocuments({
            ipAddress: request.ip,
            createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
        });

        const maxSessions = config.NODE_ENV === 'development' ? 100 : 5;

        if (existingSessions >= maxSessions) {
            app.log.warn({
                event: 'auth_anonymous_rate_limited',
                ip: request.ip,
                sessionCount: existingSessions
            }, 'Anonymous session rate limit exceeded');
            return reply.code(429).send({
                error: 'Too many sessions created. Please log in or try again later.'
            });
        }

        try {
            const session = await Session.create({
                userId: null,
                tier: 'trial',
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] || '',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            });

            const token = app.jwt.sign(
                { userId: null, sessionId: session._id.toString(), tier: 'trial', isAdmin: false },
                { expiresIn: '24h' }
            );

            app.log.info({
                event: 'auth_anonymous_success',
                session: {
                    id: session._id.toString(),
                    tier: 'trial'
                },
                ip: request.ip
            }, 'Anonymous session created');

            return { token, session: { id: session._id, tier: 'trial' } };
        } catch (err: any) {
            app.log.error({
                event: 'auth_anonymous_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                ip: request.ip
            }, 'Failed to create anonymous session');
            return reply.code(500).send({ error: 'Failed to create session' });
        }
    });

    app.get('/api/v1/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
        const decoded = request.user;

        try {
            if (decoded.userId) {
                const user = await User.findById(decoded.userId);
                if (!user) {
                    app.log.warn({
                        event: 'auth_me_user_not_found',
                        userId: decoded.userId
                    }, 'User not found for valid token');
                    return reply.code(404).send({ error: 'User not found' });
                }

                // Check for expired plan overrides
                try {
                    const activeOverride = await PlanOverride.findOne({
                        userId: user._id,
                        isActive: true,
                    });
                    // Only check expiry if expiresAt is set (not permanent)
                    if (activeOverride && activeOverride.expiresAt && activeOverride.expiresAt <= new Date() && !activeOverride.isPermanent) {
                        // Override has expired, revert tier
                        activeOverride.isActive = false;
                        await activeOverride.save();
                        user.tier = activeOverride.originalTier as any;
                        await user.save();
                    }
                } catch { /* don't block auth on override check failure */ }

                app.log.info({
                    event: 'auth_me_success',
                    user: { id: user._id.toString(), tier: user.tier }
                }, 'User info retrieved');

                return {
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        avatar: user.avatar,
                        tier: user.tier,
                        isAdmin: user.isAdmin,
                        lastLogin: user.lastLogin,
                        loginCount: user.loginCount,
                        preferences: user.preferences
                    }
                };
            }

            app.log.info({
                event: 'auth_me_success',
                session: { id: decoded.sessionId, tier: decoded.tier }
            }, 'Anonymous session info retrieved');

            return { session: { id: decoded.sessionId, tier: decoded.tier } };
        } catch (err: any) {
            app.log.error({
                event: 'auth_me_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                userId: decoded.userId
            }, 'Error fetching user info');
            return reply.code(500).send({ error: 'Failed to fetch user info' });
        }
    });

    // Logout endpoint - invalidates session
    app.post('/api/v1/auth/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
        const decoded = request.user;

        try {
            // Delete the session
            const result = await Session.deleteOne({ _id: decoded.sessionId });

            if (result.deletedCount > 0) {
                app.log.info({
                    event: 'auth_logout_success',
                    userId: decoded.userId,
                    sessionId: decoded.sessionId
                }, 'User logged out successfully');

                return { success: true, message: 'Logged out successfully' };
            } else {
                app.log.warn({
                    event: 'auth_logout_session_not_found',
                    sessionId: decoded.sessionId
                }, 'Session not found during logout');

                return { success: true, message: 'Session already expired' };
            }
        } catch (err: any) {
            app.log.error({
                event: 'auth_logout_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                sessionId: decoded.sessionId
            }, 'Error during logout');
            return reply.code(500).send({ error: 'Logout failed' });
        }
    });

    // Refresh token endpoint - extends session
    app.post('/api/v1/auth/refresh', { preHandler: [app.authenticate] }, async (request, reply) => {
        const decoded = request.user;

        try {
            const session = await Session.findById(decoded.sessionId);

            if (!session) {
                app.log.warn({
                    event: 'auth_refresh_session_not_found',
                    sessionId: decoded.sessionId
                }, 'Session not found for refresh');
                return reply.code(401).send({ error: 'Session not found' });
            }

            // Check if session is about to expire (within 7 days)
            const daysUntilExpiry = (session.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

            if (daysUntilExpiry > 7) {
                // Session is still valid for a while, no need to refresh
                return {
                    token: null,
                    message: 'Session is still valid',
                    expiresAt: session.expiresAt.toISOString()
                };
            }

            // Extend session
            const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            session.expiresAt = newExpiresAt;
            session.lastActiveAt = new Date();
            await session.save();

            // Generate new token
            const newToken = app.jwt.sign(
                {
                    userId: decoded.userId,
                    sessionId: decoded.sessionId,
                    tier: decoded.tier,
                    isAdmin: decoded.isAdmin || false
                },
                { expiresIn: '30d' }
            );

            app.log.info({
                event: 'auth_refresh_success',
                userId: decoded.userId,
                sessionId: decoded.sessionId,
                newExpiresAt: newExpiresAt.toISOString()
            }, 'Session refreshed successfully');

            return {
                token: newToken,
                message: 'Session refreshed',
                expiresAt: newExpiresAt.toISOString()
            };
        } catch (err: any) {
            app.log.error({
                event: 'auth_refresh_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                sessionId: decoded.sessionId
            }, 'Error during token refresh');
            return reply.code(500).send({ error: 'Token refresh failed' });
        }
    });
}