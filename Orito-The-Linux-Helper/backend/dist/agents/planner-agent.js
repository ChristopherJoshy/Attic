import { BaseAgent } from './base-agent.js';
import { getDateContext } from '../tools/date-tool.js';
import { AuditLog } from '../models/audit-log.js';
export class PlannerAgent extends BaseAgent {
    constructor(task, context, agentConfig, parentAgentId, depth, modelId) {
        super('planner', 'planner-agent', '#ffa500', task, context, agentConfig, parentAgentId, depth, modelId);
    }
    /**
     * Initialize tool registry with planner-specific tools
     */
    initializeToolRegistry() {
        super.initializeToolRegistry();
        // Register calculate tool for calculations in planning
        this.registerTool('calculate', async (params) => {
            const { calculate } = await import('../tools/calculator-tool.js');
            const expression = params.expression;
            const result = calculate(expression);
            return {
                expression: result.expression,
                result: result.result,
                error: result.error,
            };
        });
        // Register search_packages tool for package lookups
        this.registerTool('search_packages', async (params) => {
            // This is a placeholder - actual implementation would query the system's package manager
            const query = params.query;
            return {
                query,
                results: [],
                note: 'Package search requires system-specific implementation',
            };
        });
    }
    /**
     * Initialize the agent by loading its definition and rendering the system prompt
     */
    async init() {
        await this.initialize();
    }
    async run(query, additionalData) {
        this.startMetrics();
        this.setStatus('thinking');
        const data = additionalData;
        const dateContext = data?.dateContext || getDateContext();
        try {
            // Check if we can execute
            if (!this.canExecute()) {
                throw new Error('Circuit breaker is open - agent is temporarily disabled');
            }
            // Render the system prompt with context
            const systemPrompt = this.renderSystemPrompt();
            const systemProfile = this.context.systemProfile;
            const profileStr = systemProfile
                ? `User's system: ${systemProfile.distro} ${systemProfile.distroVersion}, kernel ${systemProfile.kernel}, package manager: ${systemProfile.packageManager}, shell: ${systemProfile.shell}`
                : 'System profile not yet collected.';
            // Include conversation context if available
            const contextStr = data?.conversationContext
                ? `\n\nPrevious conversation context:\n${data.conversationContext}`
                : '';
            // Build the planning prompt
            const userPrompt = `${dateContext}

User query: "${query}"
${profileStr}
${contextStr}

Research findings:
${data?.researchSummary || 'No research available.'}

Instructions:
1. Generate numbered steps adapted to the user's specific distro and package manager
2. For each command, specify the privilege level: "read-only", "user", or "root"
3. Include safety checks before destructive operations
4. Provide dry-run alternatives where possible
5. Use the LATEST syntax and flags for commands (based on current date above)
6. Include prerequisites array (required packages, permissions, or system state)
7. Include troubleshooting array (common issues and solutions)
8. Add expectedOutput field to commands where appropriate to help users verify success

You may use tools if needed:
- Use "calculate" for any mathematical calculations (e.g., disk space calculations)
- Use "search_packages" to check package availability

When you need to use a tool, format your response like:
<tool>tool_name</tool>
<params>{"key": "value"}</params>

Output as JSON:
{
  "steps": ["Step 1: ...", "Step 2: ..."],
  "commands": [
    {
      "command": "exact command string",
      "privilegeLevel": "read-only|user|root",
      "risk": "low|medium|high",
      "riskExplanation": "why this risk level",
      "dryRunHint": "dry-run alternative or null",
      "expectedOutput": "what the user should see when command succeeds (optional)"
    }
  ],
  "prerequisites": ["prerequisite 1", "prerequisite 2"],
  "troubleshooting": ["issue 1: solution", "issue 2: solution"]
}`;
            this.emitToolUse('LLM', 'Generating plan with tool calling', 'running');
            // Use callWithTools for LLM-driven planning
            const { content, toolCalls, usage } = await this.callWithTools([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ], ['calculate', 'search_packages'], { temperature: 0.7, maxTokens: 4000, maxToolCalls: 3 });
            // Record token usage
            if (usage) {
                this.recordTokenUsage(usage.totalTokens);
            }
            this.emitToolUse('LLM', 'Generating plan with tool calling', 'done');
            // Parse the result
            let parsed;
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                parsed = JSON.parse(jsonMatch?.[0] || '{"steps":[],"commands":[],"prerequisites":[],"troubleshooting":[]}');
            }
            catch (_parseError) {
                // If JSON parsing fails, treat the result as a single step
                parsed = {
                    steps: [content],
                    commands: [],
                    prerequisites: [],
                    troubleshooting: []
                };
            }
            // Map commands to proper type
            const commands = (parsed.commands || []).map((cmd) => {
                const c = cmd;
                return {
                    command: c.command || '',
                    privilegeLevel: c.privilegeLevel || 'user',
                    risk: c.risk || 'medium',
                    riskExplanation: c.riskExplanation || '',
                    dryRunHint: c.dryRunHint || null,
                    expectedOutput: c.expectedOutput,
                    citations: data?.citations?.slice(0, 3) || [],
                };
            });
            // Optionally spawn validator subagent if needed for complex plans
            if (commands.some(c => c.risk === 'high') && this.canSpawnSubAgent()) {
                try {
                    await this.spawnSubAgent('validator', 'Validate high-risk commands', query, { commands });
                }
                catch (err) {
                    // Validator spawn failure is non-fatal
                    this.emitError(`Validator spawn failed: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            // Log to audit
            await this.logToAudit('plan_generated', {
                stepsCount: parsed.steps.length,
                commandsCount: commands.length,
                query: query.slice(0, 200),
                toolCallsCount: toolCalls.length,
            });
            this.emitResult(`Generated ${parsed.steps.length} steps with ${commands.length} commands`);
            this.setStatus('done');
            this.endMetrics();
            this.recordSuccess();
            return {
                steps: parsed.steps,
                commands,
                prerequisites: parsed.prerequisites || [],
                troubleshooting: parsed.troubleshooting || [],
                tokensUsed: this.metrics?.tokensUsed || 0
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.setStatus('error');
            this.endMetrics();
            this.recordFailure();
            this.emitError(errorMessage);
            // Return fallback output
            return {
                steps: ['Unable to generate a detailed plan. Please try again.'],
                commands: [],
                prerequisites: [],
                troubleshooting: [],
                tokensUsed: this.metrics?.tokensUsed || 0
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
                command: `planner:${action}`,
                risk: 'low',
                userDecision: 'pending',
                hmac: 'planner-agent',
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
//# sourceMappingURL=planner-agent.js.map