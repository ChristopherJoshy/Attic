import { BaseAgent } from './base-agent.js';
import { AuditLog } from '../models/audit-log.js';
import { renderPrompt } from './loader.js';
import { isProfileIncomplete, collectSystemProfile, convertToLegacyProfile } from './system-profile.js';
import { Chat } from '../models/chat.js';
const DISCOVERY_COMMANDS = {
    os_release: {
        command: 'cat /etc/os-release',
        parser: (output) => {
            const lines = output.split('\n');
            const get = (key) => lines.find(l => l.startsWith(`${key}=`))?.split('=')[1]?.replace(/"/g, '') || null;
            return { distro: get('NAME'), distroVersion: get('VERSION_ID') };
        },
    },
    kernel: {
        command: 'uname -r',
        parser: (output) => ({ kernel: output.trim() }),
    },
    package_manager: {
        command: 'which apt dnf pacman zypper emerge xbps-install apk nix-env 2>/dev/null | head -1',
        parser: (output) => {
            const pm = output.trim().split('/').pop() || null;
            return { packageManager: pm };
        },
    },
    cpu: {
        command: "lscpu | grep 'Model name' | head -1",
        parser: (output) => ({ cpuModel: output.replace(/.*:\s*/, '').trim() }),
    },
    gpu: {
        command: 'lspci | grep -i vga',
        parser: (output) => ({ gpuInfo: output.trim() || null }),
    },
    shell: {
        command: 'echo $SHELL',
        parser: (output) => ({ shell: output.trim() }),
    },
    display: {
        command: 'echo $XDG_SESSION_TYPE',
        parser: (output) => ({ displayServer: output.trim() || null }),
    },
    wm: {
        command: 'echo $XDG_CURRENT_DESKTOP',
        parser: (output) => ({ windowManager: output.trim() || null }),
    },
};
export class CuriousAgent extends BaseAgent {
    constructor(task, context, agentConfig, parentAgentId, depth, modelId) {
        super('curious', 'curious-agent', '#ffdd00', task, context, agentConfig, parentAgentId, depth, modelId);
    }
    /**
     * Initialize tool registry with curious-specific tools
     */
    initializeToolRegistry() {
        super.initializeToolRegistry();
        // Register web_search for researching issues
        this.registerTool('web_search', async (params) => {
            const { webSearch } = await import('../tools/search-tool.js');
            const query = params.query;
            const result = await webSearch(query);
            return {
                results: result.results.slice(0, 5).map(r => ({
                    title: r.title,
                    url: r.url,
                    excerpt: r.excerpt,
                })),
            };
        });
        // Register lookup_manpage tool
        this.registerTool('lookup_manpage', async (params) => {
            const command = params.command;
            return {
                command,
                found: false,
                note: 'Manpage lookup requires system integration',
            };
        });
    }
    /**
     * Override renderSystemPrompt to provide curious-agent specific context
     */
    renderSystemPrompt() {
        if (!this.definition) {
            throw new Error('Agent definition not loaded. Call initialize() first.');
        }
        const profile = this.context.systemProfile;
        const systemProfileStr = profile ? this.getSystemProfileString() : 'Unknown system';
        const context = {
            task: this.task,
            tier: this.context.tier,
            agentName: this.name,
            agentType: this.agentType,
            systemProfile: systemProfileStr,
            currentDate: new Date().toISOString().split('T')[0],
            investigationGoal: this.task,
        };
        return renderPrompt(this.definition.systemPrompt, context);
    }
    async run(input, additionalData) {
        this.startMetrics();
        this.setStatus('thinking');
        try {
            // Initialize agent definition and load system prompt
            await this.initialize();
            // Check if we can execute
            if (!this.canExecute()) {
                throw new Error('Circuit breaker is open - agent is temporarily disabled');
            }
            // Check if we should use question-based collection
            const useQuestionMode = additionalData?.useQuestionMode === true;
            if (useQuestionMode) {
                // Use question-based profile collection
                const profile = await this.collectProfileViaQuestions();
                if (profile) {
                    this.emitResult('System profile collected via questions');
                    this.setStatus('done');
                    this.endMetrics();
                    this.recordSuccess();
                    return {
                        commands: [],
                        prompt: `Profile collected: ${profile.distro} ${profile.distroVersion || ''}`,
                        fields: [],
                    };
                }
            }
            const profile = this.context.systemProfile;
            const missingFields = [];
            // Determine which fields are missing
            if (!profile?.distro)
                missingFields.push('os_release');
            if (!profile?.kernel)
                missingFields.push('kernel');
            if (!profile?.packageManager)
                missingFields.push('package_manager');
            if (!profile?.cpuModel)
                missingFields.push('cpu');
            if (!profile?.gpuInfo)
                missingFields.push('gpu');
            if (!profile?.shell)
                missingFields.push('shell');
            if (!profile?.displayServer)
                missingFields.push('display');
            if (!profile?.windowManager)
                missingFields.push('wm');
            // Get commands to run
            const commandsToRun = missingFields
                .filter(f => DISCOVERY_COMMANDS[f])
                .map(f => DISCOVERY_COMMANDS[f].command);
            // Use LLM with tools to generate discovery strategy
            const systemPrompt = this.renderSystemPrompt();
            const userPrompt = `Help discover the user's Linux system configuration.

Investigation goal: "${this.task}"
Input query: "${input}"

Missing information:
${missingFields.map(f => `- ${f}`).join('\n')}

Commands available for discovery:
${commandsToRun.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}

You may use tools to research the issue:
- Use "web_search" if you need to research common problems or solutions
- Use "lookup_manpage" to check command documentation

When you need to use a tool, format your response like:
<tool>tool_name</tool>
<params>{"key": "value"}</params>

After any tool calls, generate a friendly message asking the user to run the discovery commands above. Explain why this information helps us provide better assistance.`;
            // Call LLM with tools
            const { content, toolCalls, usage } = await this.callWithTools([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ], ['web_search', 'lookup_manpage'], { temperature: 0.7, maxTokens: 500, maxToolCalls: 3 });
            // Track token usage
            if (usage) {
                this.recordTokenUsage(usage.totalTokens);
            }
            const promptMessage = content.trim() || `I need to understand your system to give accurate advice. Could you run this in your terminal and paste the output?`;
            // If there's a specific issue to research, spawn a research subagent
            if (this.task.toLowerCase().includes('error') ||
                this.task.toLowerCase().includes('problem') ||
                this.task.toLowerCase().includes('issue')) {
                if (this.canSpawnSubAgent()) {
                    try {
                        await this.spawnSubAgent('research', `Research: ${this.task.slice(0, 60)}`, this.task, { strategy: 'quick', maxResults: 3 });
                    }
                    catch (err) {
                        // Research spawn failure is non-fatal
                        this.emitError(`Research subagent spawn failed: ${err instanceof Error ? err.message : String(err)}`);
                    }
                }
            }
            // Emit discovery event
            this.emitEvent({
                type: 'system:discovery',
                agentId: this.id,
                commands: commandsToRun,
                prompt: promptMessage,
                timestamp: new Date().toISOString(),
            });
            // Log to audit
            await this.logToAudit('system_discovery_requested', {
                missingFields,
                commandsCount: commandsToRun.length,
                toolCallsCount: toolCalls.length,
            });
            this.emitResult(`Requesting ${missingFields.length} system details with ${toolCalls.length} tool calls`);
            this.setStatus('done');
            this.endMetrics();
            this.recordSuccess();
            return { commands: commandsToRun, prompt: promptMessage, fields: missingFields };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.setStatus('error');
            this.endMetrics();
            this.recordFailure();
            this.emitError(errorMessage);
            // Return fallback output
            return {
                commands: [],
                prompt: 'I was unable to generate system discovery commands. Please try again.',
                fields: [],
            };
        }
    }
    // Parse discovery output from user
    static parseDiscoveryOutput(outputs) {
        let merged = {};
        for (const [field, output] of Object.entries(outputs)) {
            const def = DISCOVERY_COMMANDS[field];
            if (def) {
                try {
                    merged = { ...merged, ...def.parser(output) };
                }
                catch (_error) {
                    // Skip fields that fail to parse
                }
            }
        }
        merged.collectedAt = new Date().toISOString();
        return merged;
    }
    // Get required fields for a profile
    static getRequiredFields(profile) {
        if (!profile)
            return Object.keys(DISCOVERY_COMMANDS);
        const missing = [];
        if (!profile.distro)
            missing.push('os_release');
        if (!profile.kernel)
            missing.push('kernel');
        if (!profile.packageManager)
            missing.push('package_manager');
        return missing;
    }
    /**
     * Collect system profile via interactive questions
     * This is called when command-based discovery is not available
     */
    async collectProfileViaQuestions() {
        try {
            // Load the chat to check current profile state
            const chat = await Chat.findById(this.context.chatId);
            if (!chat) {
                return null;
            }
            // Check if profile is already complete
            if (!isProfileIncomplete(chat)) {
                return chat.systemProfile;
            }
            // Emit a message explaining what we're doing
            this.emitEvent({
                type: 'message:chunk',
                content: "I'll ask you a few quick questions about your system to provide better Linux advice.",
                timestamp: new Date().toISOString()
            });
            // Collect profile via questions
            const profile = await collectSystemProfile(chat, this.context.userId || this.context.sessionId, async (questions) => {
                return await this.askUserQuestions(questions);
            }, async (chatId, profileData) => {
                // Save to database
                await Chat.updateOne({ _id: chatId }, {
                    $set: {
                        'context.systemProfile': profileData,
                        systemProfile: convertToLegacyProfile(profileData),
                    }
                });
            });
            // Confirm profile collection
            this.emitEvent({
                type: 'message:chunk',
                content: `Got it! I'll remember you're using ${profile.distro} with ${profile.packageManager}.`,
                timestamp: new Date().toISOString()
            });
            return convertToLegacyProfile(profile);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.emitError(`Failed to collect system profile: ${errorMessage}`);
            return null;
        }
    }
    // Log to audit trail
    async logToAudit(action, details) {
        try {
            const auditEntry = new AuditLog({
                chatId: this.context.chatId,
                sessionId: this.context.sessionId,
                userId: this.context.userId,
                actionId: `${this.id}-${action}`,
                command: `curious:${action}`,
                risk: 'low',
                userDecision: 'pending',
                hmac: 'curious-agent',
                createdAt: new Date(),
                ...details,
            });
            await auditEntry.save();
        }
        catch (_error) {
            // Don't fail execution if audit logging fails
            this.emitError('Failed to write to audit log');
        }
    }
}
//# sourceMappingURL=curious-agent.js.map