"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mars, Pencil, Plus, Venus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Content, Player } from "./_mock";
import {
  PlayerInputSchema,
  PlayerPatchSchema,
  type PlayerInput,
  type PlayerPatch,
} from "@/lib/schemas/player";
import { ConfirmDeleteButton, SectionHeader } from "./_components";

type OptAction =
  | { type: "add"; player: Player }
  | { type: "update"; id: string; patch: Partial<Player> }
  | { type: "remove"; id: string };

function reducer(state: Player[], action: OptAction): Player[] {
  switch (action.type) {
    case "add":
      return [...state, action.player];
    case "update":
      return state.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p));
    case "remove":
      return state.filter((p) => p.id !== action.id);
  }
}

function apiBase(kind: Content) {
  return `/api/${kind}/players`;
}

const GHOST_ID = "__pending__";

export function PlayersSection({
  kind,
  players,
}: {
  kind: Content;
  players: Player[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(players, reducer);
  const [, startTransition] = useTransition();

  const handleCreate = (input: PlayerInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const ghost: Player = {
          id: GHOST_ID,
          name: input.name,
          gender: input.gender,
          club: input.club ?? "",
          phone: input.phone ?? "",
        };
        setOptimistic({ type: "add", player: ghost });
        try {
          const res = await fetch(apiBase(kind), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success(`Đã thêm VĐV ${input.name}`);
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  const handleUpdate = (id: string, patch: PlayerPatch) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        setOptimistic({ type: "update", id, patch: patch as Partial<Player> });
        try {
          const res = await fetch(`${apiBase(kind)}/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
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
          const res = await fetch(`${apiBase(kind)}/${id}`, { method: "DELETE" });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          const target = players.find((p) => p.id === id);
          toast.success(`Đã xoá ${target?.name ?? "VĐV"}`);
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  const total = optimistic.length;
  const male = useMemo(
    () => optimistic.filter((p) => p.gender === "M").length,
    [optimistic],
  );
  const female = total - male;

  return (
    <div>
      <SectionHeader
        title="Danh sách VĐV"
        subtitle={`${total} VĐV · ${male} nam · ${female} nữ`}
        action={<PlayerFormDialog mode="create" onSubmitCreate={handleCreate} />}
      />
      <div className="flex flex-col gap-2">
        {optimistic.map((p, i) => {
          const isGhost = p.id === GHOST_ID;
          return (
            <Card
              key={`${p.id}-${i}`}
              className={`flex flex-row items-center gap-3 p-3 ${
                isGhost ? "opacity-60" : ""
              }`}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{p.name}</span>
                  {p.gender === "M" ? (
                    <Mars className="size-4 shrink-0 text-blue-500" aria-label="Nam" />
                  ) : (
                    <Venus className="size-4 shrink-0 text-pink-500" aria-label="Nữ" />
                  )}
                  {isGhost && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="truncate text-sm text-muted-foreground">{p.club}</div>
              </div>
              {!isGhost && (
                <div className="flex shrink-0 gap-0.5">
                  <PlayerFormDialog mode="edit" player={p} onSubmitUpdate={handleUpdate} />
                  <ConfirmDeleteButton
                    label={`VĐV "${p.name}"`}
                    onConfirm={() => handleDelete(p.id)}
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

export function PlayerFormDialog({
  mode,
  player,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  mode: "create" | "edit";
  player?: Player;
  onSubmitCreate?: (input: PlayerInput) => Promise<void>;
  onSubmitUpdate?: (id: string, patch: PlayerPatch) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(player?.name ?? "");
  const [gender, setGender] = useState<"M" | "F">(player?.gender ?? "M");
  const [club, setClub] = useState(player?.club ?? "");
  const [phone, setPhone] = useState(player?.phone ?? "");

  const reset = () => {
    setName(player?.name ?? "");
    setGender(player?.gender ?? "M");
    setClub(player?.club ?? "");
    setPhone(player?.phone ?? "");
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const handleSubmit = async () => {
    if (mode === "create") {
      const parsed = PlayerInputSchema.safeParse({ name, gender, club, phone });
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        toast.error(`${first.path.join(".")}: ${first.message}`);
        return;
      }
      if (!onSubmitCreate) return;
      setPending(true);
      try {
        await onSubmitCreate(parsed.data);
        setOpen(false);
        reset();
      } catch {
        /* handler already toasted */
      } finally {
        setPending(false);
      }
      return;
    }
    // edit mode
    if (!player || !onSubmitUpdate) return;
    const patch: Record<string, unknown> = {};
    if (name !== player.name) patch.name = name;
    if (gender !== player.gender) patch.gender = gender;
    if (club !== player.club) patch.club = club;
    if (phone !== player.phone) patch.phone = phone;
    if (Object.keys(patch).length === 0) {
      setOpen(false);
      return;
    }
    const parsed = PlayerPatchSchema.safeParse(patch);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }
    setPending(true);
    try {
      await onSubmitUpdate(player.id, parsed.data);
      setOpen(false);
    } catch {
      /* toasted */
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
          <DialogTitle>{mode === "create" ? "Thêm VĐV" : "Sửa VĐV"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Nhập thông tin VĐV mới." : "Cập nhật thông tin VĐV."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Họ tên</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gender">Giới tính</Label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as "M" | "F")}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              disabled={pending}
            >
              <option value="M">Nam</option>
              <option value="F">Nữ</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="club">CLB / Đơn vị</Label>
            <Input
              id="club"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="CLB ..."
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              disabled={pending}
            />
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
