"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Radio,
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
  IndividualMatch,
  KnockoutMatch,
  MatchStatus,
  OppSlot,
  Player,
  Team,
  TeamSlot,
} from "./_mock";
import { MOCK_TEAMS, ROUND_LABEL, TEAM_MATCH_TEMPLATE } from "./_mock";
import type { PairWithNames } from "@/lib/schemas/pair";
import type { TeamWithNames } from "@/lib/schemas/team";
import type { GroupResolved } from "@/lib/schemas/group";
import type {
  MatchResolved,
  TeamMatchResolved,
  SubMatchResolved,
  Status,
  SetScore,
  BestOf,
} from "@/lib/schemas/match";
import { patchDoublesMatch, patchTeamMatch } from "./_match-actions";
import { deriveTeamScore, deriveTeamWinner } from "@/lib/matches/derive";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { PlayerPicker } from "./_player-picker";
import { computeDoublesStandings, computeTeamStandings } from "@/lib/standings/compute";
import type { StandingRow } from "@/lib/standings/types";
import { groupColor } from "../_groupColors";
import { PlayersSection } from "./_players-section";
import { PairsSection } from "./_pairs-section";
import { TeamsSection } from "./_teams-section";
import { GroupsSection } from "./_groups-section";

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
  groups: GroupResolved[];
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
        <GroupsSection kind={kind} groups={groups} pairs={pairs} teams={teams} />
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

/* ---------- Bảng đấu: extracted to _groups-section.tsx ---------- */

/* ---------- Schedule ---------- */

