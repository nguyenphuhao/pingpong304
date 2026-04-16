"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teamColor } from "@/app/_groupColors";
import type { Player } from "./_mock";
import type { TeamWithNames } from "@/lib/schemas/team";
import { TeamInputSchema, type TeamInput } from "@/lib/schemas/team";
import { ConfirmDeleteButton, SectionHeader } from "./_components";

type OptAction =
  | { type: "add"; team: TeamWithNames }
  | { type: "update"; id: string; patch: Partial<TeamWithNames> }
  | { type: "remove"; id: string };

function reducer(state: TeamWithNames[], action: OptAction): TeamWithNames[] {
  switch (action.type) {
    case "add":
      return [...state, action.team];
    case "update":
      return state.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t));
    case "remove":
      return state.filter((t) => t.id !== action.id);
  }
}

const GHOST_ID = "__pending__";
const API_BASE = "/api/teams/teams";

export function TeamsSection({
  teams,
  players,
}: {
  teams: TeamWithNames[];
  players: Player[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(teams, reducer);
  const [, startTransition] = useTransition();

  const lookup = (id: string) => players.find((p) => p.id === id)?.name ?? id;

  const handleCreate = (input: TeamInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const ghost: TeamWithNames = {
          id: GHOST_ID,
          name: input.name,
          members: input.members.map((id) => ({ id, name: lookup(id) })),
        };
        setOptimistic({ type: "add", team: ghost });
        try {
          const res = await fetch(API_BASE, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success(`Đã thêm đội ${input.name}`);
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  const handleUpdate = (id: string, input: TeamInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        setOptimistic({
          type: "update",
          id,
          patch: {
            name: input.name,
            members: input.members.map((mid) => ({ id: mid, name: lookup(mid) })),
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
          const target = teams.find((t) => t.id === id);
          toast.success(`Đã xoá ${target?.name ?? "đội"}`);
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
        title="Danh sách đội"
        subtitle={`${optimistic.length} đội đã đăng ký`}
        action={<TeamFormDialog mode="create" players={players} onSubmitCreate={handleCreate} />}
      />
      <div className="flex flex-col gap-3">
        {optimistic.length === 0 && (
          <Card className="p-4 text-center text-sm text-muted-foreground">
            Chưa có đội. Bấm <strong>Thêm</strong> để tạo đội đầu tiên.
          </Card>
        )}
        {optimistic.map((team, i) => {
          const isGhost = team.id === GHOST_ID;
          const c = teamColor(i);
          return (
            <Card
              key={`${team.id}-${i}`}
              className={`p-4 ${c.border} ${c.bg} ${isGhost ? "opacity-60" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`flex size-7 items-center justify-center rounded-md ${c.badge}`}>
                    <Users className="size-3.5" />
                  </span>
                  <span className="font-medium">{team.name}</span>
                  {isGhost && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{team.members.length} VĐV</Badge>
                  {!isGhost && (
                    <div className="flex gap-0.5">
                      <TeamFormDialog
                        mode="edit"
                        team={team}
                        players={players}
                        onSubmitUpdate={handleUpdate}
                      />
                      <ConfirmDeleteButton
                        label={`đội "${team.name}"`}
                        onConfirm={() => handleDelete(team.id)}
                      />
                    </div>
                  )}
                </div>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {team.members.map((m) => (
                  <li key={m.id}>• {m.name}</li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function TeamFormDialog({
  mode,
  team,
  players,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  mode: "create" | "edit";
  team?: TeamWithNames;
  players: Player[];
  onSubmitCreate?: (input: TeamInput) => Promise<void>;
  onSubmitUpdate?: (id: string, input: TeamInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(team?.name ?? "");
  const [members, setMembers] = useState<string[]>(
    team?.members.map((m) => m.id) ?? ["", "", ""],
  );

  const reset = () => {
    setName(team?.name ?? "");
    setMembers(team?.members.map((m) => m.id) ?? ["", "", ""]);
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const setMember = (i: number, v: string) =>
    setMembers((prev) => prev.map((m, j) => (j === i ? v : m)));

  const handleSubmit = async () => {
    const parsed = TeamInputSchema.safeParse({ name, members });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }
    setPending(true);
    try {
      if (mode === "create" && onSubmitCreate) {
        await onSubmitCreate(parsed.data);
      } else if (mode === "edit" && team && onSubmitUpdate) {
        await onSubmitUpdate(team.id, parsed.data);
      }
      setOpen(false);
      reset();
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
          <DialogTitle>
            {mode === "create"
              ? "Thêm đội"
              : `Sửa đội · ${team?.name ?? ""} (${team?.id ?? ""})`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Nhập tên và 3 VĐV của đội." : "Đổi tên hoặc thành viên."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="team-name">Tên đội</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Đội A"
              disabled={pending}
            />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-1.5">
              <Label htmlFor={`m${i}`}>{`VĐV ${i + 1}`}</Label>
              <Select
                value={members[i]}
                onValueChange={(v) => setMember(i, v ?? "")}
                disabled={pending}
              >
                <SelectTrigger id={`m${i}`} className="w-full">
                  <SelectValue placeholder="Chọn VĐV">
                    {(value) =>
                      value ? (players.find((p) => p.id === value)?.name ?? value) : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {players.map((pl) => (
                    <SelectItem
                      key={pl.id}
                      value={pl.id}
                      disabled={members.some((m, j) => m === pl.id && j !== i)}
                    >
                      {pl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
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
