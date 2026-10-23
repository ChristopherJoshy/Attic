"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, Group } from "@/lib/api";
import { useApp } from "@/store/app";
import { useToast } from "@/hooks/use-toast";
import { Panel, Tag, Rule } from "@/components/ascii";
import { money, shortDate } from "@/lib/ascii";
import { Plus, LogIn, Users, Receipt, ArrowRight } from "lucide-react";

export function Dashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const { openGroup } = useApp();
  const { toast } = useToast();

  const load = async () => {
    try {
      const res = await api<{ groups: Group[] }>("/api/groups");
      setGroups(res.groups);
    } catch (e) {
      toast({ title: "load failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-lg text-primary glow tracking-widest uppercase">
            {"// your groups"}
          </h2>
          <p className="text-xs text-[var(--dim)] mt-1">
            select a ledger to view expenses & balances
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoin(true)}
            className="px-3 py-2 border border-border text-xs tracking-widest uppercase hover:border-primary hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <LogIn size={14} /> join
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-2 border border-primary bg-primary/10 text-primary glow text-xs tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> new group
          </button>
        </div>
      </div>

      {loading ? (
        <Panel>
          <div className="text-[var(--dim)] text-sm cursor-blink">loading ledgers</div>
        </Panel>
      ) : groups.length === 0 ? (
        <Panel>
          <div className="text-center py-8">
            <p className="text-[var(--dim)] text-sm mb-2">no groups yet</p>
            <p className="text-xs text-[var(--dim)]">
              create a group or join one with an invite code
            </p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g, i) => (
            <motion.button
              key={g.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => openGroup(g)}
              className="ascii-box bg-card/40 text-left p-4 hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-primary glow font-semibold truncate">
                    {g.name}
                  </div>
                  {g.description && (
                    <div className="text-xs text-[var(--dim)] truncate mt-0.5">
                      {g.description}
                    </div>
                  )}
                </div>
                <ArrowRight
                  size={16}
                  className="text-[var(--dim)] group-hover:text-primary transition-colors shrink-0"
                />
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-[var(--dim)]">
                <span className="flex items-center gap-1">
                  <Users size={11} /> {g._count?.members ?? g.members.length}
                </span>
                <span className="flex items-center gap-1">
                  <Receipt size={11} /> {g._count?.expenses ?? 0}
                </span>
                <span>{money(0, g.currency)}</span>
                <span className="ml-auto">{shortDate(g.createdAt)}</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateModal
            onClose={() => setShowCreate(false)}
            onCreated={(g) => {
              setGroups((p) => [g, ...p]);
              setShowCreate(false);
              openGroup(g);
            }}
          />
        )}
        {showJoin && (
          <JoinModal
            onClose={() => setShowJoin(false)}
            onJoined={(g) => {
              setGroups((p) => [g, ...p.filter((x) => x.id !== g.id)]);
              setShowJoin(false);
              openGroup(g);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (g: Group) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ group: Group }>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name, description, currency }),
      });
      onCreated(res.group);
      toast({ title: "group created" });
    } catch (e) {
      toast({ title: "failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="// new group" onClose={onClose}>
      <div className="space-y-3">
        <Field label="name">
          <input
            className="w-full px-2 py-2 border bg-input text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. apartment 4b"
            autoFocus
          />
        </Field>
        <Field label="description">
          <input
            className="w-full px-2 py-2 border bg-input text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="optional"
          />
        </Field>
        <Field label="currency">
          <select
            className="w-full px-2 py-2 border bg-input text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
            onClick={create}
            disabled={busy || !name.trim()}
            className="flex-1 px-3 py-2 border border-primary bg-primary/10 text-primary text-xs tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
          >
            {busy ? "..." : "create"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function JoinModal({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (g: Group) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ group: Group }>(`/api/groups/join`, {
        method: "POST",
        body: JSON.stringify({ inviteCode: code.trim() }),
      });
      onJoined(res.group);
      toast({ title: "joined group" });
    } catch (e) {
      toast({ title: "failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="// join group" onClose={onClose}>
      <div className="space-y-3">
        <Field label="invite code">
          <input
            className="w-full px-2 py-2 border bg-input text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="paste invite code"
            autoFocus
          />
        </Field>
        <p className="text-[10px] text-[var(--dim)]">
          ask the group creator to share the invite code from the group panel
        </p>
        <Rule />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 border border-border text-xs tracking-widest uppercase hover:border-[var(--dim)] transition-colors"
          >
            cancel
          </button>
          <button
            onClick={join}
            disabled={busy || !code.trim()}
            className="flex-1 px-3 py-2 border border-primary bg-primary/10 text-primary text-xs tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
          >
            {busy ? "..." : "join"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-widest text-[var(--dim)] uppercase">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
      >
        <Panel title={title}>
          {children}
        </Panel>
      </motion.div>
    </motion.div>
  );
}
