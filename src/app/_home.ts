import {
  MOCK_DOUBLES_GROUPS,
  MOCK_DOUBLES_MATCHES,
  MOCK_DOUBLES_PLAYERS,
  MOCK_TEAM_GROUPS,
  MOCK_TEAM_MATCHES,
  MOCK_TEAM_PLAYERS,
  type DoublesMatch,
  type Group,
  type MatchStatus,
  type Player,
  type SetScore,
  type TeamMatch,
} from "./admin/_mock";

export type FeedItem = {
  id: string;
  kind: "doubles" | "teams";
  groupId: string;
  groupName: string;
  status: MatchStatus;
  sideA: string;
  sideB: string;
  scoreA: number;
  scoreB: number;
  table?: number;
  setScores?: SetScore[]; // doubles
  bestOf?: 3 | 5; // doubles
  href: string;
};

function setsSummary(sets: SetScore[]) {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

function groupName(kind: "doubles" | "teams", id: string): string {
  const g = (kind === "doubles" ? MOCK_DOUBLES_GROUPS : MOCK_TEAM_GROUPS).find(
    (x) => x.id === id
  );
  return g?.name ?? "?";
}

function doublesToFeed(m: DoublesMatch): FeedItem {
  const { a, b } = setsSummary(m.sets);
  return {
    id: m.id,
    kind: "doubles",
    groupId: m.groupId,
    groupName: groupName("doubles", m.groupId),
    status: m.status,
    sideA: m.pairA,
    sideB: m.pairB,
    scoreA: a,
    scoreB: b,
    table: m.table,
    setScores: m.sets,
    bestOf: m.bestOf,
    href: `/d/${m.groupId}`,
  };
}

function teamToFeed(m: TeamMatch): FeedItem {
  return {
    id: m.id,
    kind: "teams",
    groupId: m.groupId,
    groupName: groupName("teams", m.groupId),
    status: m.status,
    sideA: m.teamA,
    sideB: m.teamB,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    table: m.table,
    href: `/t/${m.groupId}`,
  };
}

export function getFeed(kind?: "doubles" | "teams"): {
  upcoming: FeedItem[];
  recent: FeedItem[];
} {
  let all: FeedItem[];
  if (kind === "doubles") all = MOCK_DOUBLES_MATCHES.map(doublesToFeed);
  else if (kind === "teams") all = MOCK_TEAM_MATCHES.map(teamToFeed);
  else
    all = [
      ...MOCK_DOUBLES_MATCHES.map(doublesToFeed),
      ...MOCK_TEAM_MATCHES.map(teamToFeed),
    ];
  return {
    upcoming: all.filter((m) => m.status === "scheduled"),
    recent: all.filter((m) => m.status === "done"),
  };
}

export type GroupLeader = {
  kind: "doubles" | "teams";
  groupId: string;
  groupName: string;
  leader: string | null;
  played: number;
  total: number;
  points: number;
  href: string;
};

export type GroupTopEntry = { entry: string; points: number; played: number };
export type GroupTops = {
  kind: "doubles" | "teams";
  groupId: string;
  groupName: string;
  total: number;
  played: number;
  top: GroupTopEntry[];
  href: string;
};

function leaderOf(group: Group, kind: "doubles" | "teams"): GroupLeader {
  const isDoubles = kind === "doubles";
  const matches = isDoubles
    ? MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === group.id)
    : MOCK_TEAM_MATCHES.filter((m) => m.groupId === group.id);
  const score = new Map<string, { points: number; diff: number }>(
    group.entries.map((e) => [e, { points: 0, diff: 0 }])
  );
  let played = 0;
  for (const m of matches) {
    if (m.status !== "done") continue;
    played += 1;
    const a = isDoubles ? setsSummary((m as DoublesMatch).sets).a : (m as TeamMatch).scoreA;
    const b = isDoubles ? setsSummary((m as DoublesMatch).sets).b : (m as TeamMatch).scoreB;
    const sideA = isDoubles ? (m as DoublesMatch).pairA : (m as TeamMatch).teamA;
    const sideB = isDoubles ? (m as DoublesMatch).pairB : (m as TeamMatch).teamB;
    const sa = score.get(sideA);
    const sb = score.get(sideB);
    if (!sa || !sb) continue;
    sa.diff += a - b;
    sb.diff += b - a;
    if (a > b) sa.points += 2;
    else if (b > a) sb.points += 2;
  }
  const sorted = [...score.entries()].sort(
    (x, y) => y[1].points - x[1].points || y[1].diff - x[1].diff
  );
  const top = played > 0 ? sorted[0] : null;
  return {
    kind,
    groupId: group.id,
    groupName: group.name,
    leader: top ? top[0] : null,
    played,
    total: matches.length,
    points: top ? top[1].points : 0,
    href: `${isDoubles ? "/d" : "/t"}/${group.id}`,
  };
}

