/**
 * Date/Time tool — provides current date/time information.
 * Used to inject temporal context into agent prompts so the LLM
 * knows what "latest" and "current" mean.
 */
export interface DateTimeInfo {
    date: string;
    time: string;
    timezone: string;
    timestamp: number;
    iso: string;
    dayOfWeek: string;
    year: number;
    month: string;
    formatted: string;
}
export declare function getCurrentDateTime(): DateTimeInfo;
/**
 * Returns a compact date string suitable for injection into prompts.
 * e.g. "Current date: Saturday, February 14, 2026 at 3:30 PM (UTC)"
 */
export declare function getDateContext(): string;
//# sourceMappingURL=date-tool.d.ts.map