const STATUS_META: Record<Status, { label: string; className: string }> = {
  scheduled: { label: "Chưa đấu", className: "bg-muted text-muted-foreground" },
  live: { label: "Đang đấu", className: "bg-red-500/15 text-red-600 dark:text-red-400 animate-pulse" },
  done: { label: "Đã xong", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  forfeit: { label: "Bỏ cuộc", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "idle") return null;
  const map: Record<Exclude<SaveState, "idle">, { label: string; className: string }> = {
    pending: {
      label: "● Chưa lưu",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    },
    saving: {
      label: "Đang lưu...",
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    },
    saved: {
      label: "✓ Đã lưu",
      className: "bg-green-500/15 text-green-700 dark:text-green-400",
    },
    error: {
      label: error ? `✕ ${error}` : "✕ Lỗi",
      className: "bg-destructive/15 text-destructive",
    },
  };
  const meta = map[state];
  return (
    <span className={`inline-flex max-w-[14rem] items-center truncate rounded-full px-1.5 py-0.5 text-xs ${meta.className}`}>
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
        <div className="text-xs text-muted-foreground">Thắng: 1 điểm</div>
      </div>

      <ol className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li
            key={r.entryId}
            className="flex items-center gap-3 rounded-lg border bg-card/40 p-3"
          >
            <RankBadge rank={r.rank} active={r.played > 0} />
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
  matches: initialMatches,
  readOnly,
}: {
  groupId: string;
  groupName: string;
  entries: { id: string; label: string }[];
  matches: MatchResolved[];
  readOnly?: boolean;
}) {
  const [matches, setMatches] = useState(initialMatches);
  const handleMatchUpdated = (updated: MatchResolved) => {
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };
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
              key={e.id}
              className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5"
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">{e.label}</span>
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
              onMatchUpdated={handleMatchUpdated}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DoublesMatchCard({
  match: initialMatch,
  index,
  readOnly,
  altBg = "",
  onMatchUpdated,
}: {
  match: MatchResolved;
  index: number;
  readOnly?: boolean;
  altBg?: string;
  onMatchUpdated?: (m: MatchResolved) => void;
}) {
  const [match, setMatch] = useState<MatchResolved>(initialMatch);
  const [pending, setPending] = useState(false);
  const status = match.status;
  const locked = status === "done" || status === "forfeit";
  const live = status === "live";
  const { a, b } = setsSummary(match.sets);
  const aWon = locked && (status === "forfeit"
    ? match.winner?.id === match.pairA.id
    : a > b);
  const bWon = locked && (status === "forfeit"
    ? match.winner?.id === match.pairB.id
    : b > a);

  const save = async (body: {
    sets?: SetScore[];
    status?: Status;
    winner?: string | null;
  }) => {
    if (readOnly) return false;
    const prev = match;
    setPending(true);
    try {
      const updated = await patchDoublesMatch(match.id, body);
      setMatch(updated);
      onMatchUpdated?.(updated);
      toast.success("Đã lưu");
      return true;
    } catch (e) {
      setMatch(prev);
      toast.error(e instanceof Error ? e.message : "Lỗi");
      return false;
    } finally {
      setPending(false);
    }
  };

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
          <div className={`truncate ${aWon ? "font-semibold" : ""}`}>{match.pairA.label}</div>
          <div className={`truncate ${bWon ? "font-semibold" : ""}`}>{match.pairB.label}</div>
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
            <EditDoublesMatchDialog
              title={`Trận ${index}`}
              match={match}
              disabled={pending}
              onSave={save}
            />
            {(match.sets.length > 0 || status !== "scheduled") && (
              <ClearResultButton
                disabled={pending}
                onConfirm={async () => {
                  await save({ sets: [], status: "scheduled", winner: null });
                }}
              />
            )}
            <LiveToggleButton
              live={live}
              disabled={pending}
              onToggle={() =>
                save({ status: live ? "scheduled" : "live" })
              }
            />
            <LockToggleButton
              locked={locked}
              disabled={pending}
              onToggle={() =>
                save({ status: locked ? "scheduled" : "done" })
              }
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
  matches: initialMatches,
  teamPlayersByTeamId = {},
  readOnly,
}: {
  groupId: string;
  groupName: string;
  entries: { id: string; label: string }[];
  matches: TeamMatchResolved[];
  teamPlayersByTeamId?: Record<string, Array<{ id: string; name: string }>>;
  readOnly?: boolean;
}) {
  const [matches, setMatches] = useState(initialMatches);
  const handleMatchUpdated = (updated: TeamMatchResolved) => {
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };
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
              key={e.id}
              className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5"
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">{e.label}</span>
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
              teamAPlayers={teamPlayersByTeamId[m.teamA.id] ?? []}
              teamBPlayers={teamPlayersByTeamId[m.teamB.id] ?? []}
              onMatchUpdated={handleMatchUpdated}
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

function subMatchToPatch(s: SubMatchResolved) {
  return {
    id: s.id,
    label: s.label,
    kind: s.kind,
    playersA: s.playersA.map((p) => p.id),
    playersB: s.playersB.map((p) => p.id),
    bestOf: s.bestOf,
    sets: s.sets,
  };
}

function TeamMatchCard({
  match: initialMatch,
  index,
  readOnly,
  altBg = "",
  teamAPlayers,
  teamBPlayers,
  onMatchUpdated,
}: {
  match: TeamMatchResolved;
  index: number;
  readOnly?: boolean;
  altBg?: string;
  teamAPlayers: Array<{ id: string; name: string }>;
  teamBPlayers: Array<{ id: string; name: string }>;
  onMatchUpdated?: (m: TeamMatchResolved) => void;
}) {
  const [match, setMatch] = useState<TeamMatchResolved>(initialMatch);
  const [subs, setSubs] = useState<SubMatchResolved[]>(initialMatch.individual);
  const [status, setStatus] = useState<Status>(initialMatch.status);
  const [winnerId, setWinnerId] = useState<string | null>(
    initialMatch.winner?.id ?? null,
  );
  const [pending, setPending] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const changedSinceInFlight = useRef(false);
  const savedIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs mirror latest state so the debounced save reads fresh values
  // (not the captured values from the render where scheduleSave was called).
  const subsRef = useRef(subs);
  const statusRef = useRef(status);
  const winnerIdRef = useRef(winnerId);
  useEffect(() => {
    subsRef.current = subs;
  }, [subs]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    winnerIdRef.current = winnerId;
  }, [winnerId]);

  const live = status === "live";

  // Live preview score/winner từ local subs state (không chờ server)
  const patchSubs = subs.map(subMatchToPatch);
  const { scoreA: liveScoreA, scoreB: liveScoreB } = deriveTeamScore(
    patchSubs,
    match.teamA.id,
    match.teamB.id,
  );
  const liveWinnerId =
    status === "forfeit"
      ? winnerId
      : deriveTeamWinner(patchSubs, match.teamA.id, match.teamB.id);
  const aWon = liveWinnerId === match.teamA.id;
  const bWon = liveWinnerId === match.teamB.id;

  const doSave = async (nextStatus: Status, nextWinnerId: string | null, nextSubs: SubMatchResolved[]) => {
    if (nextStatus === "forfeit" && !nextWinnerId) {
      setSaveState("error");
      setSaveError("Forfeit cần chọn đội thắng");
      return;
    }
    inFlight.current = true;
    changedSinceInFlight.current = false;
    setSaveState("saving");
    setPending(true);
    setSaveError(null);
    try {
      const updated = await patchTeamMatch(match.id, {
        individual: nextSubs.map(subMatchToPatch),
        status: nextStatus,
        winner: nextStatus === "forfeit" ? nextWinnerId : null,
      });
      setMatch(updated);
      onMatchUpdated?.(updated);
      setSubs(updated.individual);
      setStatus(updated.status);
      setWinnerId(updated.winner?.id ?? null);
      if (changedSinceInFlight.current) {
        // Fire a follow-up save with whatever is now in state.
        inFlight.current = false;
        scheduleSave();
        return;
      }
      setSaveState("saved");
      if (savedIndicatorTimer.current) clearTimeout(savedIndicatorTimer.current);
      savedIndicatorTimer.current = setTimeout(() => {
        setSaveState((s) => (s === "saved" ? "idle" : s));
      }, 1500);
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Lỗi");
      toast.error(e instanceof Error ? e.message : "Lỗi");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const scheduleSave = () => {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("pending");
    saveTimer.current = setTimeout(() => {
      if (inFlight.current) {
        changedSinceInFlight.current = true;
        return;
      }
      void doSave(statusRef.current, winnerIdRef.current, subsRef.current);
    }, 400);
  };

  const saveNow = (overrideStatus?: Status, overrideWinnerId?: string | null) => {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const s = overrideStatus ?? statusRef.current;
    const w =
      overrideWinnerId !== undefined ? overrideWinnerId : winnerIdRef.current;
    if (overrideStatus !== undefined) {
      setStatus(s);
      statusRef.current = s;
    }
    if (overrideWinnerId !== undefined) {
      setWinnerId(w);
      winnerIdRef.current = w;
    }
    if (inFlight.current) {
      changedSinceInFlight.current = true;
      return;
    }
    void doSave(s, w, subsRef.current);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedIndicatorTimer.current) clearTimeout(savedIndicatorTimer.current);
    };
  }, []);

  const toggleLive = () => {
    if (readOnly || pending) return;
    saveNow(live ? "scheduled" : "live");
  };

  const applySubs = (updater: (prev: SubMatchResolved[]) => SubMatchResolved[]) => {
    setSubs((prev) => {
      const next = updater(prev);
      subsRef.current = next;
      return next;
    });
  };
  const updateSub = (subId: string, patch: Partial<SubMatchResolved>) => {
    applySubs((prev) => prev.map((s) => (s.id === subId ? { ...s, ...patch } : s)));
    scheduleSave();
  };
  const removeSub = (subId: string) => {
    applySubs((prev) => prev.filter((s) => s.id !== subId));
    scheduleSave();
  };
  const addSub = () => {
    applySubs((prev) => [
      ...prev,
      {
        id: `${match.id}-${nanoid(6)}`,
        label: "Sub mới",
        kind: "singles",
        playersA: [],
        playersB: [],
        bestOf: 3,
        sets: [],
      },
    ]);
    scheduleSave();
  };
  const changeStatus = (s: Status) => {
    setStatus(s);
    if (s !== "forfeit") setWinnerId(null);
    saveNow(s, s !== "forfeit" ? null : winnerId);
  };
  const changeWinner = (id: string) => {
    setWinnerId(id);
    if (status === "forfeit") saveNow(status, id);
  };

  const canFinalize = !!liveWinnerId && status !== "done" && status !== "forfeit";
  const finalize = () => saveNow("done", null);
  const unlockMatch = () => saveNow("scheduled", null);

  const hasResult =
    status !== "scheduled" || subs.some((s) => s.sets.length > 0);
  const clearResult = async () => {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const clearedSubs = subsRef.current.map((s) => ({ ...s, sets: [] }));
    applySubs(() => clearedSubs);
    setStatus("scheduled");
    statusRef.current = "scheduled";
    setWinnerId(null);
    winnerIdRef.current = null;
    if (inFlight.current) {
      changedSinceInFlight.current = true;
      return;
    }
    await doSave("scheduled", null, clearedSubs);
  };

  return (
    <Card className={`p-3 ${altBg}`}>
      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Trận {index}</span>
          {match.table != null && <span>· Bàn {match.table}</span>}
          {!readOnly && <SaveIndicator state={saveState} error={saveError} />}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <LiveToggleButton
              live={live}
              compact
              disabled={pending}
              onToggle={toggleLive}
            />
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {!readOnly && (status === "done" || status === "forfeit" || canFinalize || hasResult) && (
        <div className="mb-2 flex items-center justify-end gap-2">
          {hasResult && (
            <ClearResultButton
              disabled={pending}
              onConfirm={clearResult}
            />
          )}
          {status === "done" || status === "forfeit" ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={unlockMatch}
              disabled={pending}
              className="bg-muted hover:bg-muted/70"
            >
              <LockOpen /> Mở lại
            </Button>
          ) : canFinalize ? (
            <Button
              type="button"
              size="xs"
              onClick={finalize}
              disabled={pending}
            >
              <CheckCircle2 /> Chốt trận
            </Button>
          ) : null}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div className={`truncate ${aWon ? "font-semibold" : ""}`}>{match.teamA.name}</div>
          <div className={`truncate ${bWon ? "font-semibold" : ""}`}>{match.teamB.name}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-xl font-semibold tabular-nums leading-tight">
          <span className={aWon ? "" : "text-muted-foreground"}>{liveScoreA}</span>
          <span className={bWon ? "" : "text-muted-foreground"}>{liveScoreB}</span>
        </div>
      </div>

      <details className="mt-2 group" open>
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm text-muted-foreground">
          <span>Chi tiết {subs.length} lượt</span>
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        </summary>

        {!readOnly && (
          <div className="mt-2 grid gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Trạng thái
              </Label>
              {(["scheduled", "live", "done", "forfeit"] as const).map((s) => (
                <label
                  key={s}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                    status === s ? "border-primary bg-primary/5" : "border-input"
                  }`}
                >
                  <input
                    type="radio"
                    name={`status-${match.id}`}
                    value={s}
                    checked={status === s}
                    onChange={() => changeStatus(s)}
                    className="size-3"
                  />
                  {STATUS_META[s].label}
                </label>
              ))}
            </div>
            {status === "forfeit" && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Đội thắng
                </Label>
                {[match.teamA, match.teamB].map((t) => (
                  <label
                    key={t.id}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                      winnerId === t.id ? "border-primary bg-primary/5" : "border-input"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`winner-${match.id}`}
                      value={t.id}
                      checked={winnerId === t.id}
                      onChange={() => changeWinner(t.id)}
                      className="size-3"
                    />
                    <span className="truncate">{t.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <ul className="mt-2 flex flex-col gap-1.5">
          {subs.map((sub) => (
            <TeamSubMatchRow
              key={sub.id}
              sub={sub}
              readOnly={readOnly}
              teamAPlayers={teamAPlayers}
              teamBPlayers={teamBPlayers}
              canDelete={subs.length > 1}
              onChange={(patch) => updateSub(sub.id, patch)}
              onDelete={() => removeSub(sub.id)}
            />
          ))}
        </ul>

        {!readOnly && (
          <div className="mt-2 flex items-center justify-start gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addSub}
              disabled={pending}
            >
              <Plus /> Thêm sub
            </Button>
          </div>
        )}
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

function TeamSubMatchRow({
  sub,
  readOnly,
  teamAPlayers,
  teamBPlayers,
  canDelete,
  onChange,
  onDelete,
}: {
  sub: SubMatchResolved;
  readOnly?: boolean;
  teamAPlayers: Array<{ id: string; name: string }>;
  teamBPlayers: Array<{ id: string; name: string }>;
  canDelete: boolean;
  onChange: (patch: Partial<SubMatchResolved>) => void;
  onDelete: () => void;
}) {
  const { a, b } = setsSummary(sub.sets);
  const hasResult = sub.sets.length > 0;
  const aWon = hasResult && a > b;
  const bWon = hasResult && b > a;
  const playerCount: 1 | 2 = sub.kind === "doubles" ? 2 : 1;

  const renderPlayers = (players: SubMatchResolved["playersA"], pool: typeof teamAPlayers, side: "A" | "B") => {
    if (readOnly) {
      const display =
        players.length === 0
          ? "—"
          : players.map((p) => p.name).join(" / ");
      return <span className="truncate">{display}</span>;
    }
    return (
      <PlayerPicker
        options={pool}
        value={players.map((p) => p.id)}
        count={playerCount}
        label={`${sub.label} · Đội ${side}`}
        onChange={(ids) => {
          const next = ids
            .map((id) => pool.find((o) => o.id === id))
            .filter((p): p is { id: string; name: string } => !!p);
          onChange(side === "A" ? { playersA: next } : { playersB: next });
        }}
      />
    );
  };

  return (
    <li className="rounded-md border p-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {readOnly ? (
          <span className="font-medium text-foreground">{sub.label}</span>
        ) : (
          <Input
            value={sub.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="h-7 max-w-[10rem] text-sm"
          />
        )}
        <div className="flex items-center gap-2">
          {!readOnly && (
            <select
              value={sub.kind}
              onChange={(e) => {
                const kind = e.target.value as "singles" | "doubles";
                const limit: 1 | 2 = kind === "doubles" ? 2 : 1;
                onChange({
                  kind,
                  playersA: sub.playersA.slice(0, limit),
                  playersB: sub.playersB.slice(0, limit),
                });
              }}
              className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
            >
              <option value="singles">Đơn</option>
              <option value="doubles">Đôi</option>
            </select>
          )}
          <span className="text-xs">thắng {Math.ceil(sub.bestOf / 2)}/{sub.bestOf} ván</span>
          {!readOnly && (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Xoá sub"
              disabled={!canDelete}
              onClick={onDelete}
              className="bg-destructive/10 hover:bg-destructive/20"
            >
              <Trash2 className="text-destructive" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <div className="min-w-0 flex-1 space-y-1">
          <div className={`min-w-0 ${aWon ? "font-semibold" : ""}`}>
            {renderPlayers(sub.playersA, teamAPlayers, "A")}
          </div>
          <div className={`min-w-0 ${bWon ? "font-semibold" : ""}`}>
            {renderPlayers(sub.playersB, teamBPlayers, "B")}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end font-semibold tabular-nums leading-tight">
          <span className={aWon ? "" : "text-muted-foreground"}>{hasResult ? a : "–"}</span>
          <span className={bWon ? "" : "text-muted-foreground"}>{hasResult ? b : "–"}</span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <SetScores sets={sub.sets} />
        {!readOnly && (
          <SubSetsEditor
            sub={sub}
            onSetsChange={(sets) => onChange({ sets })}
            onBestOfChange={(bestOf) => onChange({ bestOf })}
          />
        )}
      </div>
    </li>
  );
}

function SubSetsEditor({
  sub,
  onSetsChange,
  onBestOfChange,
}: {
  sub: SubMatchResolved;
  onSetsChange: (sets: SetScore[]) => void;
  onBestOfChange: (bestOf: BestOf) => void;
}) {
  const [open, setOpen] = useState(false);
  const minRows = Math.ceil(sub.bestOf / 2);
  const initialRows: Array<{ a: string; b: string }> =
    sub.sets.length > 0
      ? sub.sets.map((s) => ({ a: String(s.a), b: String(s.b) }))
      : Array.from({ length: minRows }, () => ({ a: "", b: "" }));
  const [rows, setRows] = useState(initialRows);

  const reset = () => setRows(initialRows);
  const updateRow = (i: number, side: "a" | "b", v: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [side]: v } : r)));
  const addRow = () => setRows((rs) => [...rs, { a: "", b: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const apply = () => {
    onSetsChange(parseSetsRows(rows));
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Sửa tỉ số"
            className="bg-muted hover:bg-muted/70"
          />
        }
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa tỉ số · {sub.label}</DialogTitle>
          <DialogDescription>
            Thắng {Math.ceil(sub.bestOf / 2)}/{sub.bestOf} ván · nhập tỉ số từng ván.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Best of</Label>
            <div className="flex gap-2">
              {([3, 5] as const).map((b) => (
                <label
                  key={b}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${
                    sub.bestOf === b ? "border-primary bg-primary/5" : "border-input"
                  }`}
                >
                  <input
                    type="radio"
                    name={`bestof-${sub.id}`}
                    value={b}
                    checked={sub.bestOf === b}
                    onChange={() => onBestOfChange(b)}
                    className="size-3.5"
                  />
                  Thắng {Math.ceil(b / 2)}/{b}
                </label>
              ))}
            </div>
          </div>
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
          <Button type="button" onClick={apply}>Áp dụng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LockToggleButton({
  locked,
  onToggle,
  compact,
  disabled,
}: {
  locked: boolean;
  onToggle: () => void;
  compact?: boolean;
  disabled?: boolean;
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
        disabled={disabled}
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
      disabled={disabled}
    >
      <CheckCircle2 /> Chốt
    </Button>
  );
}

function ClearResultButton({
  disabled,
  onConfirm,
}: {
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={disabled}
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Xoá kết quả"
            title="Xoá kết quả"
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400"
            disabled={disabled}
          />
        }
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xoá kết quả trận này?</DialogTitle>
          <DialogDescription>
            Tất cả set + winner sẽ bị xoá, trận về trạng thái &quot;Chưa đấu&quot;.
            Không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" type="button" disabled={pending} />}
          >
            Huỷ
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                /* surfaced by caller toast */
              } finally {
                setPending(false);
              }
            }}
          >
            Xoá kết quả
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LiveToggleButton({
  live,
  onToggle,
  compact,
  disabled,
}: {
  live: boolean;
  onToggle: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  if (live) {
    return (
      <Button
        type="button"
        onClick={onToggle}
        size={compact ? "icon-xs" : "icon-sm"}
        variant="ghost"
        aria-label="Dừng live"
        title="Dừng live"
        className="bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400"
        disabled={disabled}
      >
        <Radio className="animate-pulse" />
      </Button>
    );
  }
  return (
    <Button
      type="button"
      onClick={onToggle}
      size={compact ? "xs" : "sm"}
      variant="outline"
      aria-label="Bắt đầu đấu"
      disabled={disabled}
    >
      <Radio /> Live
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

function parseSetsRows(rows: Array<{ a: string; b: string }>): SetScore[] {
  const out: SetScore[] = [];
  for (const r of rows) {
    if (r.a === "" && r.b === "") continue;
    const a = Number(r.a);
    const b = Number(r.b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a < 0 || b < 0 || a > 99 || b > 99) continue;
    out.push({ a, b });
  }
  return out;
}

function EditDoublesMatchDialog({
  title,
  match,
  disabled,
  onSave,
}: {
  title: string;
  match: MatchResolved;
  disabled?: boolean;
  onSave: (body: {
    sets?: SetScore[];
    status?: Status;
    winner?: string | null;
  }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const minRows = Math.ceil(match.bestOf / 2);
  const initialRows: Array<{ a: string; b: string }> =
    match.sets.length > 0
      ? match.sets.map((s) => ({ a: String(s.a), b: String(s.b) }))
      : Array.from({ length: minRows }, () => ({ a: "", b: "" }));
  const [rows, setRows] = useState(initialRows);
  const [status, setStatus] = useState<Status>(match.status);
  const [winnerId, setWinnerId] = useState<string | null>(
    match.winner?.id ?? null,
  );
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setRows(initialRows);
    setStatus(match.status);
    setWinnerId(match.winner?.id ?? null);
  };

  const updateRow = (i: number, side: "a" | "b", v: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [side]: v } : r)));
  const addRow = () => setRows((rs) => [...rs, { a: "", b: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const onSubmit = async () => {
    const body: { sets?: SetScore[]; status?: Status; winner?: string | null } = {
      sets: parseSetsRows(rows),
      status,
    };
    if (status === "forfeit") {
      if (!winnerId) {
        toast.error("Vui lòng chọn người thắng");
        return;
      }
      body.winner = winnerId;
    } else {
      body.winner = null;
    }
    setSaving(true);
    const ok = await onSave(body);
    setSaving(false);
    if (ok) setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger
        disabled={disabled}
        render={
          <Button
            size="icon-sm"
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
          <DialogTitle>Sửa trận · {title}</DialogTitle>
          <DialogDescription>
            <span className="block font-medium text-foreground">
              {match.pairA.label}  vs  {match.pairB.label}
            </span>
            <span className="block">
              Thắng {Math.ceil(match.bestOf / 2)}/{match.bestOf} ván.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Trạng thái</Label>
            <div className="flex flex-wrap gap-2">
              {(["scheduled", "live", "done", "forfeit"] as const).map((s) => (
                <label
                  key={s}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
                    status === s ? "border-primary bg-primary/5" : "border-input"
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    className="size-3.5"
                  />
                  {STATUS_META[s].label}
                </label>
              ))}
            </div>
          </div>

          {status === "forfeit" && (
            <div className="grid gap-1.5">
              <Label>Người thắng</Label>
              <div className="flex flex-col gap-1.5">
                {[match.pairA, match.pairB].map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                      winnerId === p.id ? "border-primary bg-primary/5" : "border-input"
                    }`}
                  >
                    <input
                      type="radio"
                      name="winner"
                      value={p.id}
                      checked={winnerId === p.id}
                      onChange={() => setWinnerId(p.id)}
                      className="size-3.5"
                    />
                    <span className="truncate">{p.label}</span>
                  </label>
                ))}
              </div>
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
          <DialogClose render={<Button variant="outline" type="button" disabled={saving} />}>
            Huỷ
          </DialogClose>
          <Button type="button" onClick={onSubmit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Lưu
          </Button>
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
