/**
 * Tool Schemas - OpenAI-compatible function schemas for LLM tool calling
 * Defines the structure and parameters for each available tool
 */
export interface ToolParameter {
    type?: string;
    description: string;
    enum?: string[];
    anyOf?: Array<{
        type: string;
    }>;
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
export declare const toolSchemas: Record<string, ToolSchema>;
/**
 * Get all tool schemas as an array for LLM API calls
 */
export declare function getAllToolSchemas(): ToolSchema[];
/**
 * Get a subset of tool schemas by name
 */
export declare function getToolSchemas(names: string[]): ToolSchema[];
/**
 * Check if a tool name is valid
 */
export declare function isValidTool(name: string): boolean;
/**
 * Get required parameters for a tool
 */
export declare function getToolRequiredParams(name: string): string[];
/**
 * Validate tool arguments against schema
 * Returns array of validation errors (empty if valid)
 */
export declare function validateToolArgs(name: string, args: Record<string, any>): string[];
//# sourceMappingURL=tool-schemas.d.ts.map