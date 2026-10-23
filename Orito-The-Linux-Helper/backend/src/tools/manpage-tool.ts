import { TTLCache, cacheKey, type CacheStats } from '../utils/ttl-cache.js';
import { toolConfig } from '../config/tool-config.js';

/**
 * Represents a parsed Linux man page
 */
export interface ManPageInfo {
    command: string;
    section?: number;
    synopsis: string;
    description: string;
    options?: { flag: string; description: string }[];
    examples?: string[];
}

// Enhanced TTL cache for man pages with namespacing and strategy support
const manpageCache = new TTLCache<ManPageInfo>({
    maxSize: toolConfig.manpage.cacheMaxEntries,
    ttl: toolConfig.manpage.cacheTtlMs,
    namespace: 'manpage',
    strategy: 'lfu', // Use LFU as man pages for common commands are accessed frequently
});

// Timeout from configuration
const MANPAGE_TIMEOUT_MS = toolConfig.manpage.timeoutMs;

/**
 * Fetches man page content from online sources
 * @param command - The command name
 * @param section - Optional man page section
 * @returns Raw HTML/text content or null if not found
 */
async function fetchFromManSources(command: string, section?: number): Promise<string | null> {
    // Build URLs from configured sources
    const configuredSources = toolConfig.manpage.sources;
    const urls: string[] = [];
    
    for (const source of configuredSources) {
        if (source.includes('man7.org')) {
            urls.push(
                section
                    ? `${source}/man${section}/${command}.${section}.html`
                    : `${source}/man1/${command}.1.html`
            );
        } else if (source.includes('linux.die.net')) {
            urls.push(`${source}/${section || 1}/${command}`);
        } else if (source.includes('tldr.sh')) {
            urls.push(`${source}/${command}`);
        }
    }

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(MANPAGE_TIMEOUT_MS),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Orito-Bot/1.0)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });

            if (response.ok) {
                const content = await response.text();
                if (content && content.length > 100) {
                    return content;
                }
            }
        } catch {
            // Try next source
            continue;
        }
    }

    return null;
}

/**
 * Parses HTML content to extract man page sections
 * @param html - The HTML content
 * @param command - The command name
 * @param section - The man page section
 * @returns Parsed ManPageInfo object
 */
function parseManPage(html: string, command: string, section?: number): ManPageInfo {
    // Clean HTML tags for text extraction
    const cleanText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

    // Extract synopsis
    let synopsis = `${command} [OPTION]... [FILE]...`;
    const synopsisMatch = cleanText.match(/SYNOPSIS\s*([^A-Z]{10,500})/i);
    if (synopsisMatch) {
        synopsis = synopsisMatch[1].trim().slice(0, 300);
    }

    // Extract description
    let description = `Manual page for ${command}`;
    const descMatch = cleanText.match(/DESCRIPTION\s*([^A-Z]{20,1000})/i);
    if (descMatch) {
        description = descMatch[1].trim().slice(0, 500);
    } else {
        // Try alternative patterns
        const altDescMatch = cleanText.match(/(?:description|about)\s*:?\s*([^A-Z]{20,500})/i);
        if (altDescMatch) {
            description = altDescMatch[1].trim().slice(0, 500);
        }
    }

    // Extract options
    const options: { flag: string; description: string }[] = [];
    const optionPatterns = [
        /(-[a-zA-Z0-9]|--[a-zA-Z0-9-]+)\s+([^-]{5,200})/g,
        /(-[a-zA-Z0-9])\s*,?\s*(--[a-zA-Z0-9-]+)\s+([^-]{5,200})/g,
    ];

    for (const pattern of optionPatterns) {
        const matches = cleanText.matchAll(pattern);
        for (const match of matches) {
            const flag = match[1].trim();
            const desc = (match[3] || match[2]).trim();

            if (flag && desc && !options.some(o => o.flag === flag)) {
                options.push({
                    flag,
                    description: desc.slice(0, 150),
                });
            }

            if (options.length >= 15) break;
        }
    }

    // Extract examples
    const examples: string[] = [];
    const exampleMatch = cleanText.match(/EXAMPLES?\s*([^A-Z]{20,1000})/i);
    if (exampleMatch) {
        const exampleText = exampleMatch[1];
        const exampleLines = exampleText
            .split(/\n|\.\s+/)
            .map(line => line.trim())
            .filter(line => line.includes(command) && line.length > 10);

        examples.push(...exampleLines.slice(0, 5));
    }

    // If no examples found in EXAMPLES section, look for command usage patterns
    if (examples.length === 0) {
        const usagePattern = new RegExp(`${command}\\s+[^\\n]{5,100}`, 'g');
        const usageMatches = cleanText.matchAll(usagePattern);
        for (const match of usageMatches) {
            const example = match[0].trim();
            if (!examples.includes(example) && example.length < 150) {
                examples.push(example);
            }
            if (examples.length >= 3) break;
        }
    }

    return {
        command,
        section,
        synopsis,
        description,
        options: options.length > 0 ? options : undefined,
        examples: examples.length > 0 ? examples : undefined,
    };
}

