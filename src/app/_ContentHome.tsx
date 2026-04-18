import { Medal, Shield, Users } from "lucide-react";
import { SwipeCarousel } from "./_SwipeCarousel";
import { MatchCard } from "./_MatchCard";
import { StandingsSummary } from "./_StandingsSummary";
import { GroupScheduleList, KnockoutScheduleList } from "./_ScheduleList";
import type { GroupResolved } from "@/lib/schemas/group";
import type {
  MatchResolved,
  TeamMatchResolved,
  SetScore,
} from "@/lib/schemas/match";
import type { DoublesKoResolved, TeamKoResolved } from "@/lib/schemas/knockout";
import type { StandingRow } from "@/lib/db/standings";

type Props = {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  knockout: DoublesKoResolved[] | TeamKoResolved[];
  liveMatches: MatchResolved[] | TeamMatchResolved[];
  recentResults: MatchResolved[] | TeamMatchResolved[];
  standings: Map<string, StandingRow[]>;
  matchesByGroup:
    | Map<string, MatchResolved[]>
    | Map<string, TeamMatchResolved[]>;
};

function setsSummary(sets: SetScore[]): { a: number; b: number } {
  let a = 0,
    b = 0;
  for (const s of sets) {
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return { a, b };
}

function buildGroupNameMap(groups: GroupResolved[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of groups) map.set(g.id, g.name);
  return map;
}

function LiveSection({
  kind,
  groups,
  liveMatches,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  liveMatches: MatchResolved[] | TeamMatchResolved[];
}) {
  if (liveMatches.length === 0) return null;
  const groupNameMap = buildGroupNameMap(groups);

  const cards = liveMatches.map((m) => {
    if (kind === "doubles") {
      const dm = m as MatchResolved;
      const { a, b } = setsSummary(dm.sets);
      return (
        <MatchCard
          key={dm.id}
          variant="live"
          groupId={dm.groupId}
          groupName={groupNameMap.get(dm.groupId) ?? dm.groupId}
          table={dm.table}
          sideA={dm.pairA.label}
          sideB={dm.pairB.label}
          scoreA={a}
          scoreB={b}
          sets={dm.sets}
        />
      );
    } else {
      const tm = m as TeamMatchResolved;
      return (
        <MatchCard
          key={tm.id}
          variant="live"
          groupId={tm.groupId}
          groupName={groupNameMap.get(tm.groupId) ?? tm.groupId}
          table={tm.table}
          sideA={tm.teamA.name}
          sideB={tm.teamB.name}
          scoreA={tm.scoreA}
          scoreB={tm.scoreB}
          sets={[]}
        />
      );
    }
  });

  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
        </span>
        <span className="text-sm font-semibold text-green-600 dark:text-green-400">Đang đấu</span>
        <span className="text-xs text-muted-foreground">{liveMatches.length} trận</span>
      </div>
      <SwipeCarousel dotColor="bg-green-500">{cards}</SwipeCarousel>
    </section>
  );
}

function RecentSection({
  kind,
  groups,
  recentResults,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  recentResults: MatchResolved[] | TeamMatchResolved[];
}) {
  if (recentResults.length === 0) return null;
  const groupNameMap = buildGroupNameMap(groups);

  const cards = recentResults.map((m) => {
    if (kind === "doubles") {
      const dm = m as MatchResolved;
      const { a, b } = setsSummary(dm.sets);
      return (
        <MatchCard
          key={dm.id}
          variant="done"
          groupId={dm.groupId}
          groupName={groupNameMap.get(dm.groupId) ?? dm.groupId}
          table={dm.table}
          sideA={dm.pairA.label}
          sideB={dm.pairB.label}
          scoreA={a}
          scoreB={b}
          sets={dm.sets}
        />
      );
    } else {
      const tm = m as TeamMatchResolved;
      return (
        <MatchCard
          key={tm.id}
          variant="done"
          groupId={tm.groupId}
          groupName={groupNameMap.get(tm.groupId) ?? tm.groupId}
          table={tm.table}
          sideA={tm.teamA.name}
          sideB={tm.teamB.name}
          scoreA={tm.scoreA}
          scoreB={tm.scoreB}
          sets={[]}
        />
      );
    }
  });

  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm font-semibold">Kết quả gần nhất</span>
        <span className="text-xs text-muted-foreground">{recentResults.length} trận</span>
      </div>
      <SwipeCarousel dotColor="bg-foreground">{cards}</SwipeCarousel>
    </section>
  );
}

// ── FinalRanking (preserved from original) ──

type KoMatch = DoublesKoResolved | TeamKoResolved;

function isDoublesKo(m: KoMatch): m is DoublesKoResolved {
  return "sets" in m;
}

