"use client";

import { Balance } from "@/lib/api";
import { Panel, Tag } from "@/components/ascii";
import { money } from "@/lib/ascii";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function BalanceBoard({
  balances,
  currency,
}: {
  balances: Balance[];
  currency: string;
}) {
  const totalSpent = balances.reduce((s, b) => s + b.paid, 0);
  const sorted = [...balances].sort((a, b) => b.net - a.net);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="total spent" value={money(totalSpent, currency)} tone="amber" />
        <Stat label="members" value={String(balances.length)} tone="green" />
        <Stat
          label="in flight"
          value={money(
            balances.filter((b) => b.net > 0).reduce((s, b) => s + b.net, 0),
            currency
          )}
          tone="green"
        />
      </div>

      <Panel title="// member balances">
        <div className="space-y-2">
          {sorted.map((b, i) => {
            const tone = b.net > 0.005 ? "green" : b.net < -0.005 ? "red" : "dim";
            return (
              <motion.div
                key={b.userId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="border border-border bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {tone === "green" ? (
                      <TrendingUp size={14} className="text-primary shrink-0" />
                    ) : tone === "red" ? (
                      <TrendingDown size={14} className="text-destructive shrink-0" />
                    ) : (
                      <Minus size={14} className="text-[var(--dim)] shrink-0" />
                    )}
                    <span className="text-sm truncate">
                      {b.displayName || b.username}
                    </span>
                    <span className="text-[10px] text-[var(--dim)]">
                      @{b.username}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={
                        tone === "green"
                          ? "text-primary glow font-semibold"
                          : tone === "red"
                            ? "text-destructive glow-red font-semibold"
                            : "text-[var(--dim)] font-semibold"
                      }
                    >
                      {b.net > 0.005
                        ? `+${money(b.net, currency)}`
                        : b.net < -0.005
                          ? money(b.net, currency)
                          : money(0, currency)}
                    </div>
                    <div className="text-[10px] text-[var(--dim)] mt-0.5">
                      {tone === "green"
                        ? "is owed"
                        : tone === "red"
                          ? "owes"
                          : "settled"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--dim)]">
                  <span>paid {money(b.paid, currency)}</span>
                  <span>·</span>
                  <span>owes {money(b.owes, currency)}</span>
                </div>
                <div className="mt-2 h-1.5 bg-muted relative overflow-hidden border border-border">
                  <div
                    className={
                      tone === "green"
                        ? "absolute inset-y-0 left-0 bg-primary"
                        : tone === "red"
                          ? "absolute inset-y-0 left-0 bg-destructive"
                          : "absolute inset-y-0 left-0 bg-[var(--dim)]"
                    }
                    style={{
                      width: `${Math.min(100, (Math.abs(b.net) / Math.max(totalSpent || 1, Math.abs(b.net))) * 100)}%`,
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </Panel>

      <Panel title="// legend">
        <div className="flex items-center gap-4 text-[10px] text-[var(--dim)] flex-wrap">
          <span className="flex items-center gap-1">
            <span className="text-primary">+</span> is owed money
          </span>
          <span className="flex items-center gap-1">
            <span className="text-destructive">-</span> owes the group
          </span>
          <Tag tone="dim">0 = settled</Tag>
        </div>
      </Panel>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber";
}) {
  return (
    <div className="ascii-box bg-card/40 p-3">
      <div className="text-[10px] tracking-widest text-[var(--dim)] uppercase">
        {label}
      </div>
      <div
        className={
          tone === "amber"
            ? "text-[var(--amber)] glow-amber font-semibold mt-1"
            : "text-primary glow font-semibold mt-1"
        }
      >
        {value}
      </div>
    </div>
  );
}
