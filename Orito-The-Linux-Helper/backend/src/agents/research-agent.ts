import { BaseAgent, type AgentConfig, type ToolCallResult } from './base-agent.js';
import { openRouterComplete } from '../llm/openrouter-client.js';
import { AuditLog } from '../models/audit-log.js';
import { config } from '../config/index.js';
import { agentConfig } from '../config/tool-config.js';
import type { Citation, OrchestratorContext, ResearchOutput } from '../types.js';

// Source weights for credibility scoring - now from centralized config
const SOURCE_WEIGHTS = agentConfig.research.sourceWeights;
const DEFAULT_SOURCE_WEIGHT = agentConfig.research.defaultSourceWeight;

// Get source weight based on URL
function getSourceWeight(url: string): number {
    for (const [domain, weight] of Object.entries(SOURCE_WEIGHTS)) {
        if (url.includes(domain)) return weight;
    }
    return DEFAULT_SOURCE_WEIGHT;
}

// Research strategy types
type ResearchStrategy = 'quick' | 'deep' | 'adaptive';

// Additional data type for research
interface ResearchAdditionalData {
    conversationContext?: string;
    dateContext?: string;
    strategy?: ResearchStrategy;
    maxResults?: number;
}

export class ResearchAgent extends BaseAgent {
    private subResearchCount = 0; // Track sub-research spawns to prevent explosion
    // Max sub-research from centralized config
    private static get MAX_SUB_RESEARCH() { return agentConfig.research.maxSubResearch; }

    constructor(
        task: string,
        context: OrchestratorContext,
        config?: AgentConfig,
        parentAgentId?: string,
        depth?: number,
        modelId?: string
    ) {
        super('research', 'research-agent', '#00d4aa', task, context, config, parentAgentId, depth, modelId);
    }

    /**
     * Initialize tool registry with research-specific tools
     */
    protected initializeToolRegistry(): void {
        super.initializeToolRegistry();

        // Register web search tool
        this.registerTool('web_search', async (params) => {
            const { webSearch } = await import('../tools/search-tool.js');
            const query = params.query as string;
            const maxResults = params.max_results as number || 10;
            const result = await webSearch(query);
            return {
                results: result.results.slice(0, maxResults).map(r => ({
                    title: r.title,
                    url: r.url,
                    excerpt: r.excerpt,
                    sourceWeight: getSourceWeight(r.url),
                })),
                totalResults: result.totalResults,
            };
        });

        // Register Wikipedia search tool
        this.registerTool('search_wikipedia', async (params) => {
            const { searchWikipedia, getWikiSummary } = await import('../tools/wiki-tool.js');
            const query = params.query as string;
            const limit = params.limit as number || 3;
            const wikiHits = await searchWikipedia(query, limit);

            const results = [];
            for (const hit of wikiHits) {
                try {
                    const summary = await getWikiSummary(hit.title);
                    results.push({
                        title: hit.title,
                        url: hit.url,
                        excerpt: summary || hit.snippet,
                        sourceWeight: 0.75,
                    });
                } catch {
                    results.push({
                        title: hit.title,
                        url: hit.url,
                        excerpt: hit.snippet,
                        sourceWeight: 0.75,
                    });
                }
            }
            return { results };
        });

        // Register calculator tool
        this.registerTool('calculate', async (params) => {
            const { calculate } = await import('../tools/calculator-tool.js');
            const expression = params.expression as string;
            const result = calculate(expression);
            return {
                expression: result.expression,
                result: result.result,
                error: result.error,
            };
        });
    }

