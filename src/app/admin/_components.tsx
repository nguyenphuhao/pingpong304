"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Content,
  DoublesMatch,
  Group,
  IndividualMatch,
  KnockoutMatch,
  MatchStatus,
  OppSlot,
  Player,
  SetScore,
  Team,
  TeamMatch,
  TeamSlot,
} from "./_mock";
import { MOCK_TEAMS, ROUND_LABEL, TEAM_MATCH_TEMPLATE } from "./_mock";
import type { PairWithNames } from "@/lib/schemas/pair";
import type { TeamWithNames } from "@/lib/schemas/team";
import { groupColor } from "../_groupColors";
import { PlayersSection } from "./_players-section";
import { PairsSection } from "./_pairs-section";
import { TeamsSection } from "./_teams-section";

const DEFAULT_TAB = "players";
const TAB_VALUES = ["players", "entries", "groups", "ko"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return v !== null && (TAB_VALUES as readonly string[]).includes(v);
}

export function ContentWorkspace({
  kind,
  headerSlot,
  players,
  pairs,
  teams,
  groups,
  knockout,
  knockoutNote,
}: {
  kind: Content;
  headerSlot?: React.ReactNode;
  players: Player[];
  pairs?: PairWithNames[];
  teams?: TeamWithNames[];
  groups: Group[];
  knockout: KnockoutMatch[];
  knockoutNote?: string;
}) {
  const isDoubles = kind === "doubles";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: TabValue = isTabValue(raw) ? raw : DEFAULT_TAB;

  const handleTabChange = (value: unknown) => {
    if (typeof value !== "string" || !isTabValue(value)) return;
    const params = new URLSearchParams(searchParams);
    if (value === DEFAULT_TAB) params.delete("tab");
    else params.set("tab", value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-3 bg-background px-4 pt-4 pb-3">
        {headerSlot}
        <TabsList className="w-full">
          <TabsTrigger value="players">VĐV</TabsTrigger>
          <TabsTrigger value="entries">{isDoubles ? "Cặp" : "Đội"}</TabsTrigger>
          <TabsTrigger value="groups">Bảng</TabsTrigger>
          <TabsTrigger value="ko">Knockout</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="players" className="mt-4">
        <PlayersSection kind={kind} players={players} />
      </TabsContent>
      <TabsContent value="entries" className="mt-4">
        {isDoubles ? (
          <PairsSection pairs={pairs ?? []} players={players} />
        ) : (
          <TeamsSection teams={teams ?? []} players={players} />
        )}
      </TabsContent>
      <TabsContent value="groups" className="mt-4">
        <GroupsSection kind={kind} groups={groups} />
      </TabsContent>
      <TabsContent value="ko" className="mt-4">
        <KnockoutSection kind={kind} matches={knockout} note={knockoutNote} />
      </TabsContent>
    </Tabs>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

/* ---------- VĐV ---------- */

/* PlayersSection and PlayerFormDialog extracted to ./_players-section.tsx */

/* ---------- Cặp + Đội: extracted to _pairs-section.tsx / _teams-section.tsx ---------- */

/* ---------- Bảng đấu ---------- */

function GroupsSection({ kind, groups }: { kind: Content; groups: Group[] }) {
  const entryLabel = kind === "doubles" ? "cặp" : "đội";
  const base = kind === "doubles" ? "/admin/doubles/groups" : "/admin/teams/groups";
  return (
    <div>
      <SectionHeader title="Bảng đấu" subtitle={`${groups.length} bảng · bấm để xem lịch`} />
      <div className="flex flex-col gap-3">
        {groups.map((g) => {
          const c = groupColor(g.id);
          return (
          <Card key={g.id} className={`p-4 ${c.border} ${c.bg}`}>
            <div className="mb-3 flex items-center justify-between">
              <Link href={`${base}/${g.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg font-semibold ${c.badge}`}>
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
                <Button size="icon-sm" variant="ghost" aria-label="Sửa" className="bg-muted hover:bg-muted/70">
                  <Pencil />
                </Button>
                <ConfirmDeleteButton label={`bảng "${g.name}"`} />
              </div>
            </div>
            <ul className="space-y-1.5 text-sm">
              {g.entries.map((e, i) => (
                <li key={e + i} className="flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded bg-muted text-sm text-muted-foreground">
                    {i + 1}
                  </span>
                  {e}
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

/* ---------- Schedule ---------- */

const STATUS_META: Record<MatchStatus, { label: string; className: string }> = {
  scheduled: { label: "Chưa đấu", className: "bg-muted text-muted-foreground" },
  done: { label: "Đã xong", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
};

function StatusBadge({ status }: { status: MatchStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${meta.className}`}>
      {meta.label}
    </span>
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

function SetScores({ sets }: { sets: SetScore[] }) {
  if (sets.length === 0) {
    return <span className="text-sm text-muted-foreground">Chưa có kết quả</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {sets.map((s, i) => (
        <span
          key={i}
          className="inline-flex min-w-[36px] items-center justify-center rounded bg-muted px-1.5 py-0.5 text-sm tabular-nums"
        >
          {s.a}-{s.b}
        </span>
      ))}
    </div>
  );
}

type StandingRow = {
  entry: string;
  played: number;
  won: number;
  lost: number;
  diff: number;
  points: number;
};

function computeDoublesStandings(
  entries: string[],
  matches: DoublesMatch[]
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [e, { entry: e, played: 0, won: 0, lost: 0, diff: 0, points: 0 }])
  );
  for (const m of matches) {
    if (m.status !== "done") continue;
    const { a, b } = setsSummary(m.sets);
    const ra = rows.get(m.pairA);
    const rb = rows.get(m.pairB);
    if (!ra || !rb) continue;
    ra.played += 1;
    rb.played += 1;
    ra.diff += a - b;
    rb.diff += b - a;
    if (a > b) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 2;
    } else if (b > a) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 2;
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.diff - x.diff || y.won - x.won
  );
}

function computeTeamStandings(
  entries: string[],
  matches: TeamMatch[]
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [e, { entry: e, played: 0, won: 0, lost: 0, diff: 0, points: 0 }])
  );
  for (const m of matches) {
    if (m.status !== "done") continue;
    const ra = rows.get(m.teamA);
    const rb = rows.get(m.teamB);
    if (!ra || !rb) continue;
    ra.played += 1;
    rb.played += 1;
    ra.diff += m.scoreA - m.scoreB;
    rb.diff += m.scoreB - m.scoreA;
    if (m.scoreA > m.scoreB) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 2;
    } else if (m.scoreB > m.scoreA) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 2;
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.diff - x.diff || y.won - x.won
  );
}

function RankBadge({ rank }: { rank: number; active: boolean }) {
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
      {rank}
    </span>
  );
}

function StandingsCard({
  rows,
  diffLabel,
}: {
  rows: StandingRow[];
  diffLabel: string;
}) {
  const played = rows.some((r) => r.played > 0);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-end justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
            <Trophy className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Bảng xếp hạng</h2>
            <p className="text-sm text-muted-foreground">
              {played ? "Cập nhật theo trận đã chốt" : "Chưa có trận nào chốt"}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Thắng: 2 điểm</div>
      </div>

      <ol className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li
            key={r.entry}
            className="flex items-center gap-3 rounded-lg border bg-card/40 p-3"
          >
            <RankBadge rank={i + 1} active={r.played > 0} />
            <div className="min-w-0 flex-1">
              <div className="font-medium leading-tight">{r.entry}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                <span>{r.played} trận</span>
                <span className="text-green-600 dark:text-green-400">{r.won}T</span>
                <span className="text-red-600 dark:text-red-400">{r.lost}B</span>
                <span
                  title={diffLabel}
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
            <div className="flex shrink-0 flex-col items-end leading-none">
              <span className="text-xl font-semibold tabular-nums">{r.points}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">điểm</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function DoublesSchedule({
  groupId,
  groupName,
  entries,
  matches,
  readOnly,
}: {
  groupId: string;
  groupName: string;
  entries: string[];
  matches: DoublesMatch[];
  readOnly?: boolean;
}) {
  const standings = computeDoublesStandings(entries, matches);
  const color = groupColor(groupId);
  return (
    <div className="flex flex-col gap-4">
      <Card className={`p-4 ${color.border} ${color.bg}`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex size-8 items-center justify-center rounded-lg font-semibold ${color.badge}`}>
              {groupName.replace(/^Bảng\s*/i, "")}
            </span>
            <div>
              <div className="text-sm text-muted-foreground">Bảng đấu</div>
              <div className="font-semibold">{groupName}</div>
            </div>
          </div>
          <Badge variant="secondary">{entries.length} cặp</Badge>
        </div>
        <ol className="space-y-1 text-sm">
          {entries.map((e, i) => (
            <li
              key={e + i}
              className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5"
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">{e}</span>
            </li>
          ))}
        </ol>
      </Card>

      <StandingsCard rows={standings} diffLabel="Hiệu số ván" />

      <div>
        <SectionHeader
          title="Lịch thi đấu vòng bảng"
          subtitle={`${matches.length} trận · vòng tròn`}
        />
        <div className="flex flex-col gap-2">
          {matches.map((m, i) => (
            <DoublesMatchCard
              key={m.id}
              match={m}
              index={i + 1}
              readOnly={readOnly}
              altBg={i % 2 === 1 ? color.rowAlt : ""}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DoublesMatchCard({
  match,
  index,
  readOnly,
  altBg = "",
}: {
  match: DoublesMatch;
  index: number;
  readOnly?: boolean;
  altBg?: string;
}) {
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const locked = status === "done";
  const { a, b } = setsSummary(match.sets);
  const aWon = locked && a > b;
  const bWon = locked && b > a;

  return (
    <Card className={`p-3 ${altBg}`}>
      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Trận {index}</span>
          {match.table != null && <span>· Bàn {match.table}</span>}
          <span>· thắng {Math.ceil(match.bestOf / 2)}/{match.bestOf} ván</span>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div className={`truncate ${aWon ? "font-semibold" : ""}`}>{match.pairA}</div>
          <div className={`truncate ${bWon ? "font-semibold" : ""}`}>{match.pairB}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-xl font-semibold tabular-nums leading-tight">
          <span className={aWon ? "" : "text-muted-foreground"}>
            {match.sets.length ? a : "–"}
          </span>
          <span className={bWon ? "" : "text-muted-foreground"}>
            {match.sets.length ? b : "–"}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <SetScores sets={match.sets} />
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            <EditMatchDialog
              title={`Trận ${index}`}
              participants={`${match.pairA}  vs  ${match.pairB}`}
              sets={match.sets}
              bestOf={match.bestOf}
              table={match.table}
              disabled={locked}
            />
            <LockToggleButton
              locked={locked}
              onToggle={() => setStatus(locked ? "scheduled" : "done")}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

export function TeamSchedule({
  groupId,
  groupName,
  entries,
  matches,
  readOnly,
}: {
  groupId: string;
  groupName: string;
  entries: string[];
  matches: TeamMatch[];
  readOnly?: boolean;
}) {
  const standings = computeTeamStandings(entries, matches);
  const color = groupColor(groupId);
  return (
    <div className="flex flex-col gap-4">
      <Card className={`p-4 ${color.border} ${color.bg}`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex size-8 items-center justify-center rounded-lg font-semibold ${color.badge}`}>
              {groupName.replace(/^Bảng\s*/i, "")}
            </span>
            <div>
              <div className="text-sm text-muted-foreground">Bảng đấu</div>
              <div className="font-semibold">{groupName}</div>
            </div>
          </div>
          <Badge variant="secondary">{entries.length} đội</Badge>
        </div>
        <ol className="space-y-1 text-sm">
          {entries.map((e, i) => (
            <li
              key={e + i}
              className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5"
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">{e}</span>
            </li>
          ))}
        </ol>
      </Card>

      <StandingsCard rows={standings} diffLabel="Hiệu số trận cá nhân" />

      <div>
        <SectionHeader
          title="Lịch thi đấu vòng bảng"
          subtitle={`${matches.length} trận · vòng tròn`}
        />
        <div className="flex flex-col gap-3">
          {matches.map((m, i) => (
            <TeamMatchCard
              key={m.id}
              match={m}
              index={i + 1}
              readOnly={readOnly}
              altBg={i % 2 === 1 ? color.rowAlt : ""}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type TeamRoster = {
  A?: string; B?: string; C?: string;
  X?: string; Y?: string; Z?: string;
};

function rosterAssigned(r: TeamRoster) {
  return !!(r.A && r.B && r.C && r.X && r.Y && r.Z);
}

function lineupNames(lineup: typeof TEAM_MATCH_TEMPLATE[number], r: TeamRoster) {
  if (lineup.kind === "single") {
    return {
      a: r[lineup.slot] ?? lineup.slot,
      b: r[lineup.oppSlot] ?? lineup.oppSlot,
      placeholder: !r[lineup.slot] || !r[lineup.oppSlot],
    };
  }
  const [s1, s2] = lineup.slots;
  const [o1, o2] = lineup.oppSlots;
  const aName1 = r[s1] ?? s1;
  const aName2 = r[s2] ?? s2;
  const bName1 = r[o1] ?? o1;
  const bName2 = r[o2] ?? o2;
  return {
    a: `${aName1} / ${aName2}`,
    b: `${bName1} / ${bName2}`,
    placeholder: !r[s1] || !r[s2] || !r[o1] || !r[o2],
  };
}

function TeamMatchCard({
  match,
  index,
  readOnly,
  altBg = "",
}: {
  match: TeamMatch;
  index: number;
  readOnly?: boolean;
  altBg?: string;
}) {
  const aWon = match.status === "done" && match.scoreA > match.scoreB;
  const bWon = match.status === "done" && match.scoreB > match.scoreA;
  const teamA = MOCK_TEAMS.find((t) => t.name === match.teamA);
  const teamB = MOCK_TEAMS.find((t) => t.name === match.teamB);
  const [roster, setRoster] = useState<TeamRoster>({});
  const assigned = rosterAssigned(roster);

  return (
    <Card className={`p-3 ${altBg}`}>
      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Trận {index}</span>
          {match.table != null && <span>· Bàn {match.table}</span>}
        </div>
        <StatusBadge status={match.status} />
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div className={`truncate ${aWon ? "font-semibold" : ""}`}>{match.teamA}</div>
          <div className={`truncate ${bWon ? "font-semibold" : ""}`}>{match.teamB}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-xl font-semibold tabular-nums leading-tight">
          <span className={aWon ? "" : "text-muted-foreground"}>{match.scoreA}</span>
          <span className={bWon ? "" : "text-muted-foreground"}>{match.scoreB}</span>
        </div>
      </div>

      {!assigned && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-amber-500/10 px-2 py-1.5 text-sm">
          <span className="text-amber-700 dark:text-amber-300">⚠ Chưa gán đội hình</span>
          {!readOnly && teamA && teamB && (
            <AssignRosterDialog
              teamA={teamA}
              teamB={teamB}
              roster={roster}
              onSave={setRoster}
            />
          )}
        </div>
      )}

      <details className="mt-2 group" open={assigned}>
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm text-muted-foreground">
          <span>Chi tiết 3 lượt {assigned ? "" : "(slot)"}</span>
          <div className="flex items-center gap-2">
            {assigned && !readOnly && teamA && teamB && (
              <AssignRosterDialog
                teamA={teamA}
                teamB={teamB}
                roster={roster}
                onSave={setRoster}
                trigger={
                  <Button size="xs" variant="ghost" type="button">
                    Sửa đội hình
                  </Button>
                }
              />
            )}
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          </div>
        </summary>
        <ul className="mt-2 flex flex-col gap-1.5">
          {match.individual.map((im, i) => {
            const lineup = TEAM_MATCH_TEMPLATE[i];
            const names = lineupNames(lineup, roster);
            return (
              <IndividualMatchRow
                key={im.id}
                match={{ ...im, playerA: names.a, playerB: names.b }}
                readOnly={readOnly}
                placeholder={names.placeholder}
                slotHint={
                  lineup.kind === "single"
                    ? `${lineup.slot} vs ${lineup.oppSlot}`
                    : `${lineup.slots.join("+")} vs ${lineup.oppSlots.join("+")}`
                }
              />
            );
          })}
        </ul>
      </details>
    </Card>
  );
}

function AssignRosterDialog({
  teamA,
  teamB,
  roster,
  onSave,
  trigger,
}: {
  teamA: Team;
  teamB: Team;
  roster: TeamRoster;
  onSave: (r: TeamRoster) => void;
  trigger?: React.ReactElement;
}) {
  const [draft, setDraft] = useState<TeamRoster>(roster);
  const set = (slot: keyof TeamRoster, v: string) =>
    setDraft((d) => ({ ...d, [slot]: v || undefined }));

  const slotsA: TeamSlot[] = ["A", "B", "C"];
  const slotsB: OppSlot[] = ["X", "Y", "Z"];

  return (
    <Dialog>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" variant="outline" type="button">
              Gán đội hình
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gán đội hình</DialogTitle>
          <DialogDescription>
            Mỗi đội 3 VĐV được xếp vào 3 slot. Đôi: B+C vs Y+Z · Đơn 1: A vs X · Đơn 2: C vs Z.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-semibold">{teamA.name}</div>
            {slotsA.map((s) => (
              <SlotSelect
                key={s}
                slot={s}
                value={draft[s]}
                options={teamA.members}
                onChange={(v) => set(s, v)}
              />
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">{teamB.name}</div>
            {slotsB.map((s) => (
              <SlotSelect
                key={s}
                slot={s}
                value={draft[s]}
                options={teamB.members}
                onChange={(v) => set(s, v)}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Huỷ</DialogClose>
          <DialogClose render={<Button type="button" onClick={() => onSave(draft)}>Lưu</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SlotSelect({
  slot,
  value,
  options,
  onChange,
}: {
  slot: string;
  value?: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-semibold">
        {slot}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
      >
        <option value="">— Chọn VĐV —</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function IndividualMatchRow({
  match,
  readOnly,
  placeholder,
  slotHint,
}: {
  match: IndividualMatch;
  readOnly?: boolean;
  placeholder?: boolean;
  slotHint?: string;
}) {
  const [locked, setLocked] = useState(match.sets.length > 0);
  const { a, b } = setsSummary(match.sets);
  const aWon = locked && a > b;
  const bWon = locked && b > a;
  return (
    <li className="rounded-md border p-2">
      <div className="mb-1 flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          {match.label}
          {slotHint && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
              {slotHint}
            </span>
          )}
          {locked && <Lock className="size-3 text-muted-foreground" />}
        </span>
        <span>thắng {Math.ceil(match.bestOf / 2)}/{match.bestOf} ván</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className={`truncate ${aWon ? "font-semibold" : ""} ${placeholder ? "italic text-muted-foreground" : ""}`}>{match.playerA}</div>
          <div className={`truncate ${bWon ? "font-semibold" : ""} ${placeholder ? "italic text-muted-foreground" : ""}`}>{match.playerB}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end font-semibold tabular-nums leading-tight">
          <span className={aWon ? "" : "text-muted-foreground"}>{match.sets.length ? a : "–"}</span>
          <span className={bWon ? "" : "text-muted-foreground"}>{match.sets.length ? b : "–"}</span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <SetScores sets={match.sets} />
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            <EditMatchDialog
              title={match.label}
              participants={`${match.playerA}  vs  ${match.playerB}`}
              sets={match.sets}
              bestOf={match.bestOf}
              compact
              disabled={locked}
            />
            <LockToggleButton compact locked={locked} onToggle={() => setLocked((v) => !v)} />
          </div>
        )}
      </div>
    </li>
  );
}

function LockToggleButton({
  locked,
  onToggle,
  compact,
}: {
  locked: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  if (locked) {
    return (
      <Button
        type="button"
        onClick={onToggle}
        variant="ghost"
        size={compact ? "icon-xs" : "icon-sm"}
        aria-label="Mở lại để sửa"
        title="Mở lại để sửa"
        className="bg-muted hover:bg-muted/70"
      >
        <LockOpen />
      </Button>
    );
  }
  return (
    <Button
      type="button"
      onClick={onToggle}
      size={compact ? "xs" : "sm"}
      variant="outline"
      aria-label="Chốt kết quả"
    >
      <CheckCircle2 /> Chốt
    </Button>
  );
}

function EditMatchDialog({
  title,
  participants,
  sets,
  bestOf,
  table,
  compact,
  disabled,
}: {
  title: string;
  participants?: string;
  sets: SetScore[];
  bestOf: 3 | 5;
  table?: number;
  compact?: boolean;
  disabled?: boolean;
}) {
  const minRows = Math.ceil(bestOf / 2); // tối thiểu = số ván cần thắng
  const initial: Array<{ a: string; b: string }> =
    sets.length > 0
      ? sets.map((s) => ({ a: String(s.a), b: String(s.b) }))
      : Array.from({ length: minRows }, () => ({ a: "", b: "" }));
  const [rows, setRows] = useState(initial);
  const updateRow = (i: number, side: "a" | "b", v: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [side]: v } : r)));
  const addRow = () => setRows((rs) => [...rs, { a: "", b: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  return (
    <Dialog>
      <DialogTrigger
        disabled={disabled}
        render={
          <Button
            size={compact ? "icon-xs" : "icon-sm"}
            variant="ghost"
            aria-label="Sửa tỉ số"
            disabled={disabled}
            className="bg-muted hover:bg-muted/70"
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa tỉ số · {title}</DialogTitle>
          <DialogDescription>
            {participants ? (
              <span className="block font-medium text-foreground">{participants}</span>
            ) : null}
            <span className="block">
              Thắng {Math.ceil(bestOf / 2)}/{bestOf} ván · nhập tỉ số từng ván.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {table !== undefined && (
            <div className="grid gap-1.5">
              <Label htmlFor="table">Bàn số</Label>
              <Input id="table" defaultValue={table} />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Tỉ số các ván</Label>
            {rows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[3rem_1fr_auto_1fr_auto] items-center gap-2"
              >
                <span className="text-sm text-muted-foreground">Ván {i + 1}</span>
                <Input
                  value={row.a}
                  onChange={(e) => updateRow(i, "a", e.target.value)}
                  inputMode="numeric"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  value={row.b}
                  onChange={(e) => updateRow(i, "b", e.target.value)}
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Xoá ván"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 1}
                  className="bg-destructive/10 hover:bg-destructive/20"
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus /> Thêm ván
            </Button>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Huỷ</DialogClose>
          <Button type="button">Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Knockout ---------- */

const ROUND_ORDER: Array<KnockoutMatch["round"]> = ["qf", "sf", "f"];

const ROUND_STYLE: Record<
  KnockoutMatch["round"],
  { chip: string; border: string; bg: string; accent: string }
> = {
  qf: {
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    border: "border-sky-500/30",
    bg: "bg-sky-500/5",
    accent: "border-l-sky-500",
  },
  sf: {
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    accent: "border-l-amber-500",
  },
  f: {
    chip: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/10",
    accent: "border-l-yellow-500",
  },
};

function KnockoutSection({
  kind,
  matches,
  note,
}: {
  kind: Content;
  matches: KnockoutMatch[];
  note?: string;
}) {
  return (
    <div>
      <SectionHeader
        title="Vòng loại trực tiếp"
        subtitle={`${matches.length} trận · ${ROUND_ORDER.filter((r) => matches.some((m) => m.round === r)).map((r) => ROUND_LABEL[r]).join(" → ")}`}
      />
      <div className="flex flex-col gap-5">
        {ROUND_ORDER.map((round) => {
          const list = matches.filter((m) => m.round === round);
          if (list.length === 0) return null;
          const s = ROUND_STYLE[round];
          return (
            <div key={round} className={`rounded-xl border p-3 ${s.border} ${s.bg}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${s.chip}`}>
                  {ROUND_LABEL[round]}
                </span>
                <span className="text-sm text-muted-foreground">{list.length} trận</span>
              </div>
              <div className="flex flex-col gap-2">
                {list.map((m, i) => (
                  <KnockoutMatchCard key={m.id} match={m} index={i + 1} kind={kind} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {note && (
        <p className="mt-3 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ {note}
        </p>
      )}
    </div>
  );
}

function KnockoutMatchCard({
  match,
  index,
  kind,
}: {
  match: KnockoutMatch;
  index: number;
  kind: Content;
}) {
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [roster, setRoster] = useState<TeamRoster>({});
  const locked = status === "done";
  const nameA = match.entryA ?? match.labelA;
  const nameB = match.entryB ?? match.labelB;
  const placeholderA = !match.entryA;
  const placeholderB = !match.entryB;

  const isTeam = kind === "teams";
  const teamA = match.entryA ? MOCK_TEAMS.find((t) => t.name === match.entryA) : undefined;
  const teamB = match.entryB ? MOCK_TEAMS.find((t) => t.name === match.entryB) : undefined;
  const canAssign = isTeam && !!teamA && !!teamB;
  const assigned = canAssign && rosterAssigned(roster);
  let scoreA = 0;
  let scoreB = 0;
  if (isTeam && match.individual) {
    for (const im of match.individual) {
      const { a, b } = setsSummary(im.sets);
      if (im.sets.length > 0) {
        if (a > b) scoreA += 1;
        else if (b > a) scoreB += 1;
      }
    }
  } else {
    const s = setsSummary(match.sets);
    scoreA = s.a;
    scoreB = s.b;
  }
  const aWon = locked && scoreA > scoreB;
  const bWon = locked && scoreB > scoreA;
  const accent = ROUND_STYLE[match.round].accent;

  return (
    <Card className={`border-l-4 p-3 ${accent}`}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {ROUND_LABEL[match.round]} {index}
          </span>
          {match.table != null && <span>· Bàn {match.table}</span>}
          <span>· thắng {Math.ceil(match.bestOf / 2)}/{match.bestOf} ván</span>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div
            className={`truncate ${aWon ? "font-semibold" : ""} ${placeholderA ? "italic text-muted-foreground" : ""}`}
          >
            {nameA}
          </div>
          <div
            className={`truncate ${bWon ? "font-semibold" : ""} ${placeholderB ? "italic text-muted-foreground" : ""}`}
          >
            {nameB}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-xl font-semibold tabular-nums leading-tight">
          <span className={aWon ? "" : "text-muted-foreground"}>
            {locked || scoreA + scoreB > 0 ? scoreA : "–"}
          </span>
          <span className={bWon ? "" : "text-muted-foreground"}>
            {locked || scoreA + scoreB > 0 ? scoreB : "–"}
          </span>
        </div>
      </div>

      {isTeam && match.individual && (
        <>
          {!canAssign && (
            <div className="mt-2 rounded-md bg-muted px-2 py-1.5 text-sm text-muted-foreground">
              ⌛ Cần xác định đội thắng vòng trước
            </div>
          )}
          {canAssign && !assigned && (
            <div className="mt-2 flex items-center justify-between rounded-md bg-amber-500/10 px-2 py-1.5 text-sm">
              <span className="text-amber-700 dark:text-amber-300">⚠ Chưa gán đội hình</span>
              <AssignRosterDialog
                teamA={teamA!}
                teamB={teamB!}
                roster={roster}
                onSave={setRoster}
              />
            </div>
          )}
          <details className="group mt-2" open={assigned}>
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm text-muted-foreground">
              <span>Chi tiết 3 lượt {assigned ? "" : "(slot)"}</span>
              <div className="flex items-center gap-2">
                {assigned && (
                  <AssignRosterDialog
                    teamA={teamA!}
                    teamB={teamB!}
                    roster={roster}
                    onSave={setRoster}
                    trigger={
                      <Button size="xs" variant="ghost" type="button">
                        Sửa đội hình
                      </Button>
                    }
                  />
                )}
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
              </div>
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {match.individual.map((im, i) => {
                const lineup = TEAM_MATCH_TEMPLATE[i];
                const names = lineupNames(lineup, roster);
                return (
                  <IndividualMatchRow
                    key={im.id}
                    match={{ ...im, playerA: names.a, playerB: names.b }}
                    placeholder={names.placeholder}
                    slotHint={
                      lineup.kind === "single"
                        ? `${lineup.slot} vs ${lineup.oppSlot}`
                        : `${lineup.slots.join("+")} vs ${lineup.oppSlots.join("+")}`
                    }
                  />
                );
              })}
            </ul>
          </details>
        </>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <SetScores sets={isTeam ? [] : match.sets} />
        <div className="flex shrink-0 items-center gap-1">
          {!isTeam && (
            <EditMatchDialog
              title={`${ROUND_LABEL[match.round]} ${index}`}
              participants={`${nameA}  vs  ${nameB}`}
              sets={match.sets}
              bestOf={match.bestOf}
              table={match.table}
              disabled={locked}
            />
          )}
          <LockToggleButton
            locked={locked}
            onToggle={() => setStatus(locked ? "scheduled" : "done")}
          />
        </div>
      </div>
    </Card>
  );
}

/* ---------- Shared ---------- */

export function ConfirmDeleteButton({
  label,
  onConfirm,
  disabled,
}: {
  label: string;
  onConfirm?: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Xoá"
            className="bg-muted hover:bg-muted/70 text-destructive"
            disabled={disabled}
          />
        }
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xoá {label}?</DialogTitle>
          <DialogDescription>Hành động này không thể hoàn tác.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" disabled={pending} />}>
            Huỷ
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              if (!onConfirm) {
                setOpen(false);
                return;
              }
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                /* toasted by handler */
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
