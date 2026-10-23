export interface BalanceEntry {
  userId: string;
  paid: number;
  owes: number;
  net: number;
}

export interface SettlementSuggestion {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeBalances(
  expenses: {
    paidById: string;
    amount: number;
    splits: { userId: string; amount: number }[];
  }[],
  settlements: { fromUserId: string; toUserId: string; amount: number }[],
  memberIds: string[]
): BalanceEntry[] {
  const map = new Map<string, BalanceEntry>();
  for (const id of memberIds) {
    map.set(id, { userId: id, paid: 0, owes: 0, net: 0 });
  }
  for (const e of expenses) {
    const payer = map.get(e.paidById);
    if (payer) payer.paid += e.amount;
    for (const s of e.splits) {
      const owed = map.get(s.userId);
      if (owed) owed.owes += s.amount;
    }
  }
  for (const st of settlements) {
    const from = map.get(st.fromUserId);
    const to = map.get(st.toUserId);
    if (from) from.owes -= st.amount;
    if (to) to.paid -= st.amount;
  }
  for (const v of map.values()) {
    v.paid = round2(v.paid);
    v.owes = round2(v.owes);
    v.net = round2(v.paid - v.owes);
  }
  return Array.from(map.values());
}

export function suggestSettlements(
  balances: BalanceEntry[]
): SettlementSuggestion[] {
  const creditors = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ userId: b.userId, amount: round2(b.net) }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ userId: b.userId, amount: round2(-b.net) }))
    .sort((a, b) => b.amount - a.amount);

  const result: SettlementSuggestion[] = [];
  let i = 0;
  let j = 0;
  const EPS = 0.005;

  while (i < debtors.length && j < creditors.length) {
    const pay = round2(Math.min(debtors[i].amount, creditors[j].amount));
    if (pay > EPS) {
      result.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amount: pay,
      });
      debtors[i].amount = round2(debtors[i].amount - pay);
      creditors[j].amount = round2(creditors[j].amount - pay);
    }
    if (debtors[i].amount <= EPS) i++;
    if (creditors[j].amount <= EPS) j++;
  }
  return result;
}
