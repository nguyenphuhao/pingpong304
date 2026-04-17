"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatLauncher } from "./chat-launcher";
import { ChatWindow } from "./chat-window";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { SuggestedPrompts } from "./suggested-prompts";

export function FloatingChatBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: { context: { currentPage: pathname } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { messages, sendMessage, status } = useChat({ transport });

  // Loại trừ admin
  if (pathname?.startsWith("/admin")) return null;

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <>
      <ChatLauncher onClick={() => setOpen(true)} />
      <ChatWindow open={open} onClose={() => setOpen(false)}>
        <MessageList messages={messages} isStreaming={isStreaming} />
        {messages.length === 0 ? (
          <SuggestedPrompts
            currentPage={pathname ?? null}
            onPick={(p) => sendMessage({ text: p })}
          />
        ) : null}
        <MessageInput
          onSend={(text) => sendMessage({ text })}
          disabled={isStreaming}
        />
      </ChatWindow>
    </>
  );
}
