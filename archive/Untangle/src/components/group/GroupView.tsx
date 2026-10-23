"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, Group, Expense, Balance, Settlement, Suggestion } from "@/lib/api";
import { useApp } from "@/store/app";
import { useToast } from "@/hooks/use-toast";
import { getSocket, joinGroupRoom, leaveGroupRoom } from "@/lib/socket";
import { Panel, Tag, Rule } from "@/components/ascii";
import { ExpenseList } from "./ExpenseList";
import { BalanceBoard } from "./BalanceBoard";
import { SettlePanel } from "./SettlePanel";
import { ChatPanel } from "./ChatPanel";
import { AddExpenseSheet } from "./AddExpenseSheet";
import { ArrowLeft, Plus, Wifi, WifiOff, Copy, Check } from "lucide-react";

type Tab = "ledger" | "balances" | "settle" | "chat";

export function GroupView({ groupId }: { groupId: string }) {
  const { backToDashboard, currentGroup } = useApp();
  const [group, setGroup] = useState<Group | null>(currentGroup);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tab, setTab] = useState<Tab>("ledger");
  const [showAdd, setShowAdd] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const loadedRef = useRef(false);

  const loadGroup = useCallback(async () => {
    try {
      const res = await api<{ group: Group }>(`/api/groups/${groupId}`);
      setGroup(res.group);
    } catch (e) {
      toast({ title: "load failed", description: (e as Error).message, variant: "destructive" });
    }
  }, [groupId, toast]);

  const loadBalances = useCallback(async () => {
    try {
      const res = await api<{ balances: Balance[]; currency: string }>(
        `/api/groups/${groupId}/balances`
      );
      setBalances(res.balances);
    } catch {
    }
  }, [groupId]);

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await api<{ suggestions: Suggestion[]; currency: string }>(
        `/api/groups/${groupId}/settle`
      );
      setSuggestions(res.suggestions);
    } catch {
    }
  }, [groupId]);

  const reloadAll = useCallback(() => {
    loadGroup();
    loadBalances();
    loadSuggestions();
  }, [loadGroup, loadBalances, loadSuggestions]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGroup();
    loadBalances();
    loadSuggestions();
    joinGroupRoom(groupId);
    const s = getSocket();
    const onConn = () => setConnected(true);
    const onDisc = () => setConnected(false);
    s.on("connect", onConn);
    s.on("disconnect", onDisc);
    setConnected(s.connected);

    const onExpense = (e: Expense) => {
      setGroup((g) =>
        g ? { ...g, expenses: [e, ...(g.expenses || [])] } : g
      );
      loadBalances();
      loadSuggestions();
    };
    const onSettle = (st: Settlement) => {
      setGroup((g) =>
        g ? { ...g, settlements: [st, ...(g.settlements || [])] } : g
      );
      loadBalances();
      loadSuggestions();
    };
    const onBalanceUpdate = () => {
      loadBalances();
      loadSuggestions();
    };
    s.on("expense:added", onExpense);
    s.on("settlement:added", onSettle);
    s.on("balance:update", onBalanceUpdate);

    return () => {
      s.off("connect", onConn);
      s.off("disconnect", onDisc);
      s.off("expense:added", onExpense);
      s.off("settlement:added", onSettle);
      s.off("balance:update", onBalanceUpdate);
      leaveGroupRoom(groupId);
    };
  }, [groupId, loadBalances, loadSuggestions, loadGroup]);

  const copyInvite = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast({ title: "invite code copied" });
  };

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Panel>
          <div className="text-[var(--dim)] text-sm cursor-blink">loading group</div>
        </Panel>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "ledger", label: "ledger", badge: group.expenses?.length || 0 },
    { id: "balances", label: "balances" },
    { id: "settle", label: "settle", badge: suggestions.length || undefined },
    { id: "chat", label: "ai chat" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 w-full">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={backToDashboard}
          className="p-2 border border-border hover:border-primary hover:text-primary transition-colors"
          aria-label="back"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg text-primary glow font-semibold truncate">
            {group.name}
          </h1>
          {group.description && (
            <p className="text-xs text-[var(--dim)] truncate">{group.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          {connected ? (
            <span className="flex items-center gap-1 text-primary">
              <Wifi size={12} /> live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-destructive">
              <WifiOff size={12} /> off
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex border border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs tracking-widest uppercase border-r border-border last:border-r-0 transition-colors ${
                tab === t.id
                  ? "bg-primary/15 text-primary glow"
                  : "text-[var(--dim)] hover:text-foreground hover:bg-muted"
              }`}
            >
              {t.label}
              {t.badge !== undefined && (
                <span className="ml-1.5 text-[10px] opacity-70">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto px-3 py-2 border border-primary bg-primary/10 text-primary glow text-xs tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} /> add expense
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "ledger" && (
            <ExpenseList expenses={group.expenses || []} currency={group.currency} />
          )}
          {tab === "balances" && (
            <BalanceBoard balances={balances} currency={group.currency} />
          )}
          {tab === "settle" && (
            <SettlePanel
              groupId={groupId}
              suggestions={suggestions}
              currency={group.currency}
              onSettled={reloadAll}
            />
          )}
          {tab === "chat" && <ChatPanel groupId={groupId} />}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6">
        <Rule label="group info" />
        <div className="flex items-center justify-between gap-2 flex-wrap mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Tag tone="dim">{group.currency}</Tag>
            <Tag tone="dim">{group.members.length} members</Tag>
            {group.members.slice(0, 4).map((m) => (
              <span key={m.id} className="text-[10px] text-[var(--dim)]">
                @{m.user.username}
              </span>
            ))}
          </div>
          <button
            onClick={copyInvite}
            className="flex items-center gap-1.5 text-[10px] text-[var(--dim)] hover:text-primary transition-colors border border-border px-2 py-1"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            invite: {group.inviteCode.slice(0, 8)}...
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <AddExpenseSheet
            groupId={groupId}
            members={group.members.map((m) => ({
              id: m.user.id,
              username: m.user.username,
              displayName: m.user.displayName,
            }))}
            currency={group.currency}
            onClose={() => setShowAdd(false)}
            onAdded={reloadAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
