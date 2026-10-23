/**
 * Agent operation mode
 */
export type AgentMode = 'autonomous' | 'collaborative' | 'supervised';
/**
 * Tool configuration for agents
 */
export interface AgentTools {
    allowed?: string[];
    restricted?: string[];
}
/**
 * Complete agent definition loaded from markdown files
 */
export interface AgentDefinition {
    name: string;
    description: string;
    mode: AgentMode;
    color: string;
    tools: AgentTools;
    maxTokens?: number;
    max_results?: number;
    max_sub_agents?: number;
    systemPrompt: string;
}
/**
 * Load and parse an agent definition from a markdown file
 *
 * @param type - The agent type (e.g., 'research', 'planner')
 * @returns Parsed agent definition with system prompt
 * @throws Error if file not found or parsing fails
 */
export declare function loadAgentDefinition(type: string): Promise<AgentDefinition>;
/**
 * Render a template string by replacing {{key}} placeholders with context values
 * Only replaces placeholders that exist in the template for token optimization
 *
 * @param template - Template string with {{key}} placeholders
 * @param context - Key-value pairs for replacement
 * @returns Rendered string with placeholders replaced
 */
export declare function renderPrompt(template: string, context: Record<string, string>): string;
/**
 * Clear the definition cache (useful for testing or hot-reloading)
 */
export declare function clearCache(): void;
//# sourceMappingURL=loader.d.ts.map