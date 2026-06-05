"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage, FeedbackType } from "@/types/chat";
import { Markdown } from "./Markdown";

type SseEvent =
  | { type: "meta"; sessionId: string }
  | { type: "token"; token: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

function getOrCreateSessionId() {
  if (typeof window === "undefined") return null;
  const key = "customer_service_session_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  return null;
}

function setSessionId(sessionId: string) {
  const key = "customer_service_session_id";
  window.localStorage.setItem(key, sessionId);
}

function isTypingPlaceholder(message: ChatMessage, typingId: string) {
  return message.id === typingId;
}

function parseHistoryMessages(data: unknown): ChatMessage[] {
  if (!data || typeof data !== "object") return [];
  const messages = (data as Record<string, unknown>).messages;
  if (!Array.isArray(messages)) return [];
  const result: ChatMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const mm = m as Record<string, unknown>;
    const id = typeof mm.id === "string" ? mm.id : null;
    const role =
      mm.role === "user" || mm.role === "assistant"
        ? (mm.role as "user" | "assistant")
        : null;
    const content = typeof mm.content === "string" ? mm.content : null;
    const createdAt =
      typeof mm.createdAt === "string" ? mm.createdAt : undefined;
    if (id && role && content !== null) {
      result.push({ id, role, content, createdAt });
    }
  }
  return result;
}

export function ChatWidget() {
  const isMobile = useIsMobile();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sessionId, setSessionIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const typingMessageId = useMemo(() => "__typing__", []);

  // 初次加载：从 localStorage 恢复 sessionId，并加载历史
  useEffect(() => {
    const sid = getOrCreateSessionId();
    if (sid) {
      setSessionIdState(sid);
      (async () => {
        setLoadingHistory(true);
        try {
          const r = await fetch(`/api/chat/history?sessionId=${sid}`);
          if (!r.ok) return;
          const data: unknown = await r.json();
          setMessages(parseHistoryMessages(data));
        } finally {
          setLoadingHistory(false);
        }
      })();
    }
  }, []);

  useEffect(() => {
    // 自动滚到底
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open, sending]);

  async function sendFeedback(messageId: string, type: FeedbackType) {
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, type }),
      });
    } catch {
      // 反馈失败不影响主流程
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: `temp-user-${crypto.randomUUID()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    // 添加一个“正在输入...”占位
    setMessages((prev) => [
      ...prev,
      { id: typingMessageId, role: "assistant", content: "正在输入..." },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId ?? undefined }),
      });

      if (!res.ok || !res.body) throw new Error("bad_response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let assistantText = "";
      let assistantMessageId: string | null = null;

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
          const payload = line.replace(/^data:\s*/, "");
          if (payload === "[DONE]") {
            break;
          }
          try {
            const evt = JSON.parse(payload) as SseEvent;
            if (evt.type === "meta") {
              setSessionIdState(evt.sessionId);
              setSessionId(evt.sessionId);
            } else if (evt.type === "token") {
              assistantText += evt.token;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === typingMessageId
                    ? { ...m, content: assistantText }
                    : m
                )
              );
            } else if (evt.type === "done") {
              assistantMessageId = evt.messageId;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === typingMessageId
                    ? { ...m, id: evt.messageId, content: assistantText }
                    : m
                )
              );
            } else if (evt.type === "error") {
              // error 时也把 typing 置为“非 typing”，让用户可以继续反馈/查看
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === typingMessageId
                    ? { ...m, id: `temp-assistant-${crypto.randomUUID()}`, content: evt.message }
                    : m
                )
              );
            }
          } catch {
            // ignore
          }
        }
      }

      // 如果没拿到 done，也把 typing 替换掉
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingMessageId
            ? { ...m, id: assistantMessageId ?? `temp-assistant-${crypto.randomUUID()}` }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingMessageId
            ? {
                ...m,
                id: `temp-assistant-${crypto.randomUUID()}`,
                content: "服务暂时繁忙，请稍后重试",
              }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  const containerClass = open
    ? isMobile
      ? "fixed inset-0 z-50"
      : "fixed bottom-6 right-6 z-50"
    : "";

  return (
    <>
      {/* 悬浮按钮 */}
      {!open && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="icon-lg"
            className="size-14 rounded-full shadow-lg"
            onClick={() => setOpen(true)}
            aria-label="打开智能客服"
            title="联系客服"
          >
            <MessageCircle className="size-6" />
          </Button>
        </div>
      )}

      {/* 聊天窗口 */}
      {open && (
        <div className={containerClass}>
          <Card
            className={[
              "overflow-hidden shadow-2xl",
              isMobile ? "h-full w-full rounded-none" : "h-[500px] w-[380px]",
            ].join(" ")}
          >
            <CardHeader className="border-b py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">智能客服</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="关闭"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="px-0">
              <ScrollArea className={isMobile ? "h-[calc(100vh-120px)]" : "h-[380px]"}>
                <div className="px-4 py-3 space-y-3" ref={scrollRef}>
                  {loadingHistory && (
                    <div className="text-xs text-muted-foreground">加载历史中…</div>
                  )}

                  {messages.length === 0 && !loadingHistory && (
                    <div className="text-xs text-muted-foreground">
                      你好，我是智能客服。请问有什么可以帮你？
                    </div>
                  )}

                  {messages.map((m) => {
                    const isUser = m.role === "user";
                    const isTyping = isTypingPlaceholder(m, typingMessageId);
                    return (
                      <div key={m.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
                        <div className="max-w-[85%]">
                          <div
                            className={[
                              "rounded-2xl px-3 py-2 text-sm leading-6 ring-1 ring-black/5",
                              isUser
                                ? "bg-blue-600 text-white"
                                : "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50",
                            ].join(" ")}
                          >
                            {isTyping ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="animate-pulse">正在输入...</span>
                              </span>
                            ) : (
                              <div
                                className={
                                  isUser
                                    ? "prose prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2"
                                    : "prose max-w-none dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2"
                                }
                              >
                                <Markdown content={m.content} />
                              </div>
                            )}
                          </div>

                          {/* AI 消息反馈 */}
                          {!isUser &&
                            !isTyping &&
                            !m.id.startsWith("temp-") && (
                            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7"
                                onClick={() => sendFeedback(m.id, "thumb_up")}
                                aria-label="点赞"
                              >
                                <ThumbsUp className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7"
                                onClick={() => sendFeedback(m.id, "thumb_down")}
                                aria-label="点踩"
                              >
                                <ThumbsDown className="size-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>

            <CardFooter className="gap-2">
              <form
                className="flex w-full items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入你的问题…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <Button type="submit" size="icon" disabled={sending} aria-label="发送">
                  <Send className="size-4" />
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
