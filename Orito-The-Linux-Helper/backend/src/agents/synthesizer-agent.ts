import { BaseAgent, type AgentConfig } from './base-agent.js';
import { openRouterStream } from '../llm/openrouter-client.js';
import { getDateContext } from '../tools/date-tool.js';
import { AuditLog } from '../models/audit-log.js';
import type { Citation, CommandProposal, OrchestratorContext, SynthesizerOutput, ComplexityLevel, RiskLevel } from '../types.js';

// Additional data type for synthesizer
interface SynthesizerAdditionalData {
    researchSummary: string;
    steps: string[];
    commands: CommandProposal[];
    citations: Citation[];
    blocked: CommandProposal[];
    warnings: string[];
    suggestions: string[];
    conversationContext?: string;
    dateContext?: string;
}

export class SynthesizerAgent extends BaseAgent {
    constructor(
        task: string,
        context: OrchestratorContext,
        agentConfig?: AgentConfig,
        parentAgentId?: string,
        depth?: number,
        modelId?: string
    ) {
        super('synthesizer', 'synthesizer-agent', '#4488ff', task, context, agentConfig, parentAgentId, depth, modelId);
    }

    private getRiskIndicator(risk: RiskLevel): string {
        switch (risk) {
            case 'low':
                return '🟢';
            case 'medium':
                return '🟡';
            case 'high':
                return '🔴';
            default:
                return '⚪';
        }
    }

    private analyzeComplexity(commands: CommandProposal[], steps: string[]): ComplexityLevel {
        if (commands.length === 0 && steps.length === 0) {
            return 'simple';
        }
        if (commands.length <= 2 && steps.length <= 3) {
            return 'simple';
        }
        if (commands.length <= 5 && steps.length <= 7) {
            return 'moderate';
        }
        return 'complex';
    }

    private determineResponseType(commands: CommandProposal[]): 'info' | 'action' | 'repair' | 'decline' {
        if (commands.length === 0) {
            return 'info';
        }

        const hasHighRisk = commands.some(cmd => cmd.risk === 'high');
        if (hasHighRisk) {
            return 'decline';
        }

        const hasRepairKeywords = commands.some(cmd =>
            /fix|repair|restore|recover|troubleshoot/i.test(cmd.command)
        );

        return hasRepairKeywords ? 'repair' : 'action';
    }

    private formatInteractiveGuide(
        query: string,
        researchSummary: string,
        steps: string[],
        commands: CommandProposal[],
        blocked: CommandProposal[],
        warnings: string[],
        suggestions: string[]
    ): string {
        let guide = `# ${query}\n\n`;

        // Add research context
        if (researchSummary) {
            guide += `## Overview\n\n${researchSummary}\n\n`;
        }

        // Add prerequisites if any high-risk commands
        const hasRiskCommands = commands.some(cmd => cmd.risk === 'medium' || cmd.risk === 'high');
        if (hasRiskCommands || commands.length > 3) {
            guide += `## Prerequisites\n\n`;
            guide += `Before proceeding, ensure:\n`;
            guide += `- You have a backup of important data\n`;
            guide += `- You understand the commands you're about to run\n`;
            if (this.context.systemProfile?.distro) {
                guide += `- Your system (${this.context.systemProfile.distro}) is compatible\n`;
            }
            guide += `\n`;
        }

        // Add steps with risk indicators
        if (steps.length > 0) {
            guide += `## Steps\n\n`;
            steps.forEach((step, index) => {
                guide += `${index + 1}. ${step}\n`;
            });
            guide += `\n`;
        }

        // Add commands with risk indicators
        if (commands.length > 0) {
            guide += `## Commands\n\n`;
            commands.forEach((cmd, index) => {
                const riskIndicator = this.getRiskIndicator(cmd.risk);
                guide += `${riskIndicator} **Command ${index + 1}** (${cmd.risk} risk)\n`;
                guide += `\`\`\`bash\n${cmd.command}\n\`\`\`\n`;
                if (cmd.riskExplanation) {
                    guide += `*${cmd.riskExplanation}*\n`;
                }
                if (cmd.dryRunHint) {
                    guide += `💡 Test first: \`${cmd.dryRunHint}\`\n`;
                }
                guide += `\n`;
            });
        }

        // Add verification steps
        if (commands.length > 0) {
            guide += `## Verification\n\n`;
            guide += `After running the commands, verify the results:\n`;
            guide += `- Check for any error messages\n`;
            guide += `- Verify the expected output or changes\n`;
            guide += `- Test the functionality if applicable\n\n`;
        }

        // Add warnings
        if (warnings.length > 0) {
            guide += `## ⚠️ Warnings\n\n`;
            warnings.forEach(warning => {
                guide += `- ${warning}\n`;
            });
            guide += `\n`;
        }

        // Add blocked commands
        if (blocked.length > 0) {
            guide += `## 🔴 Blocked Commands\n\n`;
            guide += `The following commands were blocked for safety:\n\n`;
            blocked.forEach(cmd => {
                guide += `- \`${cmd.command}\`\n`;
                guide += `  *Reason: ${cmd.riskExplanation}*\n`;
            });
            guide += `\n`;
        }

        // Add suggestions
        if (suggestions.length > 0) {
            guide += `## 💡 Suggestions\n\n`;
            suggestions.forEach(suggestion => {
                guide += `- ${suggestion}\n`;
            });
            guide += `\n`;
        }

        // Add troubleshooting
        if (commands.length > 0) {
            guide += `## Troubleshooting\n\n`;
            guide += `If you encounter issues:\n`;
            guide += `1. Check the error message carefully\n`;
            guide += `2. Verify you have the necessary permissions\n`;
            guide += `3. Ensure all prerequisites are met\n`;
            guide += `4. Try the dry-run commands if available\n\n`;
        }

        return guide;
    }