    async run(query: string, additionalData?: Record<string, unknown>): Promise<ResearchOutput> {
        // Initialize agent (load markdown definition and system prompt)
        await this.initialize();

        this.startMetrics();
        this.setStatus('thinking');

        try {
            // Check if we can execute
            if (!this.canExecute()) {
                throw new Error('Circuit breaker is open - agent is temporarily disabled');
            }

            const data = additionalData as ResearchAdditionalData | undefined;
            const strategy = data?.strategy || 'adaptive';
            const maxResults = data?.maxResults || this.getMaxResultsForStrategy(strategy);

            // Use LLM-driven tool calling for research
            const systemPrompt = this.renderSystemPrompt();
            const dateContext = data?.dateContext || new Date().toISOString().split('T')[0];

            // Build context string
            const contextStr = data?.conversationContext
                ? `\n\nPrevious conversation context:\n${data.conversationContext}`
                : '';

            const userPrompt = `Research this Linux query: "${query}"

${dateContext}
${contextStr}

Instructions:
1. Analyze what information is needed to answer this query
2. Use web_search to find current documentation and tutorials
3. Use search_wikipedia for technical concepts and command explanations
4. Use calculate if the query involves any math or unit conversions

When you need to use a tool, format your response like:
<tool>tool_name</tool>
<params>{"key": "value"}</params>

After gathering information, provide a comprehensive response with:
- A summary of findings
- Relevant citations
- Any warnings or version-specific notes`;

            this.emitToolUse('LLM', 'Researching with tool calling', 'running');

            // Call LLM with tools
            const { content, toolCalls, usage } = await this.callWithTools(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                ['web_search', 'search_wikipedia', 'calculate'],
                { temperature: 0.7, maxTokens: 4000, maxToolCalls: 5 }
            );

            // Track token usage
            if (usage) {
                this.recordTokenUsage(usage.totalTokens);
            }

            this.emitToolUse('LLM', 'Researching with tool calling', 'done');

            // Process tool call results into citations
            const citations: Citation[] = this.extractCitationsFromToolCalls(toolCalls, maxResults);

            // Check if we need deeper research on a sub-topic (only for top-level agents)
            let needsDeeper = false;
            let subTopic: string | undefined = undefined;

            if (this.depth === 0 && this.subResearchCount < ResearchAgent.MAX_SUB_RESEARCH) {
                const identifiedSubTopic = await this.identifySubTopic(query, citations);
                if (identifiedSubTopic) {
                    needsDeeper = true;
                    subTopic = identifiedSubTopic;
                    this.subResearchCount++;
                    try {
                        const subResult = await this.spawnSubAgent(
                            'research',
                            `Deep dive: ${identifiedSubTopic.slice(0, 60)}`,
                            identifiedSubTopic,
                            { conversationContext: data?.conversationContext, dateContext, strategy: 'deep', maxResults: 8 }
                        ) as ResearchOutput | undefined;

                        if (subResult && subResult.citations) {
                            // Merge sub-research citations
                            for (const citation of subResult.citations) {
                                const exists = citations.some(c => c.url === citation.url);
                                if (!exists) {
                                    citations.push(citation);
                                }
                            }
                        }
                    } catch (err) {
                        // Sub-agent failure is non-fatal
                        this.emitError(`Sub-research failed: ${err instanceof Error ? err.message : String(err)}`);
                    }
                }
            }

            // Log to audit
            await this.logToAudit('research_completed', {
                query: query.slice(0, 200),
                citationsCount: citations.length,
                toolCallsCount: toolCalls.length,
            });

            this.emitResult(`Found ${citations.length} relevant sources with ${toolCalls.length} tool calls`);
            this.setStatus('done');
            this.endMetrics();
            this.recordSuccess();

            return {
                citations,
                summary: content,
                needsDeeper,
                subTopic,
                tokensUsed: this.metrics?.tokensUsed || 0,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.setStatus('error');
            this.endMetrics();
            this.recordFailure();
            this.emitError(errorMessage);

            // Return fallback output
            return {
                citations: [],
                summary: 'Research is temporarily unavailable. Please try again.',
                needsDeeper: false,
                tokensUsed: this.metrics?.tokensUsed || 0,
            };
        }
    }

    /**
     * Get max results based on research strategy - uses centralized config
     */
    private getMaxResultsForStrategy(strategy: ResearchStrategy): number {
        return agentConfig.research.strategyMaxResults[strategy] || agentConfig.research.strategyMaxResults.adaptive;
    }

    /**
     * Extract citations from tool call results
     */
    private extractCitationsFromToolCalls(toolCalls: ToolCallResult[], maxResults: number): Citation[] {
        const citations: Citation[] = [];

        for (const toolCall of toolCalls) {
            if (toolCall.tool === 'web_search' && toolCall.result) {
                const result = toolCall.result as { results: Array<{ title: string; url: string; excerpt: string; sourceWeight: number }> };
                for (const r of result.results || []) {
                    citations.push({
                        url: r.url,
                        title: r.title,
                        excerpt: r.excerpt.slice(0, 300),
                        sourceWeight: r.sourceWeight || 0.5,
                        confidence: r.sourceWeight || 0.5,
                        crawledAt: new Date().toISOString(),
                    });
                }
            } else if (toolCall.tool === 'search_wikipedia' && toolCall.result) {
                const result = toolCall.result as { results: Array<{ title: string; url: string; excerpt: string; sourceWeight: number }> };
                for (const r of result.results || []) {
                    citations.push({
                        url: r.url,
                        title: `Wikipedia: ${r.title}`,
                        excerpt: r.excerpt.slice(0, 300),
                        sourceWeight: 0.75,
                        confidence: 0.75,
                        crawledAt: new Date().toISOString(),
                    });
                }
            }
        }

        // Remove duplicates and sort by confidence
        const uniqueCitations = citations.filter((citation, index, self) =>
            index === self.findIndex(c => c.url === citation.url)
        );

        return uniqueCitations
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, maxResults);
    }

    // Identify if a sub-topic needs deeper research
    private async identifySubTopic(query: string, citations: Citation[]): Promise<string | null> {
        // Simple heuristic: if results mention a specific tool/concept that isn't in the original query
        // and the query is complex enough, suggest a sub-research
        if (query.split(/\s+/).length < 5) return null; // Only for complex queries
        if (citations.length < 3) return null; // Need enough results to identify sub-topics

        try {
            const subTopicPrompt = `Given this Linux query: "${query}"
And these top results:
${citations.slice(0, 3).map(r => `- ${r.title}: ${r.excerpt.slice(0, 100)}`).join('\n')}

Is there a specific sub-topic that needs deeper investigation to fully answer the question? 
If yes, reply with ONLY the sub-topic as a search query (max 10 words).
If no, reply with "NONE".`;

            const llmResponse = await openRouterComplete([
                { role: 'system', content: 'You are a research planner. Reply concisely.' },
                { role: 'user', content: subTopicPrompt },
            ], {
                maxTokens: 30,
                temperature: 0,
                modelId: this.selectedModel,
                apiKey: this.context.apiKey
            });

            // Track token usage
            if (llmResponse.usage) {
                this.recordTokenUsage(llmResponse.usage.totalTokens);
            }

            const trimmed = llmResponse.content.trim();
            if (trimmed === 'NONE' || trimmed.length < 5 || trimmed.length > 100) return null;
            return trimmed;
        } catch {
            return null; // Sub-topic identification failure is non-fatal
        }
    }

    // Log to audit trail
    private async logToAudit(action: string, details: Record<string, unknown>): Promise<void> {
        try {
            const auditEntry = new AuditLog({
                chatId: this.context.chatId,
                agentType: this.agentType,
                agentName: this.name,
                action,
                userDecision: 'pending',
                hmac: 'research-agent',
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
