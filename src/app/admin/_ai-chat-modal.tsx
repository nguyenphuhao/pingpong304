"use client";

import { useState, useRef } from "react";
import { Sparkles, ImagePlus, Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { VoiceInputButton } from "./_voice-input-button";
import {
  parseMatchWithAI,
  type AiSingleMatchContext,
  type AiParseResponse,
} from "./_match-actions";
import type { SetScore } from "@/lib/schemas/match";

type Message =
  | { role: "user"; text?: string; imageUrl?: string }
  | { role: "ai"; response: AiParseResponse };

export function AiSingleMatchButton({
  matchContext,
  onApply,
  disabled,
}: {
  matchContext: AiSingleMatchContext;
  onApply: (sets: SetScore[], subMatches?: Array<{ label: string; sets: SetScore[] }>) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMessages([]);
    setText("");
    setLoading(false);
    setImageBase64(null);
    setImagePreview(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 4MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.replace(/^data:image\/\w+;base64,/, ""));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const send = async () => {
    const inputText = text.trim() || undefined;
    const inputImage = imageBase64 ?? undefined;
    if (!inputText && !inputImage) return;

    const userMsg: Message = {
      role: "user",
      text: inputText,
      imageUrl: imagePreview ?? undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setText("");
    setImageBase64(null);
    setImagePreview(null);
    setLoading(true);

    try {
      const response = await parseMatchWithAI({
        text: inputText,
        imageBase64: inputImage,
        match: matchContext,
      });
      setMessages((prev) => [...prev, { role: "ai", response }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi kết nối AI");
    } finally {
      setLoading(false);
    }
  };

  const lastAiResponse = [...messages]
    .reverse()
    .find((m): m is Extract<Message, { role: "ai" }> => m.role === "ai");

  const canApply =
    lastAiResponse?.response.status === "ok" &&
    lastAiResponse.response.mode === "single";

  const handleApply = () => {
    if (!canApply) return;
    const res = lastAiResponse!.response;
    if (res.status !== "ok" || res.mode !== "single") return;
    onApply(res.result.sets, res.result.subMatches);
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="AI nhập kết quả"
          />
        }
      >
        <Sparkles className="size-4" />
      </DialogTrigger>
      <DialogContent className="flex max-h-[80dvh] flex-col">
        <DialogHeader>
          <DialogTitle>AI nhập kết quả</DialogTitle>
          <DialogDescription>
            {matchContext.sideA} vs {matchContext.sideB}
          </DialogDescription>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="flex flex-col items-end gap-1">
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Input"
                      className="max-h-40 rounded-lg border"
                    />
                  )}
                  {msg.text && (
                    <div className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                      {msg.text}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <AiResponseDisplay response={msg.response} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang xử lý...
            </div>
          )}
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="relative mx-1 mb-1">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-20 rounded border"
            />
            <button
              type="button"
              onClick={() => {
                setImageBase64(null);
                setImagePreview(null);
              }}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
              aria-label="Xoá ảnh"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-center gap-1.5 border-t pt-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            aria-label="Chọn ảnh"
          >
            <ImagePlus className="size-4" />
          </Button>
          <VoiceInputButton
            onResult={(t) => setText((prev) => prev + t)}
            onInterim={(t) => setText(t)}
            disabled={loading}
          />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Nhập kết quả hoặc gửi ảnh..."
            className="h-8 flex-1 text-sm"
            disabled={loading}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={send}
            disabled={loading || (!text.trim() && !imageBase64)}
            aria-label="Gửi"
          >
            <Send className="size-4" />
          </Button>
        </div>

        {/* Apply button */}
        {canApply && (
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" size="sm" onClick={handleApply}>
              Áp dụng kết quả
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AiResponseDisplay({
  response,
  selected,
  onToggle,
}: {
  response: AiParseResponse;
  selected?: Set<string>;
  onToggle?: (matchId: string) => void;
}) {
  if (response.status === "rejected") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Không thể đọc kết quả
        </p>
        <p className="text-muted-foreground">{response.reason}</p>
      </div>
    );
  }

  if (response.mode === "single") {
    return (
      <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
        <p className="mb-1 font-medium">Kết quả:</p>
        <div className="space-y-0.5 tabular-nums">
          {response.result.sets.map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground">Set {i + 1}:</span>
              <span className="font-semibold">
                {s.a} – {s.b}
              </span>
            </div>
          ))}
        </div>
        {response.result.subMatches && (
          <div className="mt-2 space-y-1.5">
            {response.result.subMatches.map((sub, i) => (
              <div key={i}>
                <p className="font-medium">{sub.label}:</p>
                <div className="ml-2 space-y-0.5 tabular-nums">
                  {sub.sets.map((s, j) => (
                    <div key={j} className="flex gap-2">
                      <span className="text-muted-foreground">Set {j + 1}:</span>
                      <span className="font-semibold">
                        {s.a} – {s.b}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Batch mode — will be implemented in Task 8
  if (response.mode === "batch") {
    return (
      <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
        <p className="mb-2 font-medium">
          {response.parsed.length} trận được nhận diện:
        </p>
        <div className="space-y-1.5">
          {response.parsed.map((p) => (
            <label
              key={p.matchId}
              className="flex items-start gap-2 rounded p-1 hover:bg-background/60"
            >
              {selected && onToggle && (
                <input
                  type="checkbox"
                  checked={selected.has(p.matchId)}
                  onChange={() => onToggle(p.matchId)}
                  className="mt-0.5"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">
                    {p.sideA} vs {p.sideB}
                  </span>
                  {p.alreadyHasResult && (
                    <span className="rounded bg-amber-500/15 px-1 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                      đã có
                    </span>
                  )}
                </div>
                <div className="tabular-nums text-muted-foreground">
                  {p.result.sets.map((s, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      {s.a}–{s.b}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>
        {response.unmatched && response.unmatched.length > 0 && (
          <div className="mt-2 border-t pt-1.5">
            <p className="text-xs text-muted-foreground">
              Không khớp: {response.unmatched.join(", ")}
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
