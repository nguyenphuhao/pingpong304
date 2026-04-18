"use client";

import { useState } from "react";
import { Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Option = { id: string; label: string };

export function KoEntryPicker({
  options,
  currentId,
  slotLabel,
  usedElsewhere,
  onPick,
  disabled,
}: {
  options: Option[];
  currentId: string | null;
  slotLabel: string;
  usedElsewhere: Set<string>;
  onPick: (id: string | null) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const pick = async (id: string | null) => {
    setOpen(false);
    setQuery("");
    await onPick(id);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Đổi slot"
          >
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chốt slot: {slotLabel}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Chọn cặp/đội cho slot này. BTC dùng khi cần ghi đè kết quả BXH.
          </p>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Tìm theo tên..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
            Bỏ trống slot
          </button>
          {filtered.map((o) => {
            const selected = o.id === currentId;
            const taken = usedElsewhere.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => pick(o.id)}
                className={`flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted ${
                  selected ? "bg-muted" : ""
                }`}
              >
                <span className="truncate">
                  {o.label}
                  {taken && !selected && (
                    <span className="ml-2 text-xs text-amber-600">
                      (đã xếp ở slot khác)
                    </span>
                  )}
                </span>
                {selected ? <Check className="size-4" /> : null}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Không tìm thấy
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Đóng</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
