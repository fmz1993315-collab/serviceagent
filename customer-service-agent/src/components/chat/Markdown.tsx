"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * Markdown 渲染组件：支持 GFM、代码块高亮（highlight.js）
 */
export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        a: (props) => (
          <a
            {...props}
            className="underline underline-offset-2 text-blue-600 hover:text-blue-700"
            target={props.href?.startsWith("http") ? "_blank" : undefined}
            rel={props.href?.startsWith("http") ? "noreferrer" : undefined}
          />
        ),
        code: ({ className, children, ...props }) => (
          <code
            className={[
              "rounded bg-zinc-100 px-1 py-0.5 text-[0.85em] dark:bg-zinc-800",
              className ?? "",
            ].join(" ")}
            {...props}
          >
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-2 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-800">
            {children}
          </pre>
        ),
        ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

