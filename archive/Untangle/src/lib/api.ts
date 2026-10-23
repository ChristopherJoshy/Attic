export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.error || `request failed (${res.status})`);
  }
  return data as T;
}

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string | null;
}

export interface Member {
  id: string;
  username: string;
  displayName: string | null;
}

export interface Expense {
  id: string;
  groupId: string;
  paidById: string;
  paidBy: Member;
  amount: number;
  description: string;
  category: string;
  splitType: string;
  note: string | null;
  source: string;
  createdAt: string;
  splits: { id: string; userId: string; amount: number }[];
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  fromUser: Member;
  toUserId: string;
  toUser: Member;
  amount: number;
  status: string;
  createdAt: string;
}

export interface GroupMemberRow {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: string;
  user: Member;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  createdBy: string;
  currency: string;
  createdAt: string;
  members: GroupMemberRow[];
  expenses?: Expense[];
  settlements?: Settlement[];
  _count?: { expenses: number; members: number };
}

export interface Balance {
  userId: string;
  username: string;
  displayName: string | null;
  paid: number;
  owes: number;
  net: number;
}

export interface ChatMsg {
  id: string;
  groupId: string;
  userId: string | null;
  role: string;
  content: string;
  createdAt: string;
  user: Member | null;
}

export interface Suggestion {
  fromUserId: string;
  fromUsername: string;
  fromDisplayName: string | null;
  toUserId: string;
  toUsername: string;
  toDisplayName: string | null;
  amount: number;
}
