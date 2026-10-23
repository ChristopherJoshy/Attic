/**
 * Date/Time tool — provides current date/time information.
 * Used to inject temporal context into agent prompts so the LLM
 * knows what "latest" and "current" mean.
 */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
export function getCurrentDateTime() {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const year = now.getFullYear();
    const month = MONTHS[now.getMonth()];
    const day = DAYS[now.getDay()];
    const date = now.getDate();
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        timezone: tz,
        timestamp: now.getTime(),
        iso: now.toISOString(),
        dayOfWeek: day,
        year,
        month,
        formatted: `${day}, ${month} ${date}, ${year} at ${h12}:${minutes} ${ampm}`,
    };
}
/**
 * Returns a compact date string suitable for injection into prompts.
 * e.g. "Current date: Saturday, February 14, 2026 at 3:30 PM (UTC)"
 */
export function getDateContext() {
    const dt = getCurrentDateTime();
    return `Current date: ${dt.formatted} (${dt.timezone})`;
}
//# sourceMappingURL=date-tool.js.map