const MEDAL = [
  {
    emoji: "🥇",
    label: "Nhất",
    bg: "bg-yellow-500/15 border-yellow-500/40",
    text: "text-yellow-700 dark:text-yellow-400",
  },
  {
    emoji: "🥈",
    label: "Nhì",
    bg: "bg-gray-200/60 border-gray-300/50 dark:bg-gray-700/30 dark:border-gray-600/30",
    text: "text-gray-700 dark:text-gray-300",
  },
  {
    emoji: "🥉",
    label: "Đồng hạng 3",
    bg: "bg-amber-600/10 border-amber-600/25",
    text: "text-amber-700 dark:text-amber-500",
  },
];

function FinalRanking({ knockout }: { knockout: KoMatch[] }) {
  const final = knockout.find((m) => m.round === "f");
  if (!final || (final.status !== "done" && final.status !== "forfeit"))
    return null;

  const winnerId = isDoublesKo(final)
    ? final.winner?.id
    : (final as TeamKoResolved).winner?.id;
  if (!winnerId) return null;

  const winnerName = isDoublesKo(final)
    ? final.winner?.label
    : (final as TeamKoResolved).winner?.name;
  const loserName = isDoublesKo(final)
    ? final.entryA?.id === winnerId
      ? final.entryB?.label
      : final.entryA?.label
    : (final as TeamKoResolved).entryA?.id === winnerId
      ? (final as TeamKoResolved).entryB?.name
      : (final as TeamKoResolved).entryA?.name;

  const thirds = knockout
    .filter((m) => m.round === "sf")
    .map((m) => {
      const wId = isDoublesKo(m)
        ? m.winner?.id
        : (m as TeamKoResolved).winner?.id;
      if (!wId) return null;
      if (isDoublesKo(m)) {
        return m.entryA?.id === wId ? m.entryB?.label : m.entryA?.label;
      }
      const tm = m as TeamKoResolved;
      return tm.entryA?.id === wId ? tm.entryB?.name : tm.entryA?.name;
    })
    .filter(Boolean) as string[];

  if (!winnerName || !loserName) return null;

  const rows = [
    { ...MEDAL[0], name: winnerName },
    { ...MEDAL[1], name: loserName },
    ...thirds.map((name) => ({ ...MEDAL[2], name })),
  ];

  return (
    <section className="rounded-2xl border-2 border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 via-yellow-500/5 to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <Medal className="size-5 text-yellow-600" />
        <h2 className="text-lg font-bold">Kết quả chung cuộc</h2>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${r.bg}`}
          >
            <span className="text-xl">{r.emoji}</span>
            <div className="min-w-0 flex-1">
              <span
                className={`text-sm font-semibold uppercase tracking-wide ${r.text}`}
              >
                {r.label}
              </span>
              <p className="text-base font-medium">{r.name}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── ContentHome ──

export function ContentHome({
  kind,
  groups,
  knockout,
  liveMatches,
  recentResults,
  standings,
  matchesByGroup,
}: Props) {
  const isDoubles = kind === "doubles";
  const titleColor = isDoubles
    ? "text-blue-600 dark:text-blue-400"
    : "text-violet-600 dark:text-violet-400";
  const Icon = isDoubles ? Users : Shield;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      {/* 1. Header */}
      <header className="flex items-center gap-2 pt-2">
        <Icon className={`size-5 ${titleColor}`} />
        <h1 className="text-xl font-semibold leading-tight">
          Nội dung {isDoubles ? "Đôi" : "Đồng đội"}
        </h1>
      </header>

      {/* 2. Tournament name block */}
      <div className="border-l-2 border-emerald-500/50 pl-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          CLB Bóng Bàn Bình Tân
        </p>
        <p className="mt-0.5 text-base leading-snug text-foreground/80">
          Giải Bóng Bàn Kỷ niệm 51 năm ngày thống nhất đất nước
        </p>
      </div>

      {/* 3. FinalRanking */}
      <FinalRanking knockout={knockout} />

      {/* 4. Live matches */}
      <LiveSection kind={kind} groups={groups} liveMatches={liveMatches} />

      {/* 5. Standings summary */}
      <StandingsSummary kind={kind} groups={groups} standings={standings} />

      {/* 6. Recent results */}
      <RecentSection
        kind={kind}
        groups={groups}
        recentResults={recentResults}
      />

      {/* 7. Divider */}
      <div className="border-t" />

      {/* 8. Group schedule */}
      <GroupScheduleList
        kind={kind}
        groups={groups}
        matchesByGroup={matchesByGroup}
      />

      {/* 9. Knockout schedule */}
      <KnockoutScheduleList kind={kind} matches={knockout} />
    </main>
  );
}
