/**
 * Tool Registry - Maps tool names to their implementations
 * Provides centralized access to all tool functions with permission validation
 */
/**
 * Result type for tool execution
 */
export interface ToolResult {
    success: boolean;
    data: any;
    error?: string;
    durationMs?: number;
}
/**
 * Type for tool implementation functions
 */
export type ToolImplementation = (...args: any[]) => Promise<any> | any;
/**
 * Tool permission levels
 */
export type ToolPermission = 'read' | 'write' | 'execute' | 'system';
/**
 * Tool metadata including permissions
 */
interface ToolMetadata {
    implementation: ToolImplementation;
    permissions: ToolPermission[];
    description: string;
    category: 'search' | 'calculation' | 'validation' | 'system' | 'reference';
}
/**
 * Simple registry mapping tool names to implementations
 */
export declare const toolRegistry: Record<string, ToolImplementation>;
/**
 * Get all available tool names
 */
export declare function getAvailableTools(): string[];
/**
 * Get tools by category
 */
export declare function getToolsByCategory(category: ToolMetadata['category']): string[];
/**
 * Get tool permissions
 */
export declare function getToolPermissions(name: string): ToolPermission[];
/**
 * Check if a tool requires specific permission
 */
export declare function toolRequiresPermission(name: string, permission: ToolPermission): boolean;
/**
 * Execute a tool by name with validation
 * @param name - Tool name to execute
 * @param args - Tool arguments
 * @param allowedTools - List of allowed tool names (permission check)
 * @returns Tool execution result
 */
export declare function executeTool(name: string, args: Record<string, any>, allowedTools: string[]): Promise<ToolResult>;
/**
 * Batch execute multiple tools
 * @param toolCalls - Array of {name, args} objects
 * @param allowedTools - List of allowed tool names
 * @returns Array of results in same order
 */
export declare function executeTools(toolCalls: Array<{
    name: string;
    args: Record<string, any>;
}>, allowedTools: string[]): Promise<ToolResult[]>;
/**
 * Get tool information for debugging/monitoring
 */
export declare function getToolInfo(name: string): {
    name: string;
    description: string;
    category: string;
    permissions: string[];
} | null;
/**
 * Get all tool information
 */
export declare function getAllToolInfo(): Array<{
    name: string;
    description: string;
    category: string;
    permissions: string[];
}>;
export {};
//# sourceMappingURL=tool-registry.d.ts.map