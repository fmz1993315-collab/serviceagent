import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSseStream } from "@/lib/sse";
import { searchKnowledgeBase } from "@/lib/knowledge";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "你是一位专业的客服助手。回答简洁友好，优先使用知识库内容。如果知识库没有答案，诚实告知并记录。";

type ReqBody = { message: string; sessionId?: string };

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function POST(req: Request) {
  const { stream, send, close, error } = createSseStream();

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.message || typeof body.message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const sessionId =
      body.sessionId ??
      (await prisma.chatSession.create({ data: {} }).then((s) => s.id));

    // 存 user 消息
    await prisma.chatMessage.create({
      data: { sessionId, role: "user", content: body.message },
    });

    // 先做知识库匹配
    const kbHit = await searchKnowledgeBase(body.message);
    const kbContext = kbHit
      ? `\n\n【知识库命中】\nQ: ${kbHit.question}\nA: ${kbHit.answer}\n\n请将以上内容自然融入回答（不要生硬照搬标题）。`
      : `\n\n【知识库未命中】\n如果没有可靠答案，请直接说明“知识库暂无相关信息”，并给出可行建议（例如让用户补充信息/转人工）。`;

    // 取最近历史（最多 20 条）
    const history = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    // 立即告诉前端 sessionId
    send({ type: "meta", sessionId });

    // 异步开始请求 DeepSeek 并推流
    (async () => {
      try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
          throw new Error("DEEPSEEK_API_KEY is missing");
        }

        const messages = [
          { role: "system", content: SYSTEM_PROMPT + kbContext },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ];

        const resp = await withTimeout(
          fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              stream: true,
              messages,
              temperature: 0.2,
            }),
          }),
          30_000
        );

        if (!resp.ok || !resp.body) {
          throw new Error(`DeepSeek API failed: ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();

        let assistantText = "";

        // SSE from DeepSeek: lines like "data: {...}\n\n" ending with "data: [DONE]"
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const dataStr = line.replace(/^data:\s*/, "");
            if (dataStr === "[DONE]") {
              // 保存 assistant 消息
              const saved = await prisma.chatMessage.create({
                data: { sessionId, role: "assistant", content: assistantText },
              });
              send({ type: "done", messageId: saved.id });
              close();
              return;
            }

            try {
              const json = JSON.parse(dataStr);
              const delta: string | undefined =
                json?.choices?.[0]?.delta?.content ??
                json?.choices?.[0]?.message?.content;
              if (delta) {
                assistantText += delta;
                send({ type: "token", token: delta });
              }
            } catch {
              // 忽略解析失败的 chunk
            }
          }
        }

        // 若未正常收到 [DONE]，也要落库并关闭
        const saved = await prisma.chatMessage.create({
          data: { sessionId, role: "assistant", content: assistantText },
        });
        send({ type: "done", messageId: saved.id });
        close();
      } catch (e) {
        const msg =
          e instanceof Error && e.message === "timeout"
            ? "服务暂时繁忙，请稍后重试"
            : "服务暂时繁忙，请稍后重试";
        error(msg);
      }
    })();

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "服务暂时繁忙，请稍后重试" },
      { status: 500 }
    );
  }
}

