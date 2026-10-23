import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password, displayName } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password required" },
        { status: 400 }
      );
    }
    if (username.length < 3 || username.length > 24) {
      return NextResponse.json(
        { error: "username must be 3-24 chars" },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { error: "password must be at least 4 chars" },
        { status: 400 }
      );
    }
    const existing = await db.user.findUnique({
      where: { username: username.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "username taken" },
        { status: 409 }
      );
    }
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        username: username.toLowerCase(),
        passwordHash,
        displayName: displayName || username,
      },
      select: { id: true, username: true, displayName: true },
    });
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
