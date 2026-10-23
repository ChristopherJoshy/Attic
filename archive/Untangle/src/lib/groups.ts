import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function assertMember(groupId: string) {
  const user = await requireUser();
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!membership) throw new Error("FORBIDDEN");
  return { user, membership };
}

export function handleError(e: unknown) {
  const msg = (e as Error).message;
  if (msg === "UNAUTHORIZED") return { status: 401, body: { error: "unauthorized" } };
  if (msg === "FORBIDDEN") return { status: 403, body: { error: "not a group member" } };
  if (msg === "NOT_FOUND") return { status: 404, body: { error: "not found" } };
  return { status: 500, body: { error: msg } };
}

export async function buildGroupContext(groupId: string) {
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: true } },
      expenses: {
        include: { splits: true, paidBy: true },
        orderBy: { createdAt: "desc" },
      },
      settlements: {
        include: { fromUser: true, toUser: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!group) throw new Error("NOT_FOUND");

  const members = group.members.map((m) => ({
    id: m.user.id,
    username: m.user.username,
    displayName: m.user.displayName,
  }));

  const expenses = group.expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    category: e.category,
    paidBy: e.paidBy.username,
    paidById: e.paidById,
    createdAt: e.createdAt,
    splits: e.splits.map((s) => ({
      userId: s.userId,
      amount: s.amount,
    })),
  }));

  const settlements = group.settlements.map((s) => ({
    from: s.fromUser.username,
    to: s.toUser.username,
    amount: s.amount,
  }));

  return {
    group,
    members,
    expenses,
    settlements,
    text: `Group: ${group.name} (currency: ${group.currency})
Members: ${members.map((m) => m.username).join(", ")}
Expenses (${expenses.length}):
${expenses
  .slice(0, 60)
  .map(
    (e) =>
      `- ${e.description} | ${e.amount} ${group.currency} | paid by ${e.paidBy} | ${new Date(e.createdAt).toISOString().slice(0, 10)}`
  )
  .join("\n")}
Settlements (${settlements.length}):
${settlements.map((s) => `- ${s.from} paid ${s.to} ${s.amount} ${group.currency}`).join("\n")}`,
  };
}
