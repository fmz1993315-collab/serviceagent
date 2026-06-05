"use client"

import * as React from "react";

/**
 * Tooltip（降级版）：
 * - 生产环境建议接入完整的 tooltip 组件（例如 Radix / Base UI）
 * - 这里为了避免额外 headless 依赖导致的编译/解析问题，提供最小可用实现
 */

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function TooltipTrigger({ children, ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="tooltip-trigger" {...props}>
      {children}
    </span>
  );
}

function TooltipContent({ children }: { children: React.ReactNode }) {
  // 不渲染浮层（仅保留结构，避免引用处改动）
  return <span className="sr-only">{children}</span>;
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
