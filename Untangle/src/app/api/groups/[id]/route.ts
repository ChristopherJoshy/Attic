import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertMember, handleError } from "@/lib/groups";

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
        members: {
          include: { user: { select: { id: true, username: true, displayName: true } } },
          orderBy: { joinedAt: "asc" },
        },
        expenses: {
          include: {
            paidBy: { select: { id: true, username: true, displayName: true } },
            splits: true,
          },
          orderBy: { createdAt: "desc" },
        },
        settlements: {
          include: {
            fromUser: { select: { id: true, username: true, displayName: true } },
            toUser: { select: { id: true, username: true, displayName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ group });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}
