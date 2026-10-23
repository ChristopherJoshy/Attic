/**
 * Tool Schemas - OpenAI-compatible function schemas for LLM tool calling
 * Defines the structure and parameters for each available tool
 */

export interface ToolParameter {
    type?: string;
    description: string;
    enum?: string[];
    anyOf?: Array<{ type: string }>;
    items?: ToolParameter;
    properties?: Record<string, ToolParameter>;
    required?: string[];
}

export interface ToolParameters {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
}

export interface ToolSchema {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: ToolParameters;
    };
}

/**
 * OpenAI-compatible function schemas for all available tools
 */
export const toolSchemas: Record<string, ToolSchema> = {
    web_search: {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web for Linux-related information, tutorials, documentation, and troubleshooting guides. Returns search results with titles, URLs, and excerpts.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query to find relevant Linux information, commands, or tutorials"
                    }
                },
                required: ["query"]
            }
        }
    },

    search_wikipedia: {
        type: "function",
        function: {
            name: "search_wikipedia",
            description: "Search Wikipedia for Linux concepts, distributions, command documentation, and technical information. Returns article titles, snippets, and URLs.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search term for Wikipedia articles"
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of results to return (default: 5, max: 20)"
                    }
                },
                required: ["query"]
            }
        }
    },

    calculate: {
        type: "function",
        function: {
            name: "calculate",
            description: "Perform mathematical calculations safely. Supports basic arithmetic, advanced math functions (sqrt, sin, cos, log, etc.), and constants (pi, e, tau).",
            parameters: {
                type: "object",
                properties: {
                    expression: {
                        type: "string",
                        description: "The mathematical expression to evaluate (e.g., '2 + 2', 'sqrt(16)', 'pi * r^2')"
                    }
                },
                required: ["expression"]
            }
        }
    },

    convert_units: {
        type: "function",
        function: {
            name: "convert_units",
            description: "Convert between units of measurement including data sizes (bytes, KB, MB, GB, TB), lengths (cm, m, km, in, ft, mi), and temperatures (C, F, K).",
            parameters: {
                type: "object",
                properties: {
                    value: {
                        type: "number",
                        description: "The numeric value to convert"
                    },
                    from: {
                        type: "string",
                        description: "Source unit (e.g., 'gb', 'mb', 'm', 'c')"
                    },
                    to: {
                        type: "string",
                        description: "Target unit (e.g., 'mb', 'kb', 'km', 'f')"
                    }
                },
                required: ["value", "from", "to"]
            }
        }
    },

    validate_command: {
        type: "function",
        function: {
            name: "validate_command",
            description: "Validate the safety and compatibility of a Linux command. Checks for destructive operations, privilege requirements, and package manager compatibility.",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "The Linux command to validate"
                    },
                    detectedPackageManager: {
                        anyOf: [
                            { type: "string" },
                            { type: "null" }
                        ],
                        description: "The detected package manager for the user's system (apt, dnf, pacman, zypper, etc.). Can be null if unknown."
                    }
                },
                required: ["command"]
            }
        }
    },

    get_dry_run_equivalent: {
        type: "function",
        function: {
            name: "get_dry_run_equivalent",
            description: "Get a dry-run or simulation version of a package management command that shows what would happen without making changes.",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "The package management command to get a dry-run version for"
                    }
                },
                required: ["command"]
            }
        }
    },

    search_packages: {
        type: "function",
        function: {
            name: "search_packages",
            description: "Search for packages across multiple package managers (apt, dnf, pacman, etc.). Returns available packages, versions, and descriptions.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The package name or search term"
                    },
                    packageManager: {
                        anyOf: [
                            { type: "string" },
                            { type: "null" }
                        ],
                        description: "The package manager to search (apt, dnf, pacman, zypper, etc.). Can be null to search all."
                    }
                },
                required: ["query"]
            }
        }
    },

    lookup_manpage: {
        type: "function",
        function: {
            name: "lookup_manpage",
            description: "Lookup man page information for Linux commands and system calls. Returns command description, usage, options, and examples.",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "The command or system call to look up (e.g., 'ls', 'grep', 'systemd')"
                    },
                    section: {
                        type: "number",
                        description: "Optional man page section number (1-8). Leave null for automatic detection."
                    }
                },
                required: ["command"]
            }
        }
    },

    get_current_datetime: {
        type: "function",
        function: {
            name: "get_current_datetime",
            description: "Get the current date and time information including timezone, day of week, and formatted date string.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },

    get_wiki_summary: {
        type: "function",
        function: {
            name: "get_wiki_summary",
            description: "Get a detailed summary of a specific Wikipedia article by its title. Use after search_wikipedia to get full content.",
            parameters: {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "The exact Wikipedia article title"
                    }
                },
                required: ["title"]
            }
        }
    },

    /**
     * asQuestion - Dynamic question tool for agent-user interaction
     * Allows the model to ask questions with dynamically generated options
     */
    asQuestion: {
        type: "function",
        function: {
            name: "asQuestion",
            description: "Ask the user a question to gather information, clarify requirements, or get decisions. Use this when you need user input to proceed. The question, options, and purpose are all dynamically generated by you based on the context.",
            parameters: {
                type: "object",
                properties: {
                    question: {
                        type: "string",
                        description: "The complete question to ask the user. Be specific and clear."
                    },
                    header: {
                        type: "string",
                        description: "A very short label for the question (max 30 chars), displayed as a title"
                    },
                    purpose: {
                        type: "string",
                        description: "Brief explanation of why you're asking this question and how the answer will be used"
                    },
                    options: {
                        type: "array",
                        description: "Available choices for the user. Each option has a label and description.",
                        items: {
                            type: "object",
                            description: "A question option with label and optional description",
                            properties: {
                                label: {
                                    type: "string",
                                    description: "Display text for this option (1-5 words, concise)"
                                },
                                description: {
                                    type: "string",
                                    description: "Brief explanation of what this choice means"
                                }
                            },
                            required: ["label"]
                        }
                    },
                    multiple: {
                        type: "boolean",
                        description: "Set to true if the user can select multiple options (default: false)"
                    },
                    allowCustom: {
                        type: "boolean",
                        description: "Set to true to allow the user to type a custom answer (default: true)"
                    }
                },
                required: ["question"]
            }
        }
    }
};

