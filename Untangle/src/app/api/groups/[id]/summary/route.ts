import { NextResponse } from "next/server";
import { assertMember, handleError, buildGroupContext } from "@/lib/groups";
import { monthlySummary } from "@/lib/groq";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await assertMember(id);
    const { text, group } = await buildGroupContext(id);

    let summary: string;
    try {
      summary = await monthlySummary(text);
    } catch (e) {
      summary =
        "Could not generate summary right now. (" +
        (e as Error).message +
        ")";
    }

    return NextResponse.json({ summary, currency: group.currency });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}
