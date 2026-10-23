"use client";

import { useState, useRef } from "react";
import { api, Member } from "@/lib/api";
import { useApp } from "@/store/app";
import { useToast } from "@/hooks/use-toast";
import { ModalShell, Field } from "@/components/dashboard/Dashboard";
import { Tag, Rule } from "@/components/ascii";
import { money } from "@/lib/ascii";
import { Sparkles, Camera, Keyboard, Calculator, Loader2, Check, Upload } from "lucide-react";
import { motion } from "framer-motion";

type Mode = "manual" | "nl" | "ocr";

const CATEGORIES = [
  "food",
  "transport",
  "shopping",
  "bills",
  "entertainment",
  "health",
  "rent",
  "other",
];

export function AddExpenseSheet({
  groupId,
  members,
  currency,
  onClose,
  onAdded,
}: {
  groupId: string;
  members: Member[];
  currency: string;
  onClose: () => void;
  onAdded?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("manual");
  const { user } = useApp();

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("food");
  const [paidById, setPaidById] = useState(user?.id || members[0]?.id || "");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(members.map((m) => m.id))
  );
  const [customShares, setCustomShares] = useState<Record<string, string>>(
    {}
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const toggle = (id: string) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const customTotal = Object.values(customShares)
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const amountNum = parseFloat(amount) || 0;
  const customDiff = Math.round((amountNum - customTotal) * 100) / 100;

  const submit = async (source: "manual" | "nl" | "ocr" = "manual") => {
    if (amountNum <= 0 || !description.trim()) {
      toast({ title: "amount & description required", variant: "destructive" });
      return;
    }
    if (splitType === "equal" && selected.size === 0) {
      toast({ title: "select at least one member", variant: "destructive" });
      return;
    }
    if (splitType === "custom" && Math.abs(customDiff) > 0.01) {
      toast({
        title: "custom shares don't add up",
        description: `off by ${money(customDiff, currency)}`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const splits =
        splitType === "custom"
          ? Object.entries(customShares)
              .filter(([, v]) => parseFloat(v) > 0)
              .map(([userId, v]) => ({ userId, amount: parseFloat(v) }))
          : Array.from(selected).map((userId) => ({ userId }));
      await api(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          amount: amountNum,
          description: description.trim(),
          category,
          paidById,
          splitType,
          splits,
          note,
          source,
        }),
      });
      toast({ title: "expense added" });
      onAdded?.();
      onClose();
    } catch (e) {
      toast({ title: "failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const fillFromParsed = (r: {
    resolved: {
      amount: number;
      description: string;
      category: string;
      splitType: string;
      note: string;
      paidById: string;
      splitUserIds: string[];
      customShares?: { userId: string; amount: number }[];
    };
  }) => {
    const { resolved } = r;
    setAmount(String(resolved.amount));
    setDescription(resolved.description);
    setCategory(resolved.category in CATEGORIES ? resolved.category : "other");
    setSplitType(resolved.splitType === "custom" ? "custom" : "equal");
    setNote(resolved.note);
    setPaidById(resolved.paidById || user?.id || "");
    if (resolved.splitType === "custom" && resolved.customShares) {
      const shares: Record<string, string> = {};
      resolved.customShares.forEach((s) => {
        shares[s.userId] = String(s.amount);
      });
      setCustomShares(shares);
    } else {
      setSelected(new Set(resolved.splitUserIds));
    }
    setMode("manual");
  };

  return (
    <ModalShell title="// add expense" onClose={onClose}>
      <div className="flex border border-border mb-4">
        {(
          [
            { id: "manual", label: "manual", icon: Calculator },
            { id: "nl", label: "ai text", icon: Keyboard },
            { id: "ocr", label: "receipt", icon: Camera },
          ] as { id: Mode; label: string; icon: typeof Calculator }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 px-2 py-2 text-[11px] tracking-widest uppercase border-r border-border last:border-r-0 transition-colors flex items-center justify-center gap-1.5 ${
              mode === t.id
                ? "bg-primary/15 text-primary glow"
                : "text-[var(--dim)] hover:text-foreground"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {mode === "nl" && (
        <NLTab
          groupId={groupId}
          onParsed={fillFromParsed}
          members={members}
        />
      )}

      {mode === "ocr" && (
        <OCRTab
          groupId={groupId}
          members={members}
          currency={currency}
          onConfirm={(total, desc, merchant, shares) => {
            setAmount(String(total));
            setDescription(desc);
            setCategory("food");
            setSplitType("custom");
            setCustomShares(shares);
            setNote(merchant);
            setMode("manual");
          }}
        />
      )}

      {mode === "manual" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="amount">
              <input
                type="number"
                step="0.01"
                className="w-full px-2 py-2 border bg-input text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </Field>
            <Field label="category">
              <select
                className="w-full px-2 py-2 border bg-input text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="description">
            <input
              className="w-full px-2 py-2 border bg-input text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. groceries, dinner, uber"
            />
          </Field>
          <Field label="paid by">
            <select
              className="w-full px-2 py-2 border bg-input text-sm"
              value={paidById}
              onChange={(e) => setPaidById(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName || m.username} {m.id === user?.id ? "(you)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Rule label="split" />

          <div className="flex border border-border">
            <button
              onClick={() => setSplitType("equal")}
              className={`flex-1 py-1.5 text-[11px] tracking-widest uppercase border-r border-border ${
                splitType === "equal"
                  ? "bg-primary/15 text-primary glow"
                  : "text-[var(--dim)]"
              }`}
            >
              equal
            </button>
            <button
              onClick={() => setSplitType("custom")}
              className={`flex-1 py-1.5 text-[11px] tracking-widest uppercase ${
                splitType === "custom"
                  ? "bg-primary/15 text-primary glow"
                  : "text-[var(--dim)]"
              }`}
            >
              custom
            </button>
          </div>

          {splitType === "equal" ? (
            <div className="space-y-1.5">
              <div className="text-[10px] text-[var(--dim)] tracking-widest uppercase">
                split between ({selected.size})
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 border text-sm transition-colors ${
                      selected.has(m.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-[var(--dim)] hover:border-[var(--dim)]"
                    }`}
                  >
                    <span
                      className={`w-3 h-3 border flex items-center justify-center ${
                        selected.has(m.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {selected.has(m.id) && <Check size={10} />}
                    </span>
                    <span className="truncate">
                      {m.displayName || m.username}
                    </span>
                  </button>
                ))}
              </div>
              {selected.size > 0 && amountNum > 0 && (
                <p className="text-[10px] text-[var(--dim)]">
                  {money(amountNum / selected.size, currency)} per person
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--dim)] tracking-widest uppercase">
                  per-person amount
                </span>
                <span
                  className={`text-[10px] ${
                    Math.abs(customDiff) < 0.01
                      ? "text-primary"
                      : "text-destructive"
                  }`}
                >
                  {money(customTotal, currency)} / {money(amountNum, currency)}
                </span>
              </div>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-xs flex-1 truncate">
                    {m.displayName || m.username}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 px-2 py-1.5 border bg-input text-sm text-right"
                    value={customShares[m.id] || ""}
                    onChange={(e) =>
                      setCustomShares((p) => ({
                        ...p,
                        [m.id]: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
          )}

          <Field label="note (optional)">
            <input
              className="w-full px-2 py-2 border bg-input text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="extra context"
            />
          </Field>

          <Rule />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 border border-border text-xs tracking-widest uppercase hover:border-[var(--dim)] transition-colors"
            >
              cancel
            </button>
            <button
              onClick={() => submit("manual")}
              disabled={busy}
              className="flex-1 px-3 py-2 border border-primary bg-primary/10 text-primary text-xs tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
            >
              {busy ? "saving..." : "[ add ]"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function NLTab({
  groupId,
  onParsed,
  members,
}: {
  groupId: string;
  onParsed: (r: {
    resolved: {
      amount: number;
      description: string;
      category: string;
      splitType: string;
      note: string;
      paidById: string;
      splitUserIds: string[];
      customShares?: { userId: string; amount: number }[];
    };
  }) => void;
  members: Member[];
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const parse = async () => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      const res = await api(`/api/groups/${groupId}/expenses/nl`, {
        method: "POST",
        body: JSON.stringify({ input }),
      });
      toast({ title: "parsed — review & confirm" });
      onParsed(res);
    } catch (e) {
      toast({ title: "parse failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const examples = [
    "dinner was 42 bucks, split between me and sarah",
    "uber 18.50 paid by jay, split 3 ways",
    "groceries $67.20 from whole foods",
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-[var(--dim)] leading-relaxed">
          describe the expense in plain english. the ai extracts amount,
          category, and who to split with — you confirm before saving.
        </p>
      </div>
      <Field label="natural language input">
        <textarea
          className="w-full px-2 py-2 border bg-input text-sm min-h-20 resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. lunch was 38 dollars at chipotle, split between me and jay"
          autoFocus
        />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => setInput(ex)}
            className="text-[10px] px-2 py-1 border border-border text-[var(--dim)] hover:text-primary hover:border-primary transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[var(--dim)]">
        members: {members.map((m) => `@${m.username}`).join(" ")}
      </p>
      <Rule />
      <button
        onClick={parse}
        disabled={busy || !input.trim()}
        className="w-full px-3 py-2 border border-primary bg-primary/10 text-primary text-xs tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <Loader2 size={14} className="animate-spin" /> parsing...
          </>
        ) : (
          <>
            <Sparkles size={14} /> parse with ai
          </>
        )}
      </button>
    </div>
  );
}

interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
}

function OCRTab({
  groupId,
  members,
  currency,
  onConfirm,
}: {
  groupId: string;
  members: Member[];
  currency: string;
  onConfirm: (
    total: number,
    description: string,
    merchant: string,
    shares: Record<string, string>
  ) => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{
    merchant: string;
    total: number;
    items: ReceiptItem[];
  } | null>(null);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onFile = (f: File) => {
    if (f.size > 8 * 1024 * 1024) {
      toast({ title: "image too large (max 8mb)", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      scan(reader.result as string);
    };
    reader.readAsDataURL(f);
  };

  const scan = async (img: string) => {
    setBusy(true);
    setReceipt(null);
    try {
      const res = await api<{ receipt: {
        merchant: string;
        total: number;
        items: ReceiptItem[];
      } }>(`/api/groups/${groupId}/expenses/ocr`, {
        method: "POST",
        body: JSON.stringify({ image: img }),
      });
      setReceipt(res.receipt);
      toast({ title: `parsed ${res.receipt.items.length} items` });
    } catch (e) {
      toast({ title: "OCR failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const perMember = () => {
    const totals: Record<string, number> = {};
    members.forEach((m) => (totals[m.id] = 0));
    receipt?.items.forEach((item, idx) => {
      const uid = assignments[idx];
      if (uid && totals[uid] !== undefined) {
        totals[uid] += item.price;
      }
    });
    Object.keys(totals).forEach((k) => {
      totals[k] = Math.round(totals[k] * 100) / 100;
    });
    return totals;
  };

  const assignedTotal = Object.entries(perMember()).reduce(
    (s, [, v]) => s + v,
    0
  );

  const confirm = () => {
    if (!receipt) return;
    const shares: Record<string, string> = {};
    Object.entries(perMember()).forEach(([uid, v]) => {
      if (v > 0) shares[uid] = String(v);
    });
    onConfirm(
      Math.round(assignedTotal * 100) / 100,
      receipt.merchant || "receipt",
      receipt.merchant,
      shares
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Camera size={14} className="text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-[var(--dim)] leading-relaxed">
          snap or upload a receipt. ai extracts items, then tap who consumed
          each one — totals auto-split per person.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      {!image && (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full border border-dashed border-border py-8 flex flex-col items-center gap-2 text-[var(--dim)] hover:border-primary hover:text-primary transition-colors"
        >
          <Upload size={24} />
          <span className="text-xs tracking-widest uppercase">
            tap to upload receipt
          </span>
          <span className="text-[10px]">jpg, png · max 8mb</span>
        </button>
      )}

      {image && (
        <div className="flex items-center gap-2">
          <img
            src={image}
            alt="receipt"
            className="w-16 h-16 object-cover border border-border"
          />
          <button
            onClick={() => {
              setImage(null);
              setReceipt(null);
              setAssignments({});
            }}
            className="text-[10px] px-2 py-1 border border-border text-[var(--dim)] hover:text-primary hover:border-primary transition-colors tracking-widest uppercase"
          >
            change
          </button>
        </div>
      )}

      {busy && (
        <div className="flex items-center justify-center gap-2 py-4 text-primary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm cursor-blink">reading receipt</span>
        </div>
      )}

      {receipt && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm font-medium">{receipt.merchant || "receipt"}</span>
            <Tag tone="amber">{money(receipt.total, currency)}</Tag>
          </div>
          <div className="text-[10px] text-[var(--dim)] tracking-widest uppercase">
            tap a name for each item
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto terminal-scroll">
            {receipt.items.map((item, idx) => (
              <div
                key={idx}
                className="border border-border bg-muted/20 p-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">
                    {item.qty > 1 ? `${item.qty}× ` : ""}
                    {item.name}
                  </span>
                  <span className="text-[var(--amber)] shrink-0">
                    {money(item.price, currency)}
                  </span>
                </div>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() =>
                        setAssignments((p) => ({
                          ...p,
                          [idx]: p[idx] === m.id ? "" : m.id,
                        }))
                      }
                      className={`text-[10px] px-1.5 py-0.5 border transition-colors ${
                        assignments[idx] === m.id
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-[var(--dim)] hover:text-foreground"
                      }`}
                    >
                      @{m.username}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Rule label="per-person totals" />
          <div className="space-y-1">
            {members.map((m) => {
              const t = perMember()[m.id] || 0;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-[var(--dim)]">@{m.username}</span>
                  <span className={t > 0 ? "text-primary" : "text-[var(--dim)]"}>
                    {money(t, currency)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="text-[var(--dim)]">assigned total</span>
            <span className="text-[var(--amber)] glow-amber font-semibold">
              {money(assignedTotal, currency)}
            </span>
          </div>

          <Rule />
          <button
            onClick={confirm}
            disabled={assignedTotal <= 0}
            className="w-full px-3 py-2 border border-primary bg-primary/10 text-primary text-xs tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
          >
            review & confirm →
          </button>
        </motion.div>
      )}
    </div>
  );
}
