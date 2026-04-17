"use client";

import { ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";

type Player = { id: string; name: string };

export function PlayerPicker({
  options,
  value,
  onChange,
  count,
  label,
}: {
  options: Player[];
  value: string[];
  onChange: (next: string[]) => void;
  count: 1 | 2;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);

  const commit = (next: string[]) => {
    onChange(next);
    setOpen(false);
  };

  const toggle = (id: string) => {
    if (draft.includes(id)) {
      setDraft(draft.filter((p) => p !== id));
      return;
    }
    const next =
      draft.length >= count ? [...draft.slice(1), id] : [...draft, id];
    setDraft(next);
    if (next.length === count) commit(next);
  };

  const apply = () => {
    if (draft.length !== count) return;
    commit(draft);
  };

  const display =
    value.length === 0
      ? count === 2
        ? "Chọn 2 VĐV"
        : "Chọn VĐV"
      : value
          .map((id) => options.find((o) => o.id === id)?.name ?? "?")
          .join(" / ");

  const remaining = count - draft.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setDraft(value);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
          >
            <span className="truncate">{display}</span>
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {label} — chọn {count} VĐV {count === 2 ? "(cặp đôi)" : ""}
          </DialogTitle>
          {remaining > 0 ? (
            <p className="text-sm text-muted-foreground">
              Đã chọn {draft.length}/{count}. Còn chọn thêm {remaining} VĐV.
            </p>
          ) : null}
        </DialogHeader>
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {options.map((p) => {
            const selected = draft.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted ${
                  selected ? "bg-muted" : ""
                }`}
              >
                <span>{p.name}</span>
                {selected ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Hủy</Button>} />
          <Button onClick={apply} disabled={draft.length !== count}>
            Xong ({draft.length}/{count})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
