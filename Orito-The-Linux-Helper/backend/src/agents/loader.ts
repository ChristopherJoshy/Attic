import matter from 'gray-matter';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Cache for loaded agent definitions
 */
const definitionCache = new Map<string, AgentDefinition>();

/**
 * Load and parse an agent definition from a markdown file
 * 
 * @param type - The agent type (e.g., 'research', 'planner')
 * @returns Parsed agent definition with system prompt
 * @throws Error if file not found or parsing fails
 */
export async function loadAgentDefinition(type: string): Promise<AgentDefinition> {
    // Check cache first
    const cached = definitionCache.get(type);
    if (cached) {
        return cached;
    }

    try {
        // Construct path to definition file - look in src directory since markdown files aren't compiled
        const definitionPath = join(__dirname, '..', '..', 'src', 'agents', 'definitions', `${type}.md`);
        
        // Read the markdown file
        const fileContent = await readFile(definitionPath, 'utf-8');
        
        // Parse frontmatter and content
        const { data, content } = matter(fileContent);
        
        // Validate required fields
        if (!data.name || !data.description || !data.mode || !data.color) {
            throw new Error(`Invalid agent definition for ${type}: missing required frontmatter fields`);
        }
        
        if (!data.tools) {
            throw new Error(`Invalid agent definition for ${type}: missing tools configuration`);
        }
        
        // Construct agent definition
        const definition: AgentDefinition = {
            name: data.name,
            description: data.description,
            mode: data.mode as AgentMode,
            color: data.color,
            tools: {
                allowed: data.tools.allowed || [],
                restricted: data.tools.restricted || [],
            },
            maxTokens: data.maxTokens,
            max_results: data.max_results,
            max_sub_agents: data.max_sub_agents,
            systemPrompt: content.trim(),
        };
        
        // Cache the definition
        definitionCache.set(type, definition);
        
        return definition;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`Agent definition not found: ${type}`);
        }
        throw error;
    }
}

/**
 * Render a template string by replacing {{key}} placeholders with context values
 * Only replaces placeholders that exist in the template for token optimization
 * 
 * @param template - Template string with {{key}} placeholders
 * @param context - Key-value pairs for replacement
 * @returns Rendered string with placeholders replaced
 */
export function renderPrompt(template: string, context: Record<string, string>): string {
    let rendered = template;
    
    // Only replace placeholders that actually exist in the template
    for (const [key, value] of Object.entries(context)) {
        const placeholder = `{{${key}}}`;
        if (rendered.includes(placeholder)) {
            rendered = rendered.replaceAll(placeholder, value);
        }
    }
    
    return rendered;
}

/**
 * Clear the definition cache (useful for testing or hot-reloading)
 */
export function clearCache(): void {
    definitionCache.clear();
}
