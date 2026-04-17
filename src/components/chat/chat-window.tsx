"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function ChatWindow({ open, onClose, children }: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trợ lý AI"
      className={cn(
        "fixed z-50",
        "inset-0 sm:inset-auto sm:bottom-20 sm:right-4",
        "sm:h-[600px] sm:w-[400px]",
        "bg-background sm:rounded-xl sm:border sm:shadow-2xl",
        "flex flex-col overflow-hidden",
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">Trợ lý giải đấu</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="rounded-md p-1 hover:bg-muted"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>
      {children}
    </div>
  );
}
