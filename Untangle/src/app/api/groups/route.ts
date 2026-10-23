import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { handleError } from "@/lib/groups";

export async function GET() {
  try {
    const user = await requireUser();
    const groups = await db.group.findMany({
      where: { members: { some: { userId: user.id } } },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true } } } },
        _count: { select: { expenses: true, members: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ groups });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { name, description, currency } = await req.json();
    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: "group name required (min 2 chars)" },
        { status: 400 }
      );
    }
    const group = await db.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        currency: currency || "USD",
        createdBy: user.id,
        members: {
          create: { userId: user.id },
        },
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true } } } },
      },
    });
    return NextResponse.json({ group });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}

export { getCurrentUser };
