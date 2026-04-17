"use client";

import { useEffect, useRef } from "react";
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolInvocationBadge } from "./tool-invocation-badge";
import { cn } from "@/lib/utils";

type Props = { messages: UIMessage[]; isStreaming: boolean };

const markdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 last:mb-0 list-disc pl-5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 list-decimal pl-5 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="mb-2 text-base font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-black/10 px-1 py-0.5 text-[0.9em] font-mono">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded bg-black/10 p-2 text-xs">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-current/20 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-current/20 px-2 py-1">{children}</td>
  ),
  hr: () => <hr className="my-2 border-current/20" />,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-current/40 pl-3 italic opacity-90">
      {children}
    </blockquote>
  ),
};

function renderPart(
  part: UIMessagePart<UIDataTypes, UITools>,
  i: number,
  role: UIMessage["role"],
) {
  if (part.type === "text") {
    if (role === "user") {
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part.text}
        </span>
      );
    }
    return (
      <div key={i}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {part.text}
        </ReactMarkdown>
      </div>
    );
  }
  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
    const toolName =
      part.type === "dynamic-tool"
        ? (part as { toolName: string }).toolName
        : part.type.slice("tool-".length);
    const state =
      "state" in part && part.state === "output-available" ? "done" : "running";
    return (
      <div key={i} className="my-1">
        <ToolInvocationBadge toolName={toolName} state={state} />
      </div>
    );
  }
  return null;
}

export function MessageList({ messages, isStreaming }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Hỏi bất kỳ điều gì về giải đấu
        </p>
      ) : null}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "flex",
            msg.role === "user" ? "justify-end" : "justify-start",
          )}
        >
          <div
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
              msg.role === "user" ? "bg-emerald-600 text-white" : "bg-muted",
            )}
          >
            {msg.parts.map((part, i) => renderPart(part, i, msg.role))}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
