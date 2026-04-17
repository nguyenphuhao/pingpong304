"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  hasUnread?: boolean;
  className?: string;
};

export function ChatLauncher({ onClick, hasUnread, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Mở trợ lý AI"
      className={cn(
        "fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full",
        "bg-emerald-600 text-white shadow-lg",
        "flex items-center justify-center",
        "hover:bg-emerald-700 active:scale-95 transition",
        className,
      )}
    >
      <MessageCircle className="h-6 w-6" aria-hidden />
      {hasUnread ? (
        <span
          className="absolute top-1 right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white"
          aria-label="Có tin nhắn mới"
        />
      ) : null}
    </button>
  );
}