/**
 * Get all tool schemas as an array for LLM API calls
 */
export function getAllToolSchemas(): ToolSchema[] {
    return Object.values(toolSchemas);
}

/**
 * Get a subset of tool schemas by name
 */
export function getToolSchemas(names: string[]): ToolSchema[] {
    return names
        .filter(name => name in toolSchemas)
        .map(name => toolSchemas[name]);
}

/**
 * Check if a tool name is valid
 */
export function isValidTool(name: string): boolean {
    return name in toolSchemas;
}

/**
 * Get required parameters for a tool
 */
export function getToolRequiredParams(name: string): string[] {
    return toolSchemas[name]?.function.parameters.required ?? [];
}

/**
 * Validate tool arguments against schema
 * Returns array of validation errors (empty if valid)
 */
export function validateToolArgs(name: string, args: Record<string, any>): string[] {
    const schema = toolSchemas[name];
    if (!schema) {
        return [`Unknown tool: ${name}`];
    }

    const errors: string[] = [];
    const required = schema.function.parameters.required;
    const properties = schema.function.parameters.properties;

    // Check required parameters
    for (const param of required) {
        if (!(param in args)) {
            errors.push(`Missing required parameter: ${param}`);
        }
    }

    // Validate parameter types
    for (const [key, value] of Object.entries(args)) {
        const paramDef = properties[key];
        if (!paramDef) {
            errors.push(`Unknown parameter: ${key}`);
            continue;
        }

        const expectedType = paramDef.type;
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (expectedType === 'array' && !Array.isArray(value)) {
            errors.push(`Parameter ${key} should be an array`);
        } else if (expectedType !== 'array' && expectedType !== actualType) {
            errors.push(`Parameter ${key} should be of type ${expectedType}, got ${actualType}`);
        }

        // Check enum constraints
        if (paramDef.enum && !paramDef.enum.includes(value)) {
            errors.push(`Parameter ${key} must be one of: ${paramDef.enum.join(', ')}`);
        }
    }

    return errors;
}
