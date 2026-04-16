"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronRight, Pencil, Square } from "lucide-react";
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
import type { GroupResolved } from "@/lib/schemas/group";
import type { PairWithNames } from "@/lib/schemas/pair";
import type { TeamWithNames } from "@/lib/schemas/team";
import { groupColor } from "../_groupColors";
import { SectionHeader } from "./_components";

type AllEntry = { id: string; label: string };

type OptAction = {
  type: "updateEntries";
  id: string;
  entries: GroupResolved["entries"];
};

function reducer(
  state: GroupResolved[],
  action: OptAction,
): GroupResolved[] {
  switch (action.type) {
    case "updateEntries":
      return state.map((g) =>
        g.id === action.id ? { ...g, entries: action.entries } : g,
      );
  }
}

export function GroupsSection({
  kind,
  groups,
  pairs,
  teams,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  pairs?: PairWithNames[];
  teams?: TeamWithNames[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(groups, reducer);
  const [, startTransition] = useTransition();

  const entryLabel = kind === "doubles" ? "cặp" : "đội";
  const base =
    kind === "doubles" ? "/admin/doubles/groups" : "/admin/teams/groups";
  const apiBase =
    kind === "doubles" ? "/api/doubles/groups" : "/api/teams/groups";

  const allEntries: AllEntry[] =
    kind === "doubles"
      ? (pairs ?? []).map((p) => ({
          id: p.id,
          label: `${p.p1.name} – ${p.p2.name}`,
        }))
      : (teams ?? []).map((t) => ({ id: t.id, label: t.name }));

  const handleSave = (groupId: string, entries: string[]) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const labelMap = new Map(allEntries.map((a) => [a.id, a.label]));
        const nextEntries = entries.map((id) => ({
          id,
          label: labelMap.get(id) ?? "?",
        }));
        setOptimistic({
          type: "updateEntries",
          id: groupId,
          entries: nextEntries,
        });
        try {
          const res = await fetch(`${apiBase}/${groupId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ entries }),
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

  return (
    <div>
      <SectionHeader
        title="Bảng đấu"
        subtitle={`${optimistic.length} bảng · bấm để xem lịch`}
      />
      <div className="flex flex-col gap-3">
        {optimistic.map((g) => {
          const c = groupColor(g.id);
          return (
            <Card key={g.id} className={`p-4 ${c.border} ${c.bg}`}>
              <div className="mb-3 flex items-center justify-between">
                <Link
                  href={`${base}/${g.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg font-semibold ${c.badge}`}
                  >
                    {g.name.replace(/^Bảng\s*/i, "")}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {g.entries.length} {entryLabel} · xem lịch vòng bảng
                    </div>
                  </div>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </Link>
                <div className="ml-2 flex gap-0.5">
                  <GroupEntriesDialog
                    group={g}
                    kind={kind}
                    allEntries={allEntries}
                    otherGroups={optimistic}
                    onSubmit={(entries) => handleSave(g.id, entries)}
                  />
                </div>
              </div>
              <ul className="space-y-1.5 text-sm">
                {g.entries.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <span className="inline-flex size-5 items-center justify-center rounded bg-muted text-sm text-muted-foreground">
                      {i + 1}
                    </span>
                    {e.label}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function GroupEntriesDialog({
  group,
  kind,
  allEntries,
  otherGroups,
  onSubmit,
}: {
  group: GroupResolved;
  kind: "doubles" | "teams";
  allEntries: AllEntry[];
  otherGroups: GroupResolved[];
  onSubmit: (entries: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group.entries.map((e) => e.id)),
  );

  const otherGroupMap = new Map<string, string>();
  for (const g of otherGroups) {
    if (g.id === group.id) continue;
    for (const e of g.entries) otherGroupMap.set(e.id, g.name);
  }

  const reset = () =>
    setSelected(new Set(group.entries.map((e) => e.id)));

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setPending(true);
    try {
      await onSubmit(Array.from(selected));
      setOpen(false);
    } catch {
      /* parent toasts, don't close */
    } finally {
      setPending(false);
    }
  };

  const entityLabel = kind === "doubles" ? "cặp" : "đội";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Sửa entries"
            className="bg-muted hover:bg-muted/70"
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa entries · {group.name}</DialogTitle>
          <DialogDescription>
            Chọn {entityLabel} thuộc {group.name}. {entityLabel} đang ở bảng
            khác phải xóa khỏi bảng đó trước.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <ul className="flex flex-col gap-1">
            {allEntries.map((e) => {
              const inOther = otherGroupMap.get(e.id);
              const isSelected = selected.has(e.id);
              const isDisabled = inOther !== undefined;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={isDisabled || pending}
                    onClick={() => toggle(e.id)}
                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                      isSelected
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-transparent hover:bg-muted"
                    } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {isSelected ? (
                      <Check className="size-4 text-emerald-600" />
                    ) : (
                      <Square className="size-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{e.label}</span>
                    {inOther && (
                      <Badge variant="secondary" className="shrink-0">
                        {inOther}
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" type="button" disabled={pending} />
            }
          >
            Huỷ
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending && (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            )}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
