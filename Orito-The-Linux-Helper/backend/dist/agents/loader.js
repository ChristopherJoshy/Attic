import matter from 'gray-matter';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Cache for loaded agent definitions
 */
const definitionCache = new Map();
/**
 * Load and parse an agent definition from a markdown file
 *
 * @param type - The agent type (e.g., 'research', 'planner')
 * @returns Parsed agent definition with system prompt
 * @throws Error if file not found or parsing fails
 */
export async function loadAgentDefinition(type) {
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
        const definition = {
            name: data.name,
            description: data.description,
            mode: data.mode,
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
    }
    catch (error) {
        if (error.code === 'ENOENT') {
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
export function renderPrompt(template, context) {
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
export function clearCache() {
    definitionCache.clear();
}
//# sourceMappingURL=loader.js.map