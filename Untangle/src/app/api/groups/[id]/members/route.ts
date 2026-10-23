import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { inviteCode } = await req.json();
    if (!inviteCode) {
      return NextResponse.json({ error: "invite code required" }, { status: 400 });
    }
    const group = await db.group.findUnique({
      where: { inviteCode: inviteCode.trim() },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, displayName: true } } },
        },
      },
    });
    if (!group) {
      return NextResponse.json({ error: "invalid invite code" }, { status: 404 });
    }
    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
    });
    if (existing) {
      return NextResponse.json({ group, alreadyMember: true });
    }
    await db.groupMember.create({
      data: { groupId: group.id, userId: user.id },
    });
    const updated = await db.group.findUnique({
      where: { id: group.id },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, displayName: true } } },
        },
      },
    });
    return NextResponse.json({ group: updated, alreadyMember: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
