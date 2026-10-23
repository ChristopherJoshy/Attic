const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = process.env.GROQ_API_KEY || "";

export const TEXT_MODEL = "llama-3.3-70b-versatile";
export const FAST_MODEL = "llama-3.1-8b-instant";
export const VISION_MODEL = "qwen/qwen3.6-27b";

export type ChatRole = "system" | "user" | "assistant";
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface GroqMessage {
  role: ChatRole;
  content: string | ContentPart[];
}

interface GroqOptions {
  model?: string;
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
}

export async function groqChat(
  messages: GroqMessage[],
  opts: GroqOptions = {}
): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model ?? TEXT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_completion_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export interface ParsedExpense {
  amount: number;
  description: string;
  category: string;
  currency: string;
  merchant?: string;
  note?: string;
  splitBetween: string[];
  splitType: "equal" | "custom";
  customShares?: { name: string; amount: number }[];
}

export async function parseExpenseText(
  input: string,
  memberNames: string[]
): Promise<ParsedExpense> {
  const system = `You parse natural-language expense notes into structured JSON for a shared expense tracker.
Available group members: ${memberNames.join(", ")}.
Map any name mentioned (including "me", "I", "myself") to the closest member name. If "me"/"I" is used and you don't know who, pick the first member.
Return ONLY JSON with this shape:
{
  "amount": number (in the detected currency, e.g. 42 or 42.50),
  "description": short label (e.g. "dinner", "groceries", "uber"),
  "category": one of food|transport|shopping|bills|entertainment|health|rent|other,
  "currency": ISO 4217 code, default USD,
  "merchant": optional string,
  "note": optional string,
  "splitBetween": array of member names (exact strings from the list) who share the cost,
  "splitType": "equal" unless explicit per-person amounts given,
  "customShares": array of {name, amount} ONLY when splitType is "custom"
}`;
  const raw = await groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: input },
    ],
    { json: true, temperature: 0 }
  );
  return JSON.parse(raw);
}

export interface ParsedReceipt {
  merchant: string;
  total: number;
  currency: string;
  date?: string;
  tax?: number;
  items: { name: string; qty: number; price: number }[];
}

export async function parseReceiptImage(
  base64DataUrl: string
): Promise<ParsedReceipt> {
  const system = `You are a receipt OCR parser. Extract structured data from the receipt image.
Return ONLY JSON with this shape:
{
  "merchant": string,
  "total": number (final total including tax),
  "currency": ISO 4217 code, default USD,
  "date": ISO 8601 date if visible,
  "tax": number if visible,
  "items": [{"name": string, "qty": number, "price": number (line total)}]
}
If a field is not readable, omit it or use null. Be precise with numbers.`;
  const raw = await groqChat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the receipt data as JSON. Respond with JSON only.",
          },
          { type: "image_url", image_url: { url: base64DataUrl } },
        ],
      },
    ],
    { json: true, temperature: 0.1, model: VISION_MODEL, maxTokens: 2048 }
  );
  return JSON.parse(raw);
}

export async function chatAboutGroup(
  question: string,
  context: string,
  history: { role: string; content: string }[] = []
): Promise<string> {
  const system = `You are Untangle's AI assistant for a shared expense group. Answer the user's question using ONLY the provided group data context. Be concise, direct, and conversational. Use numbers and names precisely. If the answer isn't in the data, say so. Format amounts with the group's currency. Keep responses under 6 sentences unless asked for detail.

GROUP DATA CONTEXT:
${context}`;

  const messages: GroqMessage[] = [{ role: "system", content: system }];
  for (const h of history.slice(-10)) {
    messages.push({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.content,
    });
  }
  messages.push({ role: "user", content: question });

  return groqChat(messages, { temperature: 0.4, maxTokens: 1024, model: TEXT_MODEL });
}

export async function monthlySummary(context: string): Promise<string> {
  const system = `You are Untangle's AI. Produce a concise monthly spending summary for the group using ONLY the provided data. Use bullet points. Mention total spent, top category, who paid the most, and any notable balances. Keep it under 120 words. Format amounts with the currency.

GROUP DATA CONTEXT:
${context}`;
  return groqChat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: "Generate the monthly summary for this group.",
      },
    ],
    { temperature: 0.5, maxTokens: 600, model: TEXT_MODEL }
  );
}
