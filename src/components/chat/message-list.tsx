"use client";

import { useEffect, useRef } from "react";
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";
import { ToolInvocationBadge } from "./tool-invocation-badge";
import { cn } from "@/lib/utils";

type Props = { messages: UIMessage[]; isStreaming: boolean };

function renderPart(part: UIMessagePart<UIDataTypes, UITools>, i: number) {
  if (part.type === "text") {
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part.text}
      </span>
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
            {msg.parts.map((part, i) => renderPart(part, i))}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
