"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, Search, Swords } from "lucide-react";
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
      <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        {scoreA != null ? `${scoreA}-${scoreB}` : "Xong"}
      </span>
    );
  }
  if (status === "live") {
    return (
      <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
        Live
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
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
          className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
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
  const [search, setSearch] = useState("");

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

  const byGroup = filter === "all" ? all : all.filter((m) => m.groupId === filter);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? byGroup.filter((m) => m.sideA.toLowerCase().includes(q) || m.sideB.toLowerCase().includes(q))
    : byGroup;
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
          <span className="text-base font-semibold">Lịch vòng bảng</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {doneCount}/{all.length} xong
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div>
          <div className="flex items-center gap-2">
            <FilterChips
              options={allOptions}
              active={filter}
              onSelect={setFilter}
              activeColor="bg-blue-500/20 text-blue-600 dark:text-blue-400"
            />
          </div>
          {/* Search by player name */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên VĐV..."
              className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-2">
            {filtered.map((m) => (
              <MatchCardFull
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
            {filtered.length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Không tìm thấy trận nào
              </div>
            )}
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
          <span className="text-base font-semibold">Vòng loại trực tiếp</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {doneCount}/{matches.length} xong
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div>
          <FilterChips
            options={allOptions}
            active={filter}
            onSelect={setFilter}
            activeColor="bg-orange-500/20 text-orange-600 dark:text-orange-400"
          />
          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-orange-500/15 text-orange-600 dark:text-orange-400">
                    {r.roundLabel}
                  </span>
                  <StatusPill status={r.status} scoreA={r.scoreA} scoreB={r.scoreB} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    <div className={r.scoreA > r.scoreB ? "font-semibold" : ""}>{r.sideA}</div>
                    <div className={r.scoreB > r.scoreA ? "font-semibold" : "text-muted-foreground"}>{r.sideB}</div>
                  </div>
                  {(r.status === "done" || r.status === "forfeit") && (
                    <div className="flex shrink-0 flex-col items-end text-lg font-bold tabular-nums leading-tight">
                      <span className={r.scoreA > r.scoreB ? "" : "text-muted-foreground"}>{r.scoreA}</span>
                      <span className={r.scoreB > r.scoreA ? "" : "text-muted-foreground"}>{r.scoreB}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Full Match Card (group matches) ──

function MatchCardFull({
  groupId, groupName, sideA, sideB, status, scoreA, scoreB, sets,
}: {
  groupId: string; groupName: string; sideA: string; sideB: string;
  status: string; scoreA: number; scoreB: number; sets: SetScore[];
}) {
  const c = groupColor(groupId);
  const done = status === "done" || status === "forfeit";
  const aWon = done && scoreA > scoreB;
  const bWon = done && scoreB > scoreA;

  return (
    <div className="rounded-xl border p-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${c.badge}`}>
          {groupName.replace(/^Bảng\s*/i, "")}
        </span>
        <StatusPill status={status} scoreA={scoreA} scoreB={scoreB} />
      </div>

      {/* Names + Scores */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div className={aWon ? "font-semibold" : ""}>{sideA}</div>
          <div className={bWon ? "font-semibold" : "text-muted-foreground"}>{sideB}</div>
        </div>
        {done && (
          <div className="flex shrink-0 flex-col items-end text-lg font-bold tabular-nums leading-tight">
            <span className={aWon ? "" : "text-muted-foreground"}>{scoreA}</span>
            <span className={bWon ? "" : "text-muted-foreground"}>{scoreB}</span>
          </div>
        )}
      </div>

      {/* Set scores */}
      {sets.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sets.map((s, i) => (
            <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums">
              {s.a}-{s.b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