    async run(
        query: string,
        additionalData?: Record<string, unknown>
    ): Promise<SynthesizerOutput> {
        // Initialize agent definition and system prompt
        await this.initialize();

        this.startMetrics();
        this.setStatus('thinking');

        const data = (additionalData as unknown as SynthesizerAdditionalData | undefined) || {
            researchSummary: '',
            steps: [],
            commands: [],
            citations: [],
            blocked: [],
            warnings: [],
            suggestions: [],
        };

        const dateContext = data.dateContext || getDateContext();

        try {
            // Check if we can execute
            if (!this.canExecute()) {
                throw new Error('Circuit breaker is open - agent is temporarily disabled');
            }

            this.emitToolUse('OpenRouter', 'Composing final response', 'running');

            // Render system prompt with context
            const systemPrompt = this.renderSystemPrompt();

            // Build the user prompt with research context
            const contextStr = data.conversationContext
                ? `\n\nPrevious conversation context:\n${data.conversationContext}`
                : '';

            const blockedStr = data.blocked && data.blocked.length > 0
                ? `\n\nBLOCKED commands (DO NOT suggest these):\n${data.blocked.map((b: CommandProposal) => `- ${b.command}: ${b.riskExplanation}`).join('\n')}`
                : '';

            const warningsStr = data.warnings && data.warnings.length > 0
                ? `\n\nWarnings:\n${data.warnings.join('\n')}`
                : '';

            const suggestionsStr = data.suggestions && data.suggestions.length > 0
                ? `\n\nSuggestions:\n${data.suggestions.join('\n')}`
                : '';

            const prompt = `${dateContext}

User asked: "${query}"

Research summary:
${data.researchSummary}

Planned steps:
${data.steps.length > 0 ? data.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n') : '(No specific steps planned — provide an informational response)'}
${blockedStr}${warningsStr}${suggestionsStr}${contextStr}

Instructions:
- Write a comprehensive, helpful response based on the research findings
- Reference the steps and commands naturally
- Mention any risks or warnings clearly with risk indicators (🟢 low, 🟡 medium, 🔴 high)
- Include prerequisites, verification steps, and troubleshooting guidance
- If the information might be outdated, mention the date of your sources
- Do NOT include the raw commands in your text - they will be shown separately as interactive blocks
- Be conversational but precise
- Use markdown formatting for clarity (headers, lists, code blocks)`;

            let content = '';
            let totalTokens = 0;

            // Stream the response
            try {
                await this.executeWithRetry(async () => {
                    await openRouterStream(
                        [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: prompt },
                        ],
                        { modelId: this.selectedModel, apiKey: this.context.apiKey },
                        (chunk: string) => {
                            content += chunk;
                            this.emitEvent({ type: 'message:chunk', content: chunk, timestamp: new Date().toISOString() });
                        }
                    );
                }, 'synthesize-response');

                // Estimate tokens used (rough approximation: 1 token ≈ 4 chars)
                totalTokens = Math.ceil((systemPrompt.length + prompt.length + content.length) / 4);
                this.recordTokenUsage(totalTokens);
            } catch (_streamError) {
                // If streaming fails, try non-streaming as fallback using openRouterComplete
                this.emitError('Streaming failed, falling back to non-streaming response');
                const { openRouterComplete } = await import('../llm/openrouter-client.js');
                const result = await this.executeWithRetry(async () => {
                    return await openRouterComplete(
                        [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: prompt },
                        ],
                        { modelId: this.selectedModel, apiKey: this.context.apiKey }
                    );
                }, 'synthesize-response-fallback');

                content = result.content;
                totalTokens = result.usage?.totalTokens || Math.ceil((systemPrompt.length + prompt.length + content.length) / 4);
                this.recordTokenUsage(totalTokens);

                // Emit the full content as a single chunk
                this.emitEvent({ type: 'message:chunk', content, timestamp: new Date().toISOString() });
            }

