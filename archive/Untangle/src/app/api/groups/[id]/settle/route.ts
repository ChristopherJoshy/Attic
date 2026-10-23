import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertMember, handleError } from "@/lib/groups";
import { computeBalances, suggestSettlements } from "@/lib/settle";
import { broadcast } from "@/lib/realtime";

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
    const suggestions = suggestSettlements(balances).map((s) => {
      const from = group.members.find((m) => m.user.id === s.fromUserId)?.user;
      const to = group.members.find((m) => m.user.id === s.toUserId)?.user;
      return {
        ...s,
        fromUsername: from?.username,
        fromDisplayName: from?.displayName,
        toUsername: to?.username,
        toDisplayName: to?.displayName,
      };
    });

    return NextResponse.json({ suggestions, currency: group.currency });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await assertMember(id);
    const { fromUserId, toUserId, amount } = await req.json();

    if (!fromUserId || !toUserId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "fromUserId, toUserId, amount required" },
        { status: 400 }
      );
    }

    const members = await db.groupMember.findMany({
      where: { groupId: id },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);
    if (!memberIds.includes(fromUserId) || !memberIds.includes(toUserId)) {
      return NextResponse.json(
        { error: "both users must be members" },
        { status: 400 }
      );
    }

    const settlement = await db.settlement.create({
      data: {
        groupId: id,
        fromUserId,
        toUserId,
        amount: Math.round(amount * 100) / 100,
        status: "completed",
      },
      include: {
        fromUser: { select: { id: true, username: true, displayName: true } },
        toUser: { select: { id: true, username: true, displayName: true } },
      },
    });

    await broadcast(id, "settlement:added", settlement);
    await broadcast(id, "balance:update", { groupId: id });

    return NextResponse.json({ settlement });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}
