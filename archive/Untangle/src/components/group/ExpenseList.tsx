"use client";

import { Expense } from "@/lib/api";
import { Panel, Tag, Rule } from "@/components/ascii";
import { money, shortDate, catLabel } from "@/lib/ascii";
import { Receipt, User } from "lucide-react";
import { motion } from "framer-motion";

const SOURCE_LABEL: Record<string, string> = {
  manual: "MANUAL",
  nl: "AI-NL",
  ocr: "AI-OCR",
};

export function ExpenseList({
  expenses,
  currency,
}: {
  expenses: Expense[];
  currency: string;
}) {
  if (expenses.length === 0) {
    return (
      <Panel>
        <div className="text-center py-10">
          <Receipt size={28} className="mx-auto text-[var(--dim)] mb-3" />
          <p className="text-[var(--dim)] text-sm">no expenses yet</p>
          <p className="text-xs text-[var(--dim)] mt-1">
            hit &quot;add expense&quot; to start the ledger
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={`// ledger (${expenses.length})`}>
      <div className="space-y-2">
        {expenses.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
            className="border border-border bg-muted/30 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground font-medium truncate">
                    {e.description}
                  </span>
                  <Tag tone="dim">{catLabel(e.category)}</Tag>
                  {e.source !== "manual" && (
                    <Tag tone="amber">{SOURCE_LABEL[e.source] || e.source}</Tag>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[var(--dim)] mt-1">
                  <User size={11} />
                  paid by{" "}
                  <span className="text-primary/80">@{e.paidBy.username}</span>
                  <span className="mx-1">·</span>
                  {shortDate(e.createdAt)}
                </div>
                <div className="text-[10px] text-[var(--dim)] mt-1">
                  split {e.splitType} →{" "}
                  {e.splits.length}{" "}
                  {e.splits.length === 1 ? "person" : "people"}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[var(--amber)] glow-amber font-semibold">
                  {money(e.amount, currency)}
                </div>
                <div className="text-[10px] text-[var(--dim)] mt-0.5">
                  {money(e.amount / e.splits.length, currency)}/each
                </div>
              </div>
            </div>
            {e.note && e.source !== "manual" && (
              <div className="px-3 pb-2 -mt-1">
                <p className="text-[10px] text-[var(--dim)] italic truncate">
                  &quot;{e.note}&quot;
                </p>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}
