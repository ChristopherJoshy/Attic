import { BaseAgent } from './base-agent.js';
import { AuditLog } from '../models/audit-log.js';
export class ValidatorAgent extends BaseAgent {
    constructor(task, context, agentConfig, parentAgentId, depth, modelId) {
        super('validator', 'validator-agent', '#ff4444', task, context, agentConfig, parentAgentId, depth, modelId);
    }
    /**
     * Initialize tool registry with validator-specific tools
     */
    initializeToolRegistry() {
        super.initializeToolRegistry();
        // Register validate_command tool
        this.registerTool('validate_command', async (params) => {
            const { validateCommand } = await import('../tools/command-validator.js');
            const command = params.command;
            const detectedPM = this.context.systemProfile?.packageManager || null;
            const result = validateCommand(command, detectedPM);
            return {
                command,
                blocked: result.blocked,
                risk: result.risk,
                reason: result.reason,
                incompatiblePM: result.incompatiblePM,
            };
        });
        // Register lookup_manpage tool (placeholder implementation)
        this.registerTool('lookup_manpage', async (params) => {
            const command = params.command;
            const section = params.section;
            // This would integrate with a manpage lookup service
            // For now, return a placeholder response
            return {
                command,
                section: section || '1',
                found: false,
                note: 'Manpage lookup requires system integration',
            };
        });
        // Register search_packages tool for package validation
        this.registerTool('search_packages', async (params) => {
            const query = params.query;
            // This is a placeholder - actual implementation would query the system's package manager
            return {
                query,
                available: false,
                note: 'Package search requires system-specific implementation',
            };
        });
    }
    async run(_input, additionalData) {
        // Initialize agent definition and system prompt
        await this.initialize();
        this.startMetrics();
        this.setStatus('validating');
        const data = additionalData;
        const commands = data?.commands || [];
        try {
            // Check if we can execute
            if (!this.canExecute()) {
                throw new Error('Circuit breaker is open - agent is temporarily disabled');
            }
            const detectedPM = this.context.systemProfile?.packageManager || null;
            const validatedCommands = [];
            const blockedCommands = [];
            const warnings = [];
            const suggestions = [];
            // Use LLM-driven validation with tools
            const systemPrompt = this.renderSystemPrompt();
            const commandsList = commands.map((cmd, i) => `${i + 1}. ${cmd.command} (${cmd.privilegeLevel})`).join('\n');
            const userPrompt = `Validate these commands for safety and compatibility:

Commands to validate:
${commandsList || 'No commands provided'}

Detected package manager: ${detectedPM || 'unknown'}
System: ${this.context.systemProfile?.distro || 'unknown'} ${this.context.systemProfile?.distroVersion || ''}

Instructions:
1. Use validate_command to check each command for safety
2. Use lookup_manpage to verify command syntax if needed
3. Use search_packages to check package availability if relevant
4. For each command, determine if it should be blocked, warned, or approved

When you need to use a tool, format your response like:
<tool>tool_name</tool>
<params>{"key": "value"}</params>

After validation, provide a summary of your findings for each command.`;
            this.emitToolUse('LLM', 'Validating with tool calling', 'running');
            // Use callWithTools for LLM-driven validation
            const { content, toolCalls, usage } = await this.callWithTools([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ], ['validate_command', 'lookup_manpage', 'search_packages'], { temperature: 0.3, maxTokens: 4000, maxToolCalls: 10 });
            // Record token usage
            if (usage) {
                this.recordTokenUsage(usage.totalTokens);
            }
            this.emitToolUse('LLM', 'Validating with tool calling', 'done');
            // Process tool results
            for (const toolCall of toolCalls) {
                if (toolCall.tool === 'validate_command' && toolCall.result) {
                    const result = toolCall.result;
                    const originalCmd = commands.find(c => c.command === result.command);
                    if (!originalCmd)
                        continue;
                    if (result.blocked) {
                        blockedCommands.push({
                            ...originalCmd,
                            risk: result.risk,
                            riskExplanation: result.reason,
                        });
                        // Log blocked command to audit
                        await this.logToAudit('command_blocked', {
                            command: result.command,
                            reason: result.reason,
                            risk: result.risk,
                        });
                    }
                    else {
                        if (result.incompatiblePM) {
                            warnings.push(`Package manager mismatch for: "${result.command}"`);
                            suggestions.push(`Consider using the package manager for your system: ${detectedPM || 'unknown'}`);
                        }
                        const { getDryRunEquivalent } = await import('../tools/command-validator.js');
                        const dryRun = getDryRunEquivalent(result.command);
                        if (dryRun && result.risk !== 'low') {
                            suggestions.push(`For "${result.command}", consider testing with: ${dryRun}`);
                        }
                        validatedCommands.push({
                            ...originalCmd,
                            risk: result.risk,
                            riskExplanation: result.reason,
                            dryRunHint: dryRun || originalCmd.dryRunHint,
                        });
                    }
                }
            }
            // Parse additional warnings and suggestions from LLM response
            if (content.includes('WARNING:') || content.includes('warning:')) {
                const warningMatches = content.match(/(?:WARNING|warning):\s*(.+)/g);
                if (warningMatches) {
                    warnings.push(...warningMatches.map(w => w.replace(/(?:WARNING|warning):\s*/i, '')));
                }
            }
            if (content.includes('SUGGESTION:') || content.includes('suggestion:')) {
                const suggestionMatches = content.match(/(?:SUGGESTION|suggestion):\s*(.+)/g);
                if (suggestionMatches) {
                    suggestions.push(...suggestionMatches.map(s => s.replace(/(?:SUGGESTION|suggestion):\s*/i, '')));
                }
            }
            // Log to audit
            await this.logToAudit('validation_completed', {
                totalCommands: commands.length,
                validatedCount: validatedCommands.length,
                blockedCount: blockedCommands.length,
                warningsCount: warnings.length,
                toolCallsCount: toolCalls.length,
            });
            this.emitResult(`Validated ${validatedCommands.length} commands, blocked ${blockedCommands.length}`);
            this.setStatus('done');
            const tokensUsed = this.metrics?.tokensUsed || 0;
            this.endMetrics();
            this.recordSuccess();
            return {
                validatedCommands,
                blocked: blockedCommands,
                warnings,
                suggestions,
                tokensUsed
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.setStatus('error');
            this.endMetrics();
            this.recordFailure();
            this.emitError(errorMessage);
            // Return fallback output - pass through commands with warnings
            return {
                validatedCommands: commands,
                blocked: [],
                warnings: [`Validation skipped due to error: ${errorMessage}`],
                suggestions: [],
                tokensUsed: this.metrics?.tokensUsed || 0,
            };
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
                command: `validator:${action}`,
                risk: 'low',
                userDecision: 'pending',
                hmac: 'validator-agent',
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
//# sourceMappingURL=validator-agent.js.map