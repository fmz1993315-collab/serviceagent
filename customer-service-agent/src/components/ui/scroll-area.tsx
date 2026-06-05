"use client"

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * ScrollArea（简化版）：用原生 overflow 实现滚动，满足聊天窗口需求。
 * 说明：这里保留 shadcn 的组件 API 形式，但不依赖额外 headless 包，避免构建/解析问题。
 */
function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scroll-area"
      className={cn("relative overflow-auto", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function ScrollBar() {
  return null;
}

export { ScrollArea, ScrollBar };
