import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../models/user.js';
import { PlanOverride, PlanAuditLog } from '../models/plan-override.js';
import { requireAdmin } from '../middleware/admin.js';
import { PLANS, getAvailablePlans, getPlanById } from '../models/plan.js';
import {
  getSearXNGConfig,
  updateSearXNGConfig,
  type SearXNGConfig,
} from '../config/searxng.js';
import {
  getSearXNGInstanceInfo,
  startSearXNG,
  stopSearXNG,
  restartSearXNG,
  isDockerAvailable,
  performHealthCheck,
  type SearXNGInstanceInfo,
} from '../services/searxng-manager.js';
import { getSearchProviderStatus, getSearchCacheStats } from '../tools/search-tool.js';
import { getWikiCacheStats } from '../tools/wiki-tool.js';
import { getManpageCacheStats } from '../tools/manpage-tool.js';
import { getPackageCacheStats } from '../tools/package-tool.js';
import { cacheManager } from '../utils/ttl-cache.js';
import { responseCache } from '../services/cache-service.js';
import { embeddingCache } from '../services/embedding-cache.js';
import { contextCache } from '../services/context-cache.js';

export async function adminRoutes(app: FastifyInstance) {
  // All routes require admin
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    await requireAdmin(request, reply);
  });

  // Helper function to create audit log entry
  const createAuditLog = async (
    userId: string,
    action: 'grant' | 'revoke' | 'expire' | 'self_change' | 'admin_change',
    fromTier: string,
    toTier: string,
    performedBy: string,
    reason?: string,
    overrideId?: string,
    metadata?: { duration?: string; expiresAt?: Date; ipAddress?: string; userAgent?: string }
  ) => {
    const auditLog = new PlanAuditLog({
      userId,
      action,
      fromTier,
      toTier,
      performedBy,
      performedAt: new Date(),
      reason,
      overrideId,
      metadata,
    });
    await auditLog.save();
    return auditLog;
  };

  // GET /api/v1/admin/plans - List all available plans
  app.get('/api/v1/admin/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    const adminUser = request.user as { userId: string; isAdmin: boolean };
    // Admins can see all plans including admin-only ones
    const plans = getAvailablePlans(adminUser.isAdmin);
    return { plans };
  });

  // GET /api/v1/admin/my-plan - Get current admin's plan
  app.get('/api/v1/admin/my-plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const adminUser = request.user as { userId: string };
    
    const user = await User.findById(adminUser.userId).select('_id email name tier isAdmin');
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const currentPlan = getPlanById(user.tier);
    const activeOverride = await PlanOverride.findOne({
      userId: user._id,
      isActive: true,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null },
        { isPermanent: true }
      ],
    });

    return {
      currentPlan: currentPlan || { id: user.tier, name: user.tier.toUpperCase() },
      tier: user.tier,
      isAdmin: user.isAdmin,
      activeOverride: activeOverride ? {
        id: activeOverride._id,
        originalTier: activeOverride.originalTier,
        newTier: activeOverride.newTier,
        grantedAt: activeOverride.grantedAt,
        expiresAt: activeOverride.expiresAt,
        isPermanent: activeOverride.isPermanent,
        reason: activeOverride.reason,
      } : null,
    };
  });

  // POST /api/v1/admin/my-plan - Switch admin's own plan (unrestricted)
  app.post('/api/v1/admin/my-plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const adminUser = request.user as { userId: string; isAdmin: boolean };
    const { planId, reason } = request.body as { planId: string; reason?: string };

    // Validate plan exists
    const targetPlan = getPlanById(planId);
    if (!targetPlan) {
      return reply.status(400).send({ error: 'Invalid plan ID' });
    }

    // Get current user
    const user = await User.findById(adminUser.userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const previousTier = user.tier;

    // Check if already on this plan
    if (previousTier === planId) {
      return reply.status(400).send({ error: 'Already on this plan' });
    }

    // Deactivate any existing active overrides
    await PlanOverride.updateMany(
      { userId: user._id, isActive: true },
      { $set: { isActive: false, revokedAt: new Date() } }
    );

    // Create a permanent override for admin self-change
    const override = new PlanOverride({
      userId: user._id,
      originalTier: previousTier as 'trial' | 'free' | 'pro',
      newTier: planId as 'free' | 'pro' | 'admin',
      grantedBy: user._id,
      expiresAt: null, // Permanent
      isPermanent: true,
      reason: reason || 'Admin self-change',
    });
    await override.save();

    // Update user's tier
    user.tier = planId as 'trial' | 'free' | 'pro';
    await user.save();

    // Create audit log
    await createAuditLog(
      user._id.toString(),
      'self_change',
      previousTier,
      planId,
      user._id.toString(),
      reason || 'Admin self-change',
      override._id.toString(),
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }
    );

    request.log.info({
      event: 'admin_plan_change',
      adminId: user._id,
      fromTier: previousTier,
      toTier: planId,
      overrideId: override._id,
    });

    return {
      success: true,
      previousTier,
      newTier: planId,
      plan: targetPlan,
      override: {
        id: override._id,
        isPermanent: true,
      },
    };
  });

  // GET /api/v1/admin/users/lookup?email=... - Find user by email
  app.get('/api/v1/admin/users/lookup', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.query as { email?: string };
    
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return reply.status(400).send({ error: 'Valid email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('_id email name tier isAdmin lastLogin createdAt');
    
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Check for active plan override
    const activeOverride = await PlanOverride.findOne({ 
      userId: user._id, 
      isActive: true,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null },
        { isPermanent: true }
      ],
    });

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        isAdmin: user.isAdmin,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
      activeOverride: activeOverride ? {
        id: activeOverride._id,
        originalTier: activeOverride.originalTier,
        newTier: activeOverride.newTier,
        grantedAt: activeOverride.grantedAt,
        expiresAt: activeOverride.expiresAt,
        isPermanent: activeOverride.isPermanent,
        reason: activeOverride.reason,
      } : null,
    };
  });

  // PATCH /api/v1/admin/users/:userId/plan - Change user plan
  app.patch('/api/v1/admin/users/:userId/plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const { newTier, duration, reason } = request.body as { 
      newTier: 'free' | 'pro'; 
      duration: string; // '1w', '1m', '3m', '6m', '1y', or ISO date string
      reason?: string;
    };

    // Validate inputs
    if (!['free', 'pro'].includes(newTier)) {
      return reply.status(400).send({ error: 'Invalid tier. Must be "free" or "pro"' });
    }

    if (!duration) {
      return reply.status(400).send({ error: 'Duration is required' });
    }

    // Calculate expiry date
    const now = new Date();
    let expiresAt: Date;
    
    switch (duration) {
      case '1w': expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); break;
      case '1m': expiresAt = new Date(now.setMonth(now.getMonth() + 1)); break;
      case '3m': expiresAt = new Date(now.setMonth(now.getMonth() + 3)); break;
      case '6m': expiresAt = new Date(now.setMonth(now.getMonth() + 6)); break;
      case '1y': expiresAt = new Date(now.setFullYear(now.getFullYear() + 1)); break;
      default: {
        // Try parsing as ISO date
        const parsed = new Date(duration);
        if (isNaN(parsed.getTime()) || parsed <= new Date()) {
          return reply.status(400).send({ error: 'Invalid duration. Use 1w, 1m, 3m, 6m, 1y, or a future ISO date' });
        }
        expiresAt = parsed;
      }
    }

    // Find the target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Prevent modifying other admins' plans
    const adminUser = request.user as { userId: string };
    if (targetUser.isAdmin && targetUser._id.toString() !== adminUser.userId) {
      return reply.status(403).send({ error: 'Cannot modify another admin\'s plan' });
    }

    const previousTier = targetUser.tier;

    // Deactivate any existing active overrides
    await PlanOverride.updateMany(
      { userId: targetUser._id, isActive: true },
      { $set: { isActive: false, revokedAt: new Date() } }
    );

    // Create new override
    const override = new PlanOverride({
      userId: targetUser._id,
      originalTier: previousTier as 'trial' | 'free' | 'pro',
      newTier,
      grantedBy: adminUser.userId,
      expiresAt,
      reason: reason || '',
    });
    await override.save();

    // Update user's tier
    targetUser.tier = newTier;
    await targetUser.save();

    // Create audit log
    await createAuditLog(
      targetUser._id.toString(),
      'admin_change',
      previousTier,
      newTier,
      adminUser.userId,
      reason,
      override._id.toString(),
      {
        duration,
        expiresAt,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }
    );

    request.log.info({
      event: 'admin_user_plan_change',
      adminId: adminUser.userId,
      targetUserId: targetUser._id,
      fromTier: previousTier,
      toTier: newTier,
      expiresAt,
      overrideId: override._id,
    });

    return {
      success: true,
      override: {
        id: override._id,
        userId: targetUser._id,
        userName: targetUser.name,
        userEmail: targetUser.email,
        originalTier: override.originalTier,
        newTier: override.newTier,
        expiresAt: override.expiresAt,
        reason: override.reason,
      },
    };
  });

  // DELETE /api/v1/admin/users/:userId/plan - Revoke plan override
  app.delete('/api/v1/admin/users/:userId/plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Prevent modifying other admins' plans
    const adminUser = request.user as { userId: string };
    if (targetUser.isAdmin && targetUser._id.toString() !== adminUser.userId) {
      return reply.status(403).send({ error: 'Cannot modify another admin\'s plan' });
    }

    // Find active override
    const activeOverride = await PlanOverride.findOne({ 
      userId: targetUser._id, 
      isActive: true,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null },
        { isPermanent: true }
      ],
    });

    if (!activeOverride) {
      return reply.status(404).send({ error: 'No active plan override found' });
    }

    const previousTier = targetUser.tier;

    // Deactivate override
    activeOverride.isActive = false;
    activeOverride.revokedAt = new Date();
    await activeOverride.save();

    // Revert user's tier
    targetUser.tier = activeOverride.originalTier;
    await targetUser.save();

    // Create audit log
    await createAuditLog(
      targetUser._id.toString(),
      'revoke',
      previousTier,
      activeOverride.originalTier,
      adminUser.userId,
      'Override revoked by admin',
      activeOverride._id.toString(),
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      }
    );

    request.log.info({
      event: 'admin_plan_revoke',
      adminId: adminUser.userId,
      targetUserId: targetUser._id,
      revertedTo: activeOverride.originalTier,
    });

    return {
      success: true,
      message: `Plan reverted to ${activeOverride.originalTier} for ${targetUser.email}`,
    };
  });

  // GET /api/v1/admin/audit-logs - Get plan change audit logs
  app.get('/api/v1/admin/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, action, limit = 50, offset = 0 } = request.query as {
      userId?: string;
      action?: string;
      limit?: number;
      offset?: number;
    };

    const query: any = {};
    if (userId) query.userId = userId;
    if (action) query.action = action;

    const logs = await PlanAuditLog.find(query)
      .sort({ performedAt: -1 })
      .skip(offset)
      .limit(Math.min(limit, 100))
      .populate('userId', 'email name')
      .populate('performedBy', 'email name');

    const total = await PlanAuditLog.countDocuments(query);

    return {
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    };
  });

  // ============================================
  // SearXNG Management Routes
  // ============================================

  // GET /api/v1/admin/searxng/status - Get SearXNG status
  app.get('/api/v1/admin/searxng/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = getSearXNGConfig();
      const instanceInfo = getSearXNGInstanceInfo();
      const providerStatus = getSearchProviderStatus();
      const dockerAvailable = await isDockerAvailable();

      return {
        config: {
          enabled: config.enabled,
          url: config.url,
          autoStart: config.autoStart,
          port: config.port,
          instanceType: config.instanceType,
          healthCheckInterval: config.healthCheckInterval,
        },
        instance: {
          status: instanceInfo.status,
          containerId: instanceInfo.containerId,
          containerName: instanceInfo.containerName,
          port: instanceInfo.port,
          url: instanceInfo.url,
          uptime: instanceInfo.uptime,
          healthCheck: instanceInfo.healthCheck,
          restartAttempts: instanceInfo.restartAttempts,
          lastStarted: instanceInfo.lastStarted,
          lastStopped: instanceInfo.lastStopped,
          error: instanceInfo.error,
        },
        provider: providerStatus,
        docker: {
          available: dockerAvailable,
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      request.log.error({
        event: 'searxng_status_failed',
        error: {
          name: err?.constructor?.name || 'Unknown',
          message: err?.message || 'Unknown error',
          stack: err?.stack,
        }
      }, 'Failed to get SearXNG status');
      return reply.status(500).send({ 
        error: 'Failed to get SearXNG status',
        message: err?.message || 'Unknown error',
      });
    }
  });

  // POST /api/v1/admin/searxng/start - Start SearXNG instance
  app.post('/api/v1/admin/searxng/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = getSearXNGConfig();
      
      if (!config.enabled) {
        return reply.status(400).send({ error: 'SearXNG is disabled in configuration' });
      }

      if (config.instanceType === 'remote') {
        return reply.status(400).send({ error: 'Cannot start remote SearXNG instance' });
      }

      const dockerAvailable = await isDockerAvailable();
      if (!dockerAvailable) {
        return reply.status(503).send({ error: 'Docker is not available' });
      }

      request.log.info({ event: 'searxng_start_initiated' }, 'Starting SearXNG instance');
      
      const instanceInfo = await startSearXNG(config);
      
      request.log.info({ 
        event: 'searxng_started',
        status: instanceInfo.status,
        containerId: instanceInfo.containerId,
      }, 'SearXNG instance started');

      return {
        success: true,
        message: 'SearXNG instance started successfully',
        instance: {
          status: instanceInfo.status,
          containerId: instanceInfo.containerId,
          url: instanceInfo.url,
          healthCheck: instanceInfo.healthCheck,
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      // Log detailed error information
      request.log.error({
        event: 'searxng_start_failed',
        error: {
          name: err?.constructor?.name || 'Unknown',
          message: err?.message || 'Unknown error',
          stack: err?.stack,
        }
      }, 'Failed to start SearXNG');
      
      return reply.status(500).send({ 
        error: 'Failed to start SearXNG',
        message: err?.message || 'Unknown error',
        details: err?.stack?.split('\n').slice(0, 3).join('\n'),
      });
    }
  });

  // POST /api/v1/admin/searxng/stop - Stop SearXNG instance
  app.post('/api/v1/admin/searxng/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = getSearXNGConfig();
      
      if (config.instanceType === 'remote') {
        return reply.status(400).send({ error: 'Cannot stop remote SearXNG instance' });
      }

      request.log.info({ event: 'searxng_stop_initiated' }, 'Stopping SearXNG instance');
      
      const instanceInfo = await stopSearXNG();
      
      request.log.info({ 
        event: 'searxng_stopped',
        status: instanceInfo.status,
      }, 'SearXNG instance stopped');

      return {
        success: true,
        message: 'SearXNG instance stopped successfully',
        instance: {
          status: instanceInfo.status,
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      request.log.error({
        event: 'searxng_stop_failed',
        error: {
          name: err?.constructor?.name || 'Unknown',
          message: err?.message || 'Unknown error',
          stack: err?.stack,
        }
      }, 'Failed to stop SearXNG');
      return reply.status(500).send({ 
        error: 'Failed to stop SearXNG',
        message: err?.message || 'Unknown error',
      });
    }
  });

  // POST /api/v1/admin/searxng/restart - Restart SearXNG instance
  app.post('/api/v1/admin/searxng/restart', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = getSearXNGConfig();
      
      if (!config.enabled) {
        return reply.status(400).send({ error: 'SearXNG is disabled in configuration' });
      }

      if (config.instanceType === 'remote') {
        return reply.status(400).send({ error: 'Cannot restart remote SearXNG instance' });
      }

      const dockerAvailable = await isDockerAvailable();
      if (!dockerAvailable) {
        return reply.status(503).send({ error: 'Docker is not available' });
      }

      request.log.info({ event: 'searxng_restart_initiated' }, 'Restarting SearXNG instance');
      
      const instanceInfo = await restartSearXNG(config);
      
      request.log.info({ 
        event: 'searxng_restarted',
        status: instanceInfo.status,
        containerId: instanceInfo.containerId,
      }, 'SearXNG instance restarted');

      return {
        success: true,
        message: 'SearXNG instance restarted successfully',
        instance: {
          status: instanceInfo.status,
          containerId: instanceInfo.containerId,
          url: instanceInfo.url,
          healthCheck: instanceInfo.healthCheck,
          restartAttempts: instanceInfo.restartAttempts,
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      request.log.error({
        event: 'searxng_restart_failed',
        error: {
          name: err?.constructor?.name || 'Unknown',
          message: err?.message || 'Unknown error',
          stack: err?.stack,
        }
      }, 'Failed to restart SearXNG');
      return reply.status(500).send({ 
        error: 'Failed to restart SearXNG',
        message: err?.message || 'Unknown error',
      });
    }
  });

  // POST /api/v1/admin/searxng/health-check - Perform health check
  app.post('/api/v1/admin/searxng/health-check', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = getSearXNGConfig();
      const healthCheck = await performHealthCheck(config);
      
      return {
        success: true,
        healthCheck,
      };
    } catch (error) {
      request.log.error({ error }, 'Health check failed');
      return reply.status(500).send({ 
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // PATCH /api/v1/admin/searxng/config - Update SearXNG configuration
  app.patch('/api/v1/admin/searxng/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const updates = request.body as Partial<SearXNGConfig>;
      
      // Validate allowed updates
      const allowedUpdates = ['enabled', 'url', 'autoStart', 'port', 'instanceType', 'healthCheckInterval'];
      const invalidKeys = Object.keys(updates).filter(key => !allowedUpdates.includes(key));
      
      if (invalidKeys.length > 0) {
        return reply.status(400).send({ 
          error: `Invalid configuration keys: ${invalidKeys.join(', ')}`,
          allowedKeys: allowedUpdates,
        });
      }

      const newConfig = updateSearXNGConfig(updates);
      
      request.log.info({ 
        event: 'searxng_config_updated',
        updates,
      }, 'SearXNG configuration updated');

      return {
        success: true,
        config: {
          enabled: newConfig.enabled,
          url: newConfig.url,
          autoStart: newConfig.autoStart,
          port: newConfig.port,
          instanceType: newConfig.instanceType,
          healthCheckInterval: newConfig.healthCheckInterval,
        },
      };
    } catch (error) {
      request.log.error({ error }, 'Failed to update SearXNG config');
      return reply.status(500).send({ 
        error: 'Failed to update configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================
  // Cache Management Routes
  // ============================================

  // GET /api/v1/admin/cache/stats - Get comprehensive cache statistics
  app.get('/api/v1/admin/cache/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get stats from all cache sources
      const toolStats = {
        search: getSearchCacheStats(),
        wiki: getWikiCacheStats(),
        manpage: getManpageCacheStats(),
        package: getPackageCacheStats(),
      };

      const responseStats = responseCache.getStats();
      const embeddingStats = embeddingCache.getStats();
      const contextStats = contextCache.getStats();
      const globalStats = cacheManager.getGlobalStats();
      const allCacheStats = cacheManager.getAllStats();

      // Calculate totals
      const totalHits = Object.values(allCacheStats).reduce((sum, s) => sum + s.hits, 0);
      const totalMisses = Object.values(allCacheStats).reduce((sum, s) => sum + s.misses, 0);
      const totalSize = Object.values(allCacheStats).reduce((sum, s) => sum + s.size, 0);
      const totalEvictions = Object.values(allCacheStats).reduce((sum, s) => sum + s.evictions, 0);
      const totalMemoryUsage = Object.values(allCacheStats).reduce((sum, s) => sum + (s.memoryUsage || 0), 0);

      return {
        global: {
          hits: totalHits,
          misses: totalMisses,
          hitRate: totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0,
          totalSize,
          totalEvictions,
          estimatedMemoryBytes: totalMemoryUsage,
          estimatedMemoryMB: Math.round(totalMemoryUsage / (1024 * 1024) * 100) / 100,
        },
        tools: toolStats,
        services: {
          responses: responseStats,
          embeddings: embeddingStats,
          context: contextStats,
        },
        namespaces: allCacheStats,
      };
    } catch (error) {
      request.log.error({ error }, 'Failed to get cache stats');
      return reply.status(500).send({ error: 'Failed to get cache statistics' });
    }
  });

  // DELETE /api/v1/admin/cache/clear - Clear all caches
  app.delete('/api/v1/admin/cache/clear', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.log.info({ event: 'cache_clear_all' }, 'Clearing all caches');

      // Clear all caches
      cacheManager.clearAll();
      responseCache.clear();
      embeddingCache.clear();
      contextCache.clearAll();

      request.log.info({ event: 'cache_cleared' }, 'All caches cleared');

      return {
        success: true,
        message: 'All caches cleared successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      request.log.error({ error }, 'Failed to clear caches');
      return reply.status(500).send({ 
        error: 'Failed to clear caches',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // DELETE /api/v1/admin/cache/:namespace - Clear specific cache namespace
  app.delete('/api/v1/admin/cache/:namespace', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { namespace } = request.params as { namespace: string };
      
      request.log.info({ event: 'cache_clear_namespace', namespace }, 'Clearing cache namespace');

      let cleared = false;

      // Handle special namespaces
      switch (namespace) {
        case 'responses':
        case 'llm-responses':
          responseCache.clear();
          cleared = true;
          break;
        case 'embeddings':
          embeddingCache.clear();
          cleared = true;
          break;
        case 'context':
        case 'context-sessions':
        case 'context-snippets':
        case 'context-precomputed':
          contextCache.clearAll();
          cleared = true;
          break;
        case 'search':
          cleared = cacheManager.clearNamespace('search');
          break;
        case 'wiki':
        case 'wiki-search':
        case 'wiki-summary':
          cacheManager.clearNamespace('wiki-search');
          cacheManager.clearNamespace('wiki-summary');
          cleared = true;
          break;
        case 'manpage':
          cleared = cacheManager.clearNamespace('manpage');
          break;
        case 'package':
          cleared = cacheManager.clearNamespace('package');
          break;
        default:
          // Try to clear by namespace name
          cleared = cacheManager.clearNamespace(namespace);
      }

      if (cleared) {
        request.log.info({ event: 'cache_namespace_cleared', namespace }, 'Cache namespace cleared');
        return {
          success: true,
          message: `Cache namespace '${namespace}' cleared successfully`,
          namespace,
          timestamp: new Date().toISOString(),
        };
      } else {
        return reply.status(404).send({ 
          error: 'Namespace not found',
          message: `Cache namespace '${namespace}' does not exist`,
          availableNamespaces: Object.keys(cacheManager.getAllStats()),
        });
      }
    } catch (error) {
      request.log.error({ error }, 'Failed to clear cache namespace');
      return reply.status(500).send({ 
        error: 'Failed to clear cache namespace',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/v1/admin/cache/config - Get cache configuration
  app.get('/api/v1/admin/cache/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return {
        enabled: true, // From config
        defaultTtlSeconds: 300, // From config
        maxSize: 500, // From config
        strategy: 'lru', // From config
        namespaces: Object.keys(cacheManager.getAllStats()),
      };
    } catch (error) {
      request.log.error({ error }, 'Failed to get cache config');
      return reply.status(500).send({ error: 'Failed to get cache configuration' });
    }
  });

  // POST /api/v1/admin/cache/invalidate - Invalidate cache entries by pattern
  app.post('/api/v1/admin/cache/invalidate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { pattern, namespace } = request.body as { pattern?: string; namespace?: string };

      if (!pattern) {
        return reply.status(400).send({ error: 'Pattern is required' });
      }

      request.log.info({ event: 'cache_invalidate', pattern, namespace }, 'Invalidating cache entries');

      let totalInvalidated = 0;

      if (namespace) {
        // Invalidate in specific namespace
        const cache = cacheManager.get(namespace);
        if (cache) {
          totalInvalidated = cache.invalidatePattern(pattern);
        }
      } else {
        // Invalidate across all namespaces
        for (const [ns, cache] of cacheManager.getAll()) {
          totalInvalidated += cache.invalidatePattern(pattern);
        }
      }

      return {
        success: true,
        pattern,
        namespace: namespace || 'all',
        entriesInvalidated: totalInvalidated,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      request.log.error({ error }, 'Failed to invalidate cache');
      return reply.status(500).send({ 
        error: 'Failed to invalidate cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
