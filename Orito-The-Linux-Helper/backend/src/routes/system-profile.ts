import type { FastifyInstance } from 'fastify';
import { UserPreferences } from '../models/user-preferences.js';
import { SystemProfile } from '../types.js';

/**
 * System Profile Routes
 * 
 * GET /api/v1/system-profile - Get user's system profile
 * POST /api/v1/system-profile - Save user's system profile
 */

// Valid options for dropdowns
const VALID_DISTROS = [
    'ubuntu', 'fedora', 'arch', 'debian', 'linux_mint',
    'opensuse', 'nixos', 'manjaro', 'pop_os', 'kali_linux'
];

const VALID_PACKAGE_MANAGERS = ['apt', 'dnf', 'pacman', 'zypper', 'nix', 'emerge'];
const VALID_SHELLS = ['bash', 'zsh', 'fish', 'nushell', 'dash'];
const VALID_DESKTOP_ENVIRONMENTS = ['gnome', 'kde', 'xfce', 'cinnamon', 'mate', 'i3', 'sway', 'hyprland'];

interface SystemProfileBody {
    distro?: string;
    distroVersion?: string;
    packageManager?: string;
    shell?: string;
    desktopEnvironment?: string;
}

export async function systemProfileRoutes(app: FastifyInstance) {
    // GET /api/v1/system-profile - Get user's system profile
    app.get('/api/v1/system-profile', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user as { userId: string | null; tier: string };

        if (!userId || tier === 'trial') {
            app.log.warn({
                event: 'system_profile_get_trial_denied',
                user: { userId, tier }
            }, 'Trial user attempted to access system profile');
            return reply.code(403).send({ error: 'System profile not available on trial tier' });
        }

        try {
            const prefs = await UserPreferences.findOne({ userId });

            if (!prefs) {
                app.log.info({
                    event: 'system_profile_not_found',
                    user: { userId }
                }, 'No system profile found, returning defaults');
                return {
                    distro: null,
                    distroVersion: null,
                    packageManager: null,
                    shell: null,
                    desktopEnvironment: null,
                };
            }

            const profile = {
                distro: prefs.defaultDistro !== 'not_selected' ? prefs.defaultDistro : null,
                distroVersion: prefs.distroVersion || null,
                packageManager: prefs.packageManager || null,
                shell: prefs.defaultShell !== 'not_selected' ? prefs.defaultShell : null,
                desktopEnvironment: prefs.desktopEnvironment || null,
            };

            app.log.info({
                event: 'system_profile_retrieved',
                user: { userId }
            }, 'Retrieved system profile');

            return profile;
        } catch (err: any) {
            app.log.error({
                event: 'system_profile_get_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId }
            }, 'Failed to retrieve system profile');
            return reply.code(500).send({ error: 'Failed to retrieve system profile' });
        }
    });

    // POST /api/v1/system-profile - Save user's system profile
    app.post('/api/v1/system-profile', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user as { userId: string | null; tier: string };

        if (!userId || tier === 'trial') {
            app.log.warn({
                event: 'system_profile_post_trial_denied',
                user: { userId, tier }
            }, 'Trial user attempted to update system profile');
            return reply.code(403).send({ error: 'System profile not available on trial tier' });
        }

        const body = request.body as SystemProfileBody;

        // Validate input
        const updates: Record<string, any> = {};

        if (body.distro !== undefined) {
            const distro = body.distro.toLowerCase().replace(/\s+/g, '_');
            if (VALID_DISTROS.includes(distro) || distro === 'not_selected') {
                updates.defaultDistro = distro;
            } else {
                app.log.warn({
                    event: 'system_profile_invalid_distro',
                    user: { userId },
                    distro: body.distro
                }, 'Invalid distro provided');
                return reply.code(400).send({ error: `Invalid distro: ${body.distro}` });
            }
        }

        if (body.distroVersion !== undefined) {
            if (body.distroVersion.length <= 50) {
                updates.distroVersion = body.distroVersion;
            } else {
                return reply.code(400).send({ error: 'Distro version too long (max 50 characters)' });
            }
        }

        if (body.packageManager !== undefined) {
            const pm = body.packageManager.toLowerCase();
            if (VALID_PACKAGE_MANAGERS.includes(pm)) {
                updates.packageManager = pm;
            } else {
                app.log.warn({
                    event: 'system_profile_invalid_package_manager',
                    user: { userId },
                    packageManager: body.packageManager
                }, 'Invalid package manager provided');
                return reply.code(400).send({ error: `Invalid package manager: ${body.packageManager}` });
            }
        }

        if (body.shell !== undefined) {
            const shell = body.shell.toLowerCase();
            if (VALID_SHELLS.includes(shell) || shell === 'not_selected') {
                updates.defaultShell = shell;
            } else {
                app.log.warn({
                    event: 'system_profile_invalid_shell',
                    user: { userId },
                    shell: body.shell
                }, 'Invalid shell provided');
                return reply.code(400).send({ error: `Invalid shell: ${body.shell}` });
            }
        }

        if (body.desktopEnvironment !== undefined) {
            const de = body.desktopEnvironment.toLowerCase();
            if (VALID_DESKTOP_ENVIRONMENTS.includes(de)) {
                updates.desktopEnvironment = de;
            } else {
                app.log.warn({
                    event: 'system_profile_invalid_de',
                    user: { userId },
                    desktopEnvironment: body.desktopEnvironment
                }, 'Invalid desktop environment provided');
                return reply.code(400).send({ error: `Invalid desktop environment: ${body.desktopEnvironment}` });
            }
        }

        if (Object.keys(updates).length === 0) {
            return reply.code(400).send({ error: 'No valid fields to update' });
        }

        try {
            const prefs = await UserPreferences.findOneAndUpdate(
                { userId },
                { $set: updates },
                { new: true, upsert: true }
            );

            app.log.info({
                event: 'system_profile_updated',
                user: { userId },
                updatedFields: Object.keys(updates)
            }, 'Updated system profile');

            return {
                success: true,
                profile: {
                    distro: prefs.defaultDistro !== 'not_selected' ? prefs.defaultDistro : null,
                    distroVersion: prefs.distroVersion || null,
                    packageManager: prefs.packageManager || null,
                    shell: prefs.defaultShell !== 'not_selected' ? prefs.defaultShell : null,
                    desktopEnvironment: prefs.desktopEnvironment || null,
                }
            };
        } catch (err: any) {
            app.log.error({
                event: 'system_profile_update_error',
                error: {
                    message: err.message,
                    stack: err.stack
                },
                user: { userId },
                updates: Object.keys(updates)
            }, 'Failed to update system profile');
            return reply.code(500).send({ error: 'Failed to update system profile' });
        }
    });

    // POST /api/v1/system-profile/detect - Trigger system detection via chat questions
    app.post('/api/v1/system-profile/detect', { preHandler: [app.authenticate] }, async (request, reply) => {
        const { userId, tier } = request.user as { userId: string | null; tier: string };

        if (!userId || tier === 'trial') {
            return reply.code(403).send({ error: 'System profile detection not available on trial tier' });
        }

        // This endpoint returns a flag that tells the frontend to initiate
        // a system discovery conversation with the curious agent
        app.log.info({
            event: 'system_profile_detection_initiated',
            user: { userId }
        }, 'System profile detection initiated');

        return {
            success: true,
            message: 'System profile detection initiated. Start a new chat to answer questions about your system.',
            discoveryMode: true
        };
    });
}