import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ReqBody = { messageId: string; type: "thumb_up" | "thumb_down" };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.messageId || !body?.type) {
      return NextResponse.json(
        { error: "messageId and type are required" },
        { status: 400 }
      );
    }

    // 简单记录（允许一条消息多次反馈，便于统计）
    await prisma.feedback.create({
      data: {
        messageId: body.messageId,
        type: body.type,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

