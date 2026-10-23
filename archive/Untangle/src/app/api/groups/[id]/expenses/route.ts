import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertMember, handleError } from "@/lib/groups";
import { broadcast } from "@/lib/realtime";
import { round2 } from "@/lib/settle";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await assertMember(id);
    const expenses = await db.expense.findMany({
      where: { groupId: id },
      include: {
        paidBy: { select: { id: true, username: true, displayName: true } },
        splits: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ expenses });
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
    const { user } = await assertMember(id);

    const body = await req.json();
    const {
      amount,
      description,
      category = "other",
      splitType = "equal",
      paidById = user.id,
      splits: requestedSplits,
      note,
      source = "manual",
    } = body;

    if (!amount || amount <= 0 || !description) {
      return NextResponse.json(
        { error: "amount and description required" },
        { status: 400 }
      );
    }

    const members = await db.groupMember.findMany({
      where: { groupId: id },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);

    const splitUserIds: string[] =
      requestedSplits && requestedSplits.length > 0
        ? requestedSplits.map((s: { userId: string }) => s.userId)
        : memberIds;

    const validSplits = splitUserIds.filter((uid) => memberIds.includes(uid));
    if (validSplits.length === 0) {
      return NextResponse.json(
        { error: "must split with at least one member" },
        { status: 400 }
      );
    }

    let splitsData: { userId: string; amount: number }[];
    if (splitType === "custom" && requestedSplits) {
      splitsData = requestedSplits
        .filter((s: { userId: string; amount: number }) =>
          memberIds.includes(s.userId)
        )
        .map((s: { userId: string; amount: number }) => ({
          userId: s.userId,
          amount: round2(Number(s.amount)),
        }));
    } else {
      const share = round2(amount / validSplits.length);
      splitsData = validSplits.map((uid) => ({ userId: uid, amount: share }));
      const diff = round2(amount - share * validSplits.length);
      if (Math.abs(diff) > 0 && validSplits.length > 0) {
        splitsData[validSplits.length - 1].amount = round2(
          splitsData[validSplits.length - 1].amount + diff
        );
      }
    }

    if (!memberIds.includes(paidById)) {
      return NextResponse.json(
        { error: "payer must be a member" },
        { status: 400 }
      );
    }

    const expense = await db.expense.create({
      data: {
        groupId: id,
        paidById,
        amount: round2(amount),
        description: description.trim(),
        category,
        splitType,
        note: note || null,
        source,
        splits: { create: splitsData },
      },
      include: {
        paidBy: { select: { id: true, username: true, displayName: true } },
        splits: true,
      },
    });

    await broadcast(id, "expense:added", expense);
    await broadcast(id, "balance:update", { groupId: id });

    return NextResponse.json({ expense });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}
