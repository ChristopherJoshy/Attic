export const BANNER = String.raw`
 ██╗   ██╗███╗   ██╗███████╗███████╗██████╗ ███████╗
 ██║   ██║████╗  ██║██╔════╝██╔════╝██╔══██╗██╔════╝
 ██║   ██║██╔██╗ ██║█████╗  █████╗  ██████╔╝███████╗
 ╚██╗ ██╔╝██║╚██╗██║██╔══╝  ██╔══╝  ██╔══██╗╚════██║
  ╚████╔╝ ██║ ╚████║███████╗███████╗██║  ██║███████║
   ╚═══╝  ╚═╝  ╚═══╝╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝
`;

export const BANNER_SMALL = String.raw`
 _   _ _ _   _           ___ _
| | | (_) |_| |_ _ _ ___| _ \_| |_ ___
| |_| | |  _| ' \ '_/ -_)  _/ |  _/ _ \
 \___/|_|\__|_||_| | \___|_| |_|\__\___/
`;

export const TOP_LEFT = "┌";
export const TOP_RIGHT = "┐";
export const BOTTOM_LEFT = "└";
export const BOTTOM_RIGHT = "┘";
export const HORIZ = "─";
export const VERT = "│";
export const T_DOWN = "┬";
export const T_UP = "┴";
export const T_RIGHT = "├";
export const T_LEFT = "┤";
export const CROSS = "┼";

export function divider(width = 48, label?: string) {
  if (!label) return HORIZ.repeat(width);
  const text = ` ${label} `;
  const side = Math.max(2, Math.floor((width - text.length) / 2));
  return (
    HORIZ.repeat(side) +
    text +
    HORIZ.repeat(Math.max(side, width - side - text.length))
  );
}

export function box(width: number, lines: string[]) {
  const top = TOP_LEFT + HORIZ.repeat(width - 2) + TOP_RIGHT;
  const mid = lines.map((l) => {
    const content = " " + l;
    const pad = Math.max(0, width - 2 - content.length);
    return VERT + content + " ".repeat(pad) + VERT;
  });
  const bot = BOTTOM_LEFT + HORIZ.repeat(width - 2) + BOTTOM_RIGHT;
  return [top, ...mid, bot].join("\n");
}

const CATEGORIES: Record<string, string> = {
  food: "FOOD",
  transport: "TRNSPRT",
  shopping: "SHOP",
  bills: "BILLS",
  entertainment: "ENTRTN",
  health: "HLTH",
  rent: "RENT",
  other: "OTHER",
};

export function catLabel(c: string) {
  return CATEGORIES[c] || "OTHER";
}

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
};

export function money(amount: number, currency = "USD") {
  const sym = SYMBOLS[currency] || "";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${sym}${abs.toFixed(2)}`;
}

export function shortDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

export function timeStr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
