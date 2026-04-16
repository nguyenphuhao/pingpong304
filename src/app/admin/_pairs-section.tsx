"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Player } from "./_mock";
import type { PairWithNames } from "@/lib/schemas/pair";
import { PairInputSchema, type PairInput } from "@/lib/schemas/pair";
import { ConfirmDeleteButton, SectionHeader } from "./_components";

type OptAction =
  | { type: "add"; pair: PairWithNames }
  | { type: "update"; id: string; patch: Partial<PairWithNames> }
  | { type: "remove"; id: string };

function reducer(state: PairWithNames[], action: OptAction): PairWithNames[] {
  switch (action.type) {
    case "add":
      return [...state, action.pair];
    case "update":
      return state.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p));
    case "remove":
      return state.filter((p) => p.id !== action.id);
  }
}

const GHOST_ID = "__pending__";
const API_BASE = "/api/doubles/pairs";

export function PairsSection({
  pairs,
  players,
}: {
  pairs: PairWithNames[];
  players: Player[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(pairs, reducer);
  const [, startTransition] = useTransition();

  const lookup = (id: string) => players.find((p) => p.id === id)?.name ?? id;

  const handleCreate = (input: PairInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const ghost: PairWithNames = {
          id: GHOST_ID,
          p1: { id: input.p1, name: lookup(input.p1) },
          p2: { id: input.p2, name: lookup(input.p2) },
        };
        setOptimistic({ type: "add", pair: ghost });
        try {
          const res = await fetch(API_BASE, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success(`Đã thêm cặp ${ghost.p1.name} / ${ghost.p2.name}`);
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  const handleUpdate = (id: string, input: PairInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        setOptimistic({
          type: "update",
          id,
          patch: {
            p1: { id: input.p1, name: lookup(input.p1) },
            p2: { id: input.p2, name: lookup(input.p2) },
          },
        });
        try {
          const res = await fetch(`${API_BASE}/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success("Đã lưu");
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  const handleDelete = (id: string) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        setOptimistic({ type: "remove", id });
        try {
          const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success("Đã xoá cặp");
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  return (
    <div>
      <SectionHeader
        title="Danh sách cặp đôi"
        subtitle={`${optimistic.length} cặp đã ghép`}
        action={<PairFormDialog mode="create" players={players} onSubmitCreate={handleCreate} />}
      />
      <div className="flex flex-col gap-2">
        {optimistic.length === 0 && (
          <Card className="p-4 text-center text-sm text-muted-foreground">
            Chưa có cặp đôi. Bấm <strong>Thêm</strong> để tạo cặp đầu tiên.
          </Card>
        )}
        {optimistic.map((pair, i) => {
          const isGhost = pair.id === GHOST_ID;
          return (
            <Card
              key={`${pair.id}-${i}`}
              className={`flex flex-row items-center gap-3 p-3 ${isGhost ? "opacity-60" : ""}`}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {pair.p1.name} <span className="text-muted-foreground">/</span> {pair.p2.name}
                  {isGhost && (
                    <Loader2 className="ml-1.5 inline size-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Mã cặp · {pair.id.toUpperCase()}
                </div>
              </div>
              {!isGhost && (
                <div className="flex shrink-0 gap-0.5">
                  <PairFormDialog
                    mode="edit"
                    pair={pair}
                    players={players}
                    onSubmitUpdate={handleUpdate}
                  />
                  <ConfirmDeleteButton
                    label={`cặp "${pair.p1.name} / ${pair.p2.name}"`}
                    onConfirm={() => handleDelete(pair.id)}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function PairFormDialog({
  mode,
  pair,
  players,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  mode: "create" | "edit";
  pair?: PairWithNames;
  players: Player[];
  onSubmitCreate?: (input: PairInput) => Promise<void>;
  onSubmitUpdate?: (id: string, input: PairInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [p1, setP1] = useState(pair?.p1.id ?? "");
  const [p2, setP2] = useState(pair?.p2.id ?? "");

  const reset = () => {
    setP1(pair?.p1.id ?? "");
    setP2(pair?.p2.id ?? "");
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const handleSubmit = async () => {
    const parsed = PairInputSchema.safeParse({ p1, p2 });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }
    setPending(true);
    try {
      if (mode === "create" && onSubmitCreate) {
        await onSubmitCreate(parsed.data);
      } else if (mode === "edit" && pair && onSubmitUpdate) {
        await onSubmitUpdate(pair.id, parsed.data);
      }
      setOpen(false);
      reset();
    } catch {
      /* handler toasted */
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button size="sm">
              <Plus /> Thêm
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Sửa"
              className="bg-muted hover:bg-muted/70"
            />
          )
        }
      >
        {mode === "edit" ? <Pencil /> : null}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Thêm cặp đôi"
              : `Sửa cặp đôi · ${pair?.id.toUpperCase() ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Chọn 2 VĐV để ghép cặp." : "Đổi VĐV trong cặp."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="p1">VĐV 1</Label>
            <Select value={p1} onValueChange={(v) => setP1(v ?? "")} disabled={pending}>
              <SelectTrigger id="p1" className="w-full">
                <SelectValue placeholder="Chọn VĐV">
                  {(value) =>
                    value ? (players.find((p) => p.id === value)?.name ?? value) : null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {players.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id} disabled={pl.id === p2}>
                    {pl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p2">VĐV 2</Label>
            <Select value={p2} onValueChange={(v) => setP2(v ?? "")} disabled={pending}>
              <SelectTrigger id="p2" className="w-full">
                <SelectValue placeholder="Chọn VĐV">
                  {(value) =>
                    value ? (players.find((p) => p.id === value)?.name ?? value) : null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {players.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id} disabled={pl.id === p1}>
                    {pl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" disabled={pending} />}>
            Huỷ
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Thêm" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
