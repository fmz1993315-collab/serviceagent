/**
 * 极简 SSE 工具：用于在 Next.js Route Handler 中逐段推送 token。
 * 约定：每条数据为 JSON { type, ... }，客户端按行解析。
 */

export function createSseStream() {
  const encoder = new TextEncoder();

  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
    cancel() {
      controllerRef = null;
    },
  });

  const send = (data: unknown) => {
    if (!controllerRef) return;
    controllerRef.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const close = () => {
    if (!controllerRef) return;
    controllerRef.enqueue(encoder.encode("data: [DONE]\n\n"));
    controllerRef.close();
    controllerRef = null;
  };

  const error = (message: string) => {
    send({ type: "error", message });
    close();
  };

  return { stream, send, close, error };
}

