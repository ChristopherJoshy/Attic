import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertMember, handleError } from "@/lib/groups";
import { computeBalances } from "@/lib/settle";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await assertMember(id);

    const group = await db.group.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true } } } },
        expenses: { include: { splits: true } },
        settlements: true,
      },
    });
    if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });

    const memberIds = group.members.map((m) => m.user.id);
    const balances = computeBalances(
      group.expenses.map((e) => ({
        paidById: e.paidById,
        amount: e.amount,
        splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
      })),
      group.settlements.map((s) => ({
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        amount: s.amount,
      })),
      memberIds
    );

    const enriched = balances.map((b) => {
      const m = group.members.find((mm) => mm.user.id === b.userId);
      return {
        ...b,
        username: m?.user.username,
        displayName: m?.user.displayName,
      };
    });

    return NextResponse.json({ balances: enriched, currency: group.currency });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}