            // Generate interactive guide format
            const formattedResponse = this.formatInteractiveGuide(
                query,
                data.researchSummary,
                data.steps,
                data.commands,
                data.blocked || [],
                data.warnings || [],
                data.suggestions || []
            );

            // Combine LLM response with formatted guide
            const finalResponse = `${content}\n\n---\n\n${formattedResponse}`;

            this.emitToolUse('OpenRouter', 'Composing final response', 'done');

            // Analyze metadata
            const complexity = this.analyzeComplexity(data.commands, data.steps);
            const responseType = this.determineResponseType(data.commands);

            // Emit the final message done event
            this.emitEvent({
                type: 'message:done',
                citations: data.citations,
                commands: data.commands,
                timestamp: new Date().toISOString(),
            });

            // Log to audit
            await this.logToAudit('response_synthesized', {
                query: query.slice(0, 200),
                contentLength: finalResponse.length,
                commandsCount: data.commands.length,
                citationsCount: data.citations.length,
                complexity,
                responseType,
            });

            this.emitResult('Response composed');
            this.setStatus('done');
            this.endMetrics();
            this.recordSuccess();

            return {
                response: finalResponse,
                metadata: {
                    responseType,
                    complexity,
                    commandCount: data.commands.length,
                },
                tokensUsed: this.metrics?.tokensUsed || 0,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.setStatus('error');
            this.endMetrics();
            this.recordFailure();
            this.emitError(errorMessage);

            // Emit a fallback response
            const fallbackContent = `I encountered an error while composing the response: ${errorMessage}. Please try again.`;
            this.emitEvent({
                type: 'message:chunk',
                content: fallbackContent,
                timestamp: new Date().toISOString(),
            });

            this.emitEvent({
                type: 'message:done',
                citations: data.citations || [],
                commands: data.commands || [],
                timestamp: new Date().toISOString(),
            });

            return {
                response: `Error: ${errorMessage}`,
                metadata: {
                    responseType: 'decline',
                    complexity: 'simple',
                    commandCount: 0,
                },
                tokensUsed: this.metrics?.tokensUsed || 0,
            };
        }
    }

    // Log to audit trail
    private async logToAudit(action: string, details: Record<string, unknown>): Promise<void> {
        try {
            const auditEntry = new AuditLog({
                chatId: this.context.chatId,
                sessionId: this.context.sessionId,
                userId: this.context.userId,
                actionId: `${this.id}-${action}`,
                command: `synthesizer:${action}`,
                risk: 'low',
                userDecision: 'pending',
                hmac: 'synthesizer-agent',
                createdAt: new Date(),
                ...details,
            });
            await auditEntry.save();
        } catch (_error) {
            // Don't fail execution if audit logging fails
            this.emitError('Failed to write to audit log');
        }
    }
}