export function getGroupLeaders(kind?: "doubles" | "teams"): GroupLeader[] {
  if (kind === "doubles") return MOCK_DOUBLES_GROUPS.map((g) => leaderOf(g, "doubles"));
  if (kind === "teams") return MOCK_TEAM_GROUPS.map((g) => leaderOf(g, "teams"));
  return [
    ...MOCK_DOUBLES_GROUPS.map((g) => leaderOf(g, "doubles")),
    ...MOCK_TEAM_GROUPS.map((g) => leaderOf(g, "teams")),
  ];
}

function topNOf(group: Group, kind: "doubles" | "teams", n: number): GroupTops {
  const isDoubles = kind === "doubles";
  const matches = isDoubles
    ? MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === group.id)
    : MOCK_TEAM_MATCHES.filter((m) => m.groupId === group.id);
  const score = new Map<string, { points: number; diff: number }>(
    group.entries.map((e) => [e, { points: 0, diff: 0 }])
  );
  let played = 0;
  for (const m of matches) {
    if (m.status !== "done") continue;
    played += 1;
    const a = isDoubles ? setsSummary((m as DoublesMatch).sets).a : (m as TeamMatch).scoreA;
    const b = isDoubles ? setsSummary((m as DoublesMatch).sets).b : (m as TeamMatch).scoreB;
    const sideA = isDoubles ? (m as DoublesMatch).pairA : (m as TeamMatch).teamA;
    const sideB = isDoubles ? (m as DoublesMatch).pairB : (m as TeamMatch).teamB;
    const sa = score.get(sideA);
    const sb = score.get(sideB);
    if (!sa || !sb) continue;
    sa.diff += a - b;
    sb.diff += b - a;
    if (a > b) sa.points += 2;
    else if (b > a) sb.points += 2;
  }
  const sorted = [...score.entries()].sort(
    (x, y) => y[1].points - x[1].points || y[1].diff - x[1].diff
  );
  return {
    kind,
    groupId: group.id,
    groupName: group.name,
    total: matches.length,
    played,
    top: sorted.slice(0, n).map(([entry, s]) => ({
      entry,
      points: s.points,
      played: matches.filter((m) =>
        isDoubles
          ? (m as DoublesMatch).pairA === entry || (m as DoublesMatch).pairB === entry
          : (m as TeamMatch).teamA === entry || (m as TeamMatch).teamB === entry
      ).filter((m) => m.status === "done").length,
    })),
    href: `${isDoubles ? "/d" : "/t"}/${group.id}`,
  };
}

export function getGroupTops(kind: "doubles" | "teams", n = 2): GroupTops[] {
  return kind === "doubles"
    ? MOCK_DOUBLES_GROUPS.map((g) => topNOf(g, "doubles", n))
    : MOCK_TEAM_GROUPS.map((g) => topNOf(g, "teams", n));
}

export type StandingRow = {
  entry: string;
  played: number;
  won: number;
  lost: number;
  diff: number;
  points: number;
};

export function getStandings(
  kind: "doubles" | "teams",
  groupId: string,
  entries: string[],
): StandingRow[] {
  const isDoubles = kind === "doubles";
  const matches = isDoubles
    ? MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === groupId)
    : MOCK_TEAM_MATCHES.filter((m) => m.groupId === groupId);
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [
      e,
      { entry: e, played: 0, won: 0, lost: 0, diff: 0, points: 0 },
    ]),
  );
  for (const m of matches) {
    if (m.status !== "done") continue;
    const a = isDoubles ? setsSummary((m as DoublesMatch).sets).a : (m as TeamMatch).scoreA;
    const b = isDoubles ? setsSummary((m as DoublesMatch).sets).b : (m as TeamMatch).scoreB;
    const sideA = isDoubles ? (m as DoublesMatch).pairA : (m as TeamMatch).teamA;
    const sideB = isDoubles ? (m as DoublesMatch).pairB : (m as TeamMatch).teamB;
    const ra = rows.get(sideA);
    const rb = rows.get(sideB);
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

export function searchPlayersAndMatches(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return { players: [] as Array<Player & { kind: "doubles" | "teams" }>, matches: [] as FeedItem[] };
  const players = [
    ...MOCK_DOUBLES_PLAYERS.map((p) => ({ ...p, kind: "doubles" as const })),
    ...MOCK_TEAM_PLAYERS.map((p) => ({ ...p, kind: "teams" as const })),
  ].filter((p) => p.name.toLowerCase().includes(q));

  const matches: FeedItem[] = [];
  for (const m of MOCK_DOUBLES_MATCHES) {
    if (
      m.pairA.toLowerCase().includes(q) ||
      m.pairB.toLowerCase().includes(q)
    ) {
      matches.push(doublesToFeed(m));
    }
  }
  for (const m of MOCK_TEAM_MATCHES) {
    if (
      m.teamA.toLowerCase().includes(q) ||
      m.teamB.toLowerCase().includes(q) ||
      m.individual.some(
        (im) =>
          im.playerA.toLowerCase().includes(q) || im.playerB.toLowerCase().includes(q)
      )
    ) {
      matches.push(teamToFeed(m));
    }
  }
  return { players, matches };
}
