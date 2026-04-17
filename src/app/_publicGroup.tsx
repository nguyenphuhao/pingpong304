"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, Medal, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { groupColor } from "./_groupColors";
import type { StandingRow } from "@/lib/db/standings";
import type { MatchResolved, TeamMatchResolved, SetScore } from "@/lib/schemas/match";
import type { GroupResolved } from "@/lib/schemas/group";

export function GroupStageTabs({
  kind,
  groups,
  standings,
  matchesByGroup,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  standings: Map<string, StandingRow[]>;
  matchesByGroup: Map<string, MatchResolved[]> | Map<string, TeamMatchResolved[]>;
}) {
  const entryLabel = kind === "doubles" ? "cặp" : "đội";
  const [active, setActive] = useState(groups[0]?.id ?? "");
  const activeGroup = groups.find((g) => g.id === active) ?? groups[0];

  if (!activeGroup) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Chưa có bảng nào.
      </div>
    );
  }

  return (
    <div>
      <div
        role="tablist"
        className="inline-flex w-full items-center gap-1 rounded-lg bg-muted p-1"
      >
        {groups.map((g) => {
          const c = groupColor(g.id);
          const isActive = g.id === active;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(g.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium transition-all ${
                isActive ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              <span
                className={`pointer-events-none flex size-5 items-center justify-center rounded text-xs font-semibold ${c.badge}`}
              >
                {g.name.replace(/^Bảng\s*/i, "")}
              </span>
              <span className="pointer-events-none hidden sm:inline">{g.name}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <GroupTabContent
          kind={kind}
          group={activeGroup}
          entryLabel={entryLabel}
          standings={standings.get(activeGroup.id) ?? []}
          matches={
            (matchesByGroup as Map<string, MatchResolved[] | TeamMatchResolved[]>).get(
              activeGroup.id,
            ) ?? []
          }
        />
      </div>
    </div>
  );
}

function GroupTabContent({
  kind,
  group,
  entryLabel,
  standings,
  matches,
}: {
  kind: "doubles" | "teams";
  group: GroupResolved;
  entryLabel: string;
  standings: StandingRow[];
  matches: MatchResolved[] | TeamMatchResolved[];
}) {
  const c = groupColor(group.id);
  const played = standings.some((s) => s.played > 0);
  const top1 = standings[0];
  const top2 = standings[1];

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-3 ${c.border} ${c.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex size-8 items-center justify-center rounded-lg font-semibold ${c.badge}`}>
            {group.name.replace(/^Bảng\s*/i, "")}
          </span>
          <span className="font-semibold">{group.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {group.entries.length} {entryLabel}
        </span>
      </div>

      {/* Top 1 + Top 2 */}
      <div className="grid grid-cols-1 gap-2">
        <TopEntryCard
          rank={1}
          row={top1}
          empty={!played}
          tone="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
        />
        <TopEntryCard
          rank={2}
          row={top2}
          empty={!played}
          tone="bg-slate-400/20 text-slate-600 dark:text-slate-300"
        />
      </div>

      {/* Tất cả entries (inline) */}
      <div className="rounded-md bg-background/60 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Danh sách {group.entries.length} {entryLabel}
        </div>
        <ol className="space-y-1 text-sm">
          {group.entries.map((e, i) => (
            <li key={e.id} className="flex items-center gap-2">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">{e.label}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Lịch & kết quả - accordion */}
      <MatchesAccordion group={group} kind={kind} matches={matches} />

      {/* BXH chi tiết - dialog */}
      <StandingsDialog group={group} kind={kind} standings={standings} />
    </div>
  );
}

function TopEntryCard({
  rank,
  row,
  empty,
  tone,
}: {
  rank: 1 | 2;
  row?: StandingRow;
  empty: boolean;
  tone: string;
}) {
  const Icon = rank === 1 ? Trophy : Medal;
  const label = rank === 1 ? "Nhất bảng" : "Nhì bảng";
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {empty || !row ? (
          <div className="text-sm italic text-muted-foreground">Chưa xác định</div>
        ) : (
          <div className="truncate font-medium">{row.entry}</div>
        )}
      </div>
      {!empty && row && (
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold tabular-nums">{row.points}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">điểm</div>
        </div>
      )}
    </div>
  );
}

function StandingsDialog({
  group,
  kind,
  standings,
}: {
  group: GroupResolved;
  kind: "doubles" | "teams";
  standings: StandingRow[];
}) {
  const diffLabel = kind === "doubles" ? "Hiệu số ván" : "Hiệu số trận cá nhân";

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="w-full">
            <Trophy /> BXH chi tiết
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bảng xếp hạng · {group.name}</DialogTitle>
          <DialogDescription>
            Thắng: 1 điểm · HS: {diffLabel.toLowerCase()}
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-2">
          {standings.map((r, i) => (
            <li
              key={r.entry}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.entry}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                  <span>{r.played} trận</span>
                  <span className="text-green-600 dark:text-green-400">{r.won}T</span>
                  <span className="text-red-600 dark:text-red-400">{r.lost}B</span>
                  <span
                    className={
                      r.diff > 0
                        ? "text-green-600 dark:text-green-400"
                        : r.diff < 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }
                  >
                    HS {r.diff > 0 ? `+${r.diff}` : r.diff}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-semibold tabular-nums">{r.points}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  điểm
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex justify-end">
          <DialogClose render={<Button variant="outline" type="button" />}>Đóng</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function setsSummary(sets: SetScore[]) {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

function MatchesAccordion({
  group,
  kind,
  matches,
}: {
  group: GroupResolved;
  kind: "doubles" | "teams";
  matches: MatchResolved[] | TeamMatchResolved[];
}) {
  const done = matches.filter((m) => m.status === "done").length;

  return (
    <details className="group rounded-md bg-background/60">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          Lịch & kết quả
          <span className="text-xs font-normal text-muted-foreground">
            ({done}/{matches.length})
          </span>
        </span>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <ol className="flex flex-col gap-2 px-3 pb-3">
        {kind === "doubles"
          ? (matches as MatchResolved[]).map((m, i) => (
              <DoublesMatchRow key={m.id} match={m} index={i + 1} />
            ))
          : (matches as TeamMatchResolved[]).map((m, i) => (
              <TeamMatchRow key={m.id} match={m} index={i + 1} />
            ))}
      </ol>
    </details>
  );
}

function MatchHeader({
  index,
  table,
  bestOf,
  status,
}: {
  index: number;
  table?: number | null;
  bestOf?: number;
  status: "scheduled" | "done" | "forfeit" | "live";
}) {
  return (
    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">Trận {index}</span>
        {table != null && <span>· Bàn {table}</span>}
        {bestOf && <span>· thắng {Math.ceil(bestOf / 2)}/{bestOf} ván</span>}
      </div>
      {status === "done" || status === "forfeit" ? (
        <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
          Đã xong
        </span>
      ) : status === "live" ? (
        <span className="rounded-full bg-orange-500/15 px-2 py-0.5 font-medium text-orange-700 dark:text-orange-400">
          Đang đấu
        </span>
      ) : (
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">Chưa đấu</span>
      )}
    </div>
  );
}

function ScoreCol({
  done,
  scoreA,
  scoreB,
  aWon,
  bWon,
}: {
  done: boolean;
  scoreA: number;
  scoreB: number;
  aWon: boolean;
  bWon: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end text-xl font-semibold tabular-nums leading-tight">
      <span className={aWon ? "" : "text-muted-foreground"}>{done ? scoreA : "–"}</span>
      <span className={bWon ? "" : "text-muted-foreground"}>{done ? scoreB : "–"}</span>
    </div>
  );
}

function DoublesMatchRow({ match, index }: { match: MatchResolved; index: number }) {
  const { a, b } = setsSummary(match.sets);
  const done = match.status === "done" || match.status === "forfeit";
  const aWon = done && a > b;
  const bWon = done && b > a;
  return (
    <li className="rounded-lg border p-3">
      <MatchHeader index={index} table={match.table} bestOf={match.bestOf} status={match.status} />
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div className={`truncate ${aWon ? "font-semibold" : ""}`}>{match.pairA.label}</div>
          <div className={`truncate ${bWon ? "font-semibold" : ""}`}>{match.pairB.label}</div>
        </div>
        <ScoreCol done={done} scoreA={a} scoreB={b} aWon={aWon} bWon={bWon} />
      </div>
      {done && match.sets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {match.sets.map((s, i) => (
            <span
              key={i}
              className="inline-flex min-w-[36px] items-center justify-center rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums"
            >
              {s.a}-{s.b}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function TeamMatchRow({ match, index }: { match: TeamMatchResolved; index: number }) {
  const done = match.status === "done" || match.status === "forfeit";
  const aWon = done && match.scoreA > match.scoreB;
  const bWon = done && match.scoreB > match.scoreA;
  return (
    <li className="rounded-lg border p-3">
      <MatchHeader index={index} table={match.table} status={match.status} />
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div className={`truncate ${aWon ? "font-semibold" : ""}`}>{match.teamA.name}</div>
          <div className={`truncate ${bWon ? "font-semibold" : ""}`}>{match.teamB.name}</div>
        </div>
        <ScoreCol done={done} scoreA={match.scoreA} scoreB={match.scoreB} aWon={aWon} bWon={bWon} />
      </div>

      <ul className="mt-2 space-y-1.5 border-t pt-2">
        {match.individual.map((im) => (
          <SubMatchRow key={im.id} match={im} />
        ))}
      </ul>
    </li>
  );
}

function SubMatchRow({
  match,
}: {
  match: TeamMatchResolved["individual"][number];
}) {
  const { a, b } = setsSummary(match.sets);
  const hasResult = match.sets.length > 0;
  const aWon = hasResult && a > b;
  const bWon = hasResult && b > a;

  const playerLabel = (players: Array<{ id: string; name: string }>) =>
    players.length === 0 ? null : players.map((p) => p.name).join(" – ");

  const labelA = playerLabel(match.playersA);
  const labelB = playerLabel(match.playersB);

  return (
    <li className="rounded-md bg-muted/40 p-2">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">{match.label}</span>
          <span className="rounded bg-muted px-1.5 py-0.5">
            {match.kind === "singles" ? "Đơn" : "Đôi"}
          </span>
        </span>
        <span>thắng {Math.ceil(match.bestOf / 2)}/{match.bestOf} ván</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className={`truncate ${aWon ? "font-semibold" : "text-muted-foreground"}`}>
            {labelA ?? <span className="italic">Chưa gán</span>}
          </div>
          <div className={`truncate ${bWon ? "font-semibold" : "text-muted-foreground"}`}>
            {labelB ?? <span className="italic">Chưa gán</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-base font-semibold tabular-nums leading-tight">
          <span className={aWon ? "" : "text-muted-foreground"}>{hasResult ? a : "–"}</span>
          <span className={bWon ? "" : "text-muted-foreground"}>{hasResult ? b : "–"}</span>
        </div>
      </div>
    </li>
  );
}
