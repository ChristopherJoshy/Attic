import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assertMember, handleError, buildGroupContext } from "@/lib/groups";
import { chatAboutGroup } from "@/lib/groq";
import { broadcast } from "@/lib/realtime";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await assertMember(id);
    const messages = await db.chatMessage.findMany({
      where: { groupId: id },
      include: { user: { select: { id: true, username: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return NextResponse.json({ messages });
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

    const { question } = await req.json();
    if (!question || !question.trim()) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const userMsg = await db.chatMessage.create({
      data: {
        groupId: id,
        userId: user.id,
        role: "user",
        content: question.trim(),
      },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    });
    await broadcast(id, "chat:message", userMsg);

    const { text } = await buildGroupContext(id);

    const history = await db.chatMessage.findMany({
      where: { groupId: id },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { role: true, content: true },
    });

    let answer: string;
    try {
      answer = await chatAboutGroup(question.trim(), text, history);
    } catch (e) {
      answer =
        "Sorry, I couldn't reach the AI service right now. (" +
        (e as Error).message +
        ")";
    }

    const aiMsg = await db.chatMessage.create({
      data: {
        groupId: id,
        userId: null,
        role: "assistant",
        content: answer,
      },
    });
    const aiPayload = {
      id: aiMsg.id,
      groupId: aiMsg.groupId,
      userId: aiMsg.userId,
      role: aiMsg.role,
      content: aiMsg.content,
      createdAt: aiMsg.createdAt,
      updatedAt: aiMsg.updatedAt,
      user: null,
    };
    await broadcast(id, "chat:message", aiPayload);

    return NextResponse.json({ userMessage: userMsg, message: aiPayload });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}
