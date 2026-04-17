"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onSend: (text: string) => void;
  disabled: boolean;
};

const MAX_LEN = 500;

export function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <form
      className="border-t p-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Hỏi về cặp, bảng điểm, xác suất..."
        rows={1}
        maxLength={MAX_LEN}
        disabled={disabled}
        className={cn(
          "flex-1 resize-none rounded-lg border px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-emerald-500",
        )}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Gửi"
        className={cn(
          "rounded-lg bg-emerald-600 px-3 text-white",
          "disabled:opacity-50 hover:bg-emerald-700",
        )}
      >
        <Send className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
