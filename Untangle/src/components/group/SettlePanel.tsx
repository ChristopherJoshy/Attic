"use client";

import { useState } from "react";
import { Suggestion } from "@/lib/api";
import { api } from "@/lib/api";
import { Panel, Tag } from "@/components/ascii";
import { money } from "@/lib/ascii";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function SettlePanel({
  groupId,
  suggestions,
  currency,
  onSettled,
}: {
  groupId: string;
  suggestions: Suggestion[];
  currency: string;
  onSettled: () => void;
}) {
  const [settling, setSettling] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const settle = async (s: Suggestion) => {
    const key = `${s.fromUserId}-${s.toUserId}-${s.amount}`;
    setSettling(key);
    try {
      await api(`/api/groups/${groupId}/settle`, {
        method: "POST",
        body: JSON.stringify({
          fromUserId: s.fromUserId,
          toUserId: s.toUserId,
          amount: s.amount,
        }),
      });
      setDone((p) => new Set(p).add(key));
      toast({ title: "settlement recorded" });
      onSettled();
    } catch (e) {
      toast({ title: "failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSettling(null);
    }
  };

  const remaining = suggestions.filter(
    (s) => !done.has(`${s.fromUserId}-${s.toUserId}-${s.amount}`)
  );

  return (
    <div className="space-y-4">
      <Panel title="// optimal settle-up">
        <div className="flex items-start gap-2 mb-3">
          <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-[var(--dim)] leading-relaxed">
            minimum transactions to clear all debts. computed via greedy
            largest-balance matching — settles the group in{" "}
            <span className="text-primary">{remaining.length}</span> payment
            {remaining.length === 1 ? "" : "s"}.
          </p>
        </div>

        {remaining.length === 0 ? (
          <div className="text-center py-8">
            <Check size={28} className="mx-auto text-primary glow mb-3" />
            <p className="text-primary glow text-sm">all settled up</p>
            <p className="text-xs text-[var(--dim)] mt-1">
              no outstanding balances in this group
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {remaining.map((s, i) => {
              const key = `${s.fromUserId}-${s.toUserId}-${s.amount}`;
              return (
                <motion.div
                  key={key + i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border border-border bg-muted/20 p-3"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-foreground">
                          {s.fromDisplayName || s.fromUsername}
                        </span>
                        <ArrowRight size={14} className="text-primary" />
                        <span className="text-foreground">
                          {s.toDisplayName || s.toUsername}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--dim)] mt-0.5">
                        @{s.fromUsername} pays @{s.toUsername}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[var(--amber)] glow-amber font-semibold">
                        {money(s.amount, currency)}
                      </div>
                      <button
                        onClick={() => settle(s)}
                        disabled={settling === key}
                        className="mt-1 text-[10px] px-2 py-1 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors tracking-widest uppercase disabled:opacity-50"
                      >
                        {settling === key ? "..." : "mark paid"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="// how it works">
        <div className="text-[11px] text-[var(--dim)] space-y-1.5 leading-relaxed">
          <p>
            <Tag tone="green">1</Tag> each member&apos;s net = paid − owed
          </p>
          <p>
            <Tag tone="green">2</Tag> creditors (+) and debtors (−) are sorted by amount
          </p>
          <p>
            <Tag tone="green">3</Tag> largest debtor pays largest creditor, repeat
          </p>
          <p>
            <Tag tone="green">4</Tag> result: fewest transactions to zero everyone out
          </p>
        </div>
      </Panel>
    </div>
  );
}
