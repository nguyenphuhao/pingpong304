"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Swords } from "lucide-react";
import { groupColor } from "./_groupColors";
import type { MatchResolved, TeamMatchResolved, SetScore } from "@/lib/schemas/match";
import type { DoublesKoResolved, TeamKoResolved } from "@/lib/schemas/knockout";
import type { GroupResolved } from "@/lib/schemas/group";

function setsSummary(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

function StatusPill({ status, scoreA, scoreB }: { status: string; scoreA?: number; scoreB?: number }) {
  if (status === "done" || status === "forfeit") {
    return (
      <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-medium text-green-600 dark:text-green-400">
        {scoreA != null ? `${scoreA}-${scoreB}` : "Xong"}
      </span>
    );
  }
  if (status === "live") {
    return (
      <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-medium text-red-600 dark:text-red-400">
        Live
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
      Chưa đấu
    </span>
  );
}

function FilterChips({
  options,
  active,
  onSelect,
  activeColor,
}: {
  options: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
  activeColor: string;
}) {
  return (
    <div className="flex gap-1 border-b border-border px-2.5 py-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onSelect(o.id)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            active === o.id ? activeColor : "bg-muted text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Group Schedule ──

export function GroupScheduleList({
  kind,
  groups,
  matchesByGroup,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  matchesByGroup: Map<string, MatchResolved[]> | Map<string, TeamMatchResolved[]>;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const allOptions = [
    { id: "all", label: "Tất cả" },
    ...groups.map((g) => ({
      id: g.id,
      label: g.name.replace(/^Bảng\s*/i, ""),
    })),
  ];

  // flatten all matches with group info
  const all: Array<{
    id: string; groupId: string; groupName: string;
    sideA: string; sideB: string; status: string;
    scoreA: number; scoreB: number; sets: SetScore[];
  }> = [];
  for (const g of groups) {
    const matches = matchesByGroup.get(g.id) ?? [];
    for (const m of matches) {
      if (kind === "doubles") {
        const dm = m as MatchResolved;
        const { a, b } = setsSummary(dm.sets);
        all.push({
          id: dm.id, groupId: g.id, groupName: g.name,
          sideA: dm.pairA.label, sideB: dm.pairB.label,
          status: dm.status, scoreA: a, scoreB: b, sets: dm.sets,
        });
      } else {
        const tm = m as TeamMatchResolved;
        all.push({
          id: tm.id, groupId: g.id, groupName: g.name,
          sideA: tm.teamA.name, sideB: tm.teamB.name,
          status: tm.status, scoreA: tm.scoreA, scoreB: tm.scoreB, sets: [],
        });
      }
    }
  }

  const filtered = filter === "all" ? all : all.filter((m) => m.groupId === filter);
  const doneCount = all.filter((m) => m.status === "done" || m.status === "forfeit").length;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3"
      >
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Lịch vòng bảng</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {doneCount}/{all.length} xong
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="rounded-lg bg-card">
          <FilterChips
            options={allOptions}
            active={filter}
            onSelect={setFilter}
            activeColor="bg-blue-500/20 text-blue-600 dark:text-blue-400"
          />
          <div className="divide-y divide-border">
            {filtered.map((m) => (
              <CompactRow
                key={m.id}
                groupId={m.groupId}
                groupName={m.groupName}
                sideA={m.sideA}
                sideB={m.sideB}
                status={m.status}
                scoreA={m.scoreA}
                scoreB={m.scoreB}
                sets={m.sets}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── KO Schedule ──

const ROUND_LABELS: Record<string, string> = { qf: "TK", sf: "BK", f: "CK" };

export function KnockoutScheduleList({
  kind,
  matches,
}: {
  kind: "doubles" | "teams";
  matches: DoublesKoResolved[] | TeamKoResolved[];
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const allOptions = [
    { id: "all", label: "Tất cả" },
    { id: "qf", label: "TK" },
    { id: "sf", label: "BK" },
    { id: "f", label: "CK" },
  ];

  const isDoubles = kind === "doubles";
  const doneCount = matches.filter((m) => m.status === "done" || m.status === "forfeit").length;
  const filtered = filter === "all" ? matches : matches.filter((m) => m.round === filter);

  const roundCount: Record<string, number> = {};
  const rows = filtered.map((m) => {
    const rKey = m.round;
    roundCount[rKey] = (roundCount[rKey] ?? 0) + 1;
    const label = m.round === "f" ? "CK" : `${ROUND_LABELS[m.round]}${roundCount[rKey]}`;
    const sideA = isDoubles
      ? (m as DoublesKoResolved).entryA?.label ?? m.labelA
      : (m as TeamKoResolved).entryA?.name ?? m.labelA;
    const sideB = isDoubles
      ? (m as DoublesKoResolved).entryB?.label ?? m.labelB
      : (m as TeamKoResolved).entryB?.name ?? m.labelB;
    const scoreA = isDoubles ? (m as DoublesKoResolved).setsA : (m as TeamKoResolved).scoreA;
    const scoreB = isDoubles ? (m as DoublesKoResolved).setsB : (m as TeamKoResolved).scoreB;
    return { id: m.id, roundLabel: label, sideA: sideA || "—", sideB: sideB || "—", status: m.status, scoreA, scoreB };
  });

  if (matches.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3"
      >
        <span className="flex items-center gap-1.5">
          <Swords className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Vòng loại trực tiếp</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {doneCount}/{matches.length} xong
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="rounded-lg bg-card">
          <FilterChips
            options={allOptions}
            active={filter}
            onSelect={setFilter}
            activeColor="bg-orange-500/20 text-orange-600 dark:text-orange-400"
          />
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-1.5 px-2.5 py-2 text-[11px]">
                <span className="shrink-0 min-w-[24px] text-[9px] font-semibold text-orange-500">
                  {r.roundLabel}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {r.sideA} vs {r.sideB}
                </span>
                <StatusPill status={r.status} scoreA={r.scoreA} scoreB={r.scoreB} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Compact Row (group matches) ──

function CompactRow({
  groupId, groupName, sideA, sideB, status, scoreA, scoreB, sets,
}: {
  groupId: string; groupName: string; sideA: string; sideB: string;
  status: string; scoreA: number; scoreB: number; sets: SetScore[];
}) {
  const [expanded, setExpanded] = useState(false);
  const c = groupColor(groupId);

  const abbrev = (name: string) =>
    name.split(/\s*–\s*/).map((part) =>
      part.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").join("")
    ).join("–");

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-[11px]"
      >
        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${c.badge}`}>
          {groupName.replace(/^Bảng\s*/i, "")}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">
          {abbrev(sideA)} vs {abbrev(sideB)}
        </span>
        <StatusPill status={status} scoreA={scoreA} scoreB={scoreB} />
        <ChevronRight className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="border-t border-dashed px-2.5 pb-2.5 pt-2 text-xs">
          <div className="space-y-0.5">
            <div className={scoreA > scoreB ? "font-semibold" : "text-muted-foreground"}>{sideA}</div>
            <div className={scoreB > scoreA ? "font-semibold" : "text-muted-foreground"}>{sideB}</div>
          </div>
          {sets.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sets.map((s, i) => (
                <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                  {s.a}-{s.b}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
