import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password required" },
        { status: 400 }
      );
    }
    const user = await db.user.findUnique({
      where: { username: username.toLowerCase() },
    });
    if (!user) {
      return NextResponse.json(
        { error: "invalid credentials" },
        { status: 401 }
      );
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "invalid credentials" },
        { status: 401 }
      );
    }
    await createSession(user.id);
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
