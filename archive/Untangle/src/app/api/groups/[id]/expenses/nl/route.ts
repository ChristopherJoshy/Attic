import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertMember, handleError } from "@/lib/groups";
import { parseExpenseText, ParsedExpense } from "@/lib/groq";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await assertMember(id);

    const { input } = await req.json();
    if (!input || !input.trim()) {
      return NextResponse.json(
        { error: "input required" },
        { status: 400 }
      );
    }

    const members = await db.groupMember.findMany({
      where: { groupId: id },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    });
    const memberNames = members.map(
      (m) => m.user.displayName || m.user.username
    );

    let parsed: ParsedExpense;
    try {
      parsed = await parseExpenseText(input, memberNames);
    } catch (e) {
      return NextResponse.json(
        { error: "AI parse failed: " + (e as Error).message },
        { status: 502 }
      );
    }

    const nameToId = new Map(
      members.map((m) => [m.user.displayName || m.user.username, m.user.id])
    );
    const memberIds = members.map((m) => m.user.id);
    const splitIds = (parsed.splitBetween || [])
      .map((n) => nameToId.get(n))
      .filter((uid): uid is string => !!uid && memberIds.includes(uid));
    const finalSplitIds = splitIds.length > 0 ? splitIds : memberIds;

    return NextResponse.json({
      parsed,
      resolved: {
        amount: parsed.amount,
        description: parsed.description,
        category: parsed.category,
        splitType: parsed.splitType || "equal",
        note: parsed.note || parsed.merchant || input.slice(0, 120),
        paidById: members[0]?.user.id,
        splitUserIds: finalSplitIds,
        customShares:
          parsed.splitType === "custom" && parsed.customShares
            ? parsed.customShares
                .map((s) => ({
                  userId: nameToId.get(s.name),
                  amount: s.amount,
                }))
                .filter(
                  (s): s is { userId: string; amount: number } =>
                    !!s.userId && memberIds.includes(s.userId)
                )
            : undefined,
      },
    });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}
