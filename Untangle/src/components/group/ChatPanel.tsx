"use client";

import { useEffect, useRef, useState } from "react";
import { api, ChatMsg } from "@/lib/api";
import { Panel, Tag, Rule } from "@/components/ascii";
import { useToast } from "@/hooks/use-toast";
import { getSocket } from "@/lib/socket";
import { Send, Bot, User, FileText, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ChatPanel({ groupId }: { groupId: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadHistory = async () => {
    try {
      const res = await api<{ messages: ChatMsg[] }>(
        `/api/groups/${groupId}/chat`
      );
      setMessages(res.messages);
    } catch (e) {
      toast({ title: "load failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  useEffect(() => {
    loadHistory();
    const s = getSocket();
    const onMsg = (m: ChatMsg) => {
      setMessages((p) => {
        if (p.some((x) => x.id === m.id)) return p;
        return [...p, m];
      });
      if (m.role === "assistant") setThinking(false);
    };
    s.on("chat:message", onMsg);
    return () => {
      s.off("chat:message", onMsg);
    };
  }, [groupId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const ask = async () => {
    if (!input.trim() || thinking) return;
    const q = input.trim();
    setInput("");
    setThinking(true);
    try {
      const res = await api<{ userMessage: ChatMsg; message: ChatMsg }>(
        `/api/groups/${groupId}/chat`,
        {
          method: "POST",
          body: JSON.stringify({ question: q }),
        }
      );
      setMessages((p) => {
        const next = [...p];
        if (!next.some((m) => m.id === res.userMessage.id)) next.push(res.userMessage);
        if (!next.some((m) => m.id === res.message.id)) next.push(res.message);
        return next;
      });
    } catch (e) {
      toast({ title: "failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setThinking(false);
    }
  };

  const getSummary = async () => {
    setLoadingSummary(true);
    setSummary(null);
    try {
      const res = await api<{ summary: string }>(
        `/api/groups/${groupId}/summary`
      );
      setSummary(res.summary);
    } catch (e) {
      toast({ title: "failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoadingSummary(false);
    }
  };

  const suggestions = [
    "who owes me the most?",
    "how much did we spend on food this month?",
    "what's our biggest expense?",
    "summarize everyone's balance",
  ];

  return (
    <div className="space-y-3">
      <Panel
        title="// ai assistant"
        right={
          <button
            onClick={getSummary}
            disabled={loadingSummary}
            className="text-[10px] px-2 py-1 border border-border text-[var(--dim)] hover:text-primary hover:border-primary transition-colors tracking-widest uppercase flex items-center gap-1"
          >
            {loadingSummary ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <FileText size={11} />
            )}
            monthly summary
          </button>
        }
      >
        <div
          ref={scrollRef}
          className="h-72 overflow-y-auto terminal-scroll space-y-3 pr-1"
        >
          {messages.length === 0 && !thinking && (
            <div className="text-center py-8">
              <Bot size={28} className="mx-auto text-primary glow mb-3" />
              <p className="text-[var(--dim)] text-sm">ask me about your group</p>
              <p className="text-xs text-[var(--dim)] mt-1">
                i can see all expenses, balances & settlements
              </p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`shrink-0 w-7 h-7 border flex items-center justify-center ${
                    m.role === "assistant"
                      ? "border-primary text-primary glow"
                      : "border-border text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
                </div>
                <div
                  className={`max-w-[80%] border p-2.5 text-sm ${
                    m.role === "assistant"
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="text-[10px] text-[var(--dim)] mb-0.5">
                    {m.role === "assistant"
                      ? "untangle.ai"
                      : m.user?.username || "you"}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {m.content}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {thinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2"
            >
              <div className="shrink-0 w-7 h-7 border border-primary text-primary glow flex items-center justify-center">
                <Bot size={14} />
              </div>
              <div className="border border-primary/30 bg-primary/5 p-2.5 text-sm">
                <span className="text-primary cursor-blink">thinking</span>
              </div>
            </motion.div>
          )}
        </div>

        {summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3"
          >
            <Rule label="monthly summary" />
            <div className="border border-[var(--amber)]/40 bg-[var(--amber)]/5 p-3 text-sm whitespace-pre-wrap leading-relaxed">
              {summary}
            </div>
          </motion.div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-[10px] px-2 py-1 border border-border text-[var(--dim)] hover:text-primary hover:border-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="ask about expenses, balances, who owes what..."
            className="flex-1 px-3 py-2 border bg-input text-sm"
            disabled={thinking}
          />
          <button
            onClick={ask}
            disabled={!input.trim() || thinking}
            className="px-3 py-2 border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </Panel>
    </div>
  );
}