/**
 * Looks up a Linux man page for a given command.
 * Fetches from online sources (man7.org, die.net, tldr.sh) and parses the content.
 * Results are cached for 5 minutes to improve performance.
 *
 * @param command - The command name to look up (e.g., "ls", "grep", "nginx")
 * @param section - Optional man page section number (e.g., 1 for commands, 5 for files)
 * @returns ManPageInfo object with parsed sections
 * @throws Error if the man page cannot be found
 *
 * @example
 * ```typescript
 * const manpage = await lookupManpage('ls', 1);
 * // Returns: { command: "ls", synopsis: "ls [OPTION]... [FILE]...", ... }
 * ```
 */
export async function lookupManpage(command: string, section?: number): Promise<ManPageInfo> {
    if (!command || command.trim().length === 0) {
        throw new Error('Command name is required');
    }

    const normalizedCommand = command.trim().toLowerCase();
    const normalizedSection = section && section > 0 ? section : undefined;

    // Check cache first
    const cacheKeyStr = cacheKey('manpage', normalizedCommand, normalizedSection);
    const cached = manpageCache.get(cacheKeyStr);
    if (cached) {
        return cached;
    }

    try {
        const content = await fetchFromManSources(normalizedCommand, normalizedSection);

        if (!content) {
            // Return minimal info if fetch fails
            const fallbackInfo: ManPageInfo = {
                command: normalizedCommand,
                section: normalizedSection,
                synopsis: `${normalizedCommand} [options] [arguments]`,
                description: `No man page found for ${normalizedCommand}. Try running 'man ${normalizedCommand}' locally.`,
            };
            manpageCache.set(cacheKeyStr, fallbackInfo, 60 * 1000); // Cache for 1 minute
            return fallbackInfo;
        }

        const manpageInfo = parseManPage(content, normalizedCommand, normalizedSection);

        // Cache successful results
        manpageCache.set(cacheKeyStr, manpageInfo);

        return manpageInfo;
    } catch (error) {
        console.error(`Man page lookup failed for "${command}":`, error instanceof Error ? error.message : error);

        // Return fallback on error
        const fallbackInfo: ManPageInfo = {
            command: normalizedCommand,
            section: normalizedSection,
            synopsis: `${normalizedCommand} [options] [arguments]`,
            description: `Error fetching man page for ${normalizedCommand}. Try 'man ${normalizedCommand}' locally.`,
        };

        // Cache error result briefly to avoid repeated failures
        manpageCache.set(cacheKeyStr, fallbackInfo, 60 * 1000);

        return fallbackInfo;
    }
}

/**
 * Returns cache statistics for monitoring/debugging
 * @returns CacheStats object with hit rate and size info
 */
export function getManpageCacheStats() {
    return manpageCache.stats();
}

/**
 * Clears the man page cache (useful for testing or forcing fresh lookups)
 */
export function clearManpageCache(): void {
    manpageCache.clear();
}
