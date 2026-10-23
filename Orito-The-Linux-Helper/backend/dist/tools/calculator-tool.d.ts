/**
 * Safe calculator tool - uses a custom expression parser instead of eval/new Function
 * This prevents code injection attacks
 */
interface CalcResult {
    expression: string;
    result: number | string;
    error?: string;
}
/**
 * Safe calculate function using custom parser
 */
export declare function calculate(expression: string): CalcResult;
/**
 * Unit conversion functions
 */
export declare function convertUnits(value: number, from: string, to: string): CalcResult;
export {};
//# sourceMappingURL=calculator-tool.d.ts.map