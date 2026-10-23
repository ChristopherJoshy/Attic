import { NextResponse } from "next/server";
import { assertMember, handleError } from "@/lib/groups";
import { parseReceiptImage } from "@/lib/groq";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await assertMember(id);

    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "image (base64 data url) required" },
        { status: 400 }
      );
    }

    let parsed;
    try {
      parsed = await parseReceiptImage(image);
    } catch (e) {
      return NextResponse.json(
        { error: "OCR failed: " + (e as Error).message },
        { status: 502 }
      );
    }

    return NextResponse.json({ receipt: parsed });
  } catch (e) {
    const { status, body } = handleError(e);
    return NextResponse.json(body, { status });
  }
}
