import type { MatchResolved, TeamMatchResolved, SetScore } from "@/lib/schemas/match";
import type { GroupResolved } from "@/lib/schemas/group";
import { fetchDoublesMatchesByGroup, fetchTeamMatchesByGroup } from "./matches";

export type StandingRow = {
  entry: string;
  played: number;
  won: number;
  lost: number;
  diff: number;
  points: number;
};

function setsSummary(sets: SetScore[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

export function computeDoublesStandings(
  matches: MatchResolved[],
  entries: string[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [e, { entry: e, played: 0, won: 0, lost: 0, diff: 0, points: 0 }]),
  );
  for (const m of matches) {
    if (m.status !== "done" && m.status !== "forfeit") continue;
    const { a, b } = setsSummary(m.sets);
    const ra = rows.get(m.pairA.label);
    const rb = rows.get(m.pairB.label);
    if (!ra || !rb) continue;
    ra.played += 1;
    rb.played += 1;
    ra.diff += a - b;
    rb.diff += b - a;
    if (a > b) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 1;
    } else if (b > a) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 1;
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.diff - x.diff || y.won - x.won,
  );
}

export function computeTeamStandings(
  matches: TeamMatchResolved[],
  entries: string[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [e, { entry: e, played: 0, won: 0, lost: 0, diff: 0, points: 0 }]),
  );
  for (const m of matches) {
    if (m.status !== "done" && m.status !== "forfeit") continue;
    const ra = rows.get(m.teamA.name);
    const rb = rows.get(m.teamB.name);
    if (!ra || !rb) continue;
    ra.played += 1;
    rb.played += 1;
    ra.diff += m.scoreA - m.scoreB;
    rb.diff += m.scoreB - m.scoreA;
    if (m.scoreA > m.scoreB) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 1;
    } else if (m.scoreB > m.scoreA) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 1;
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.diff - x.diff || y.won - x.won,
  );
}

export async function fetchGroupStandings(
  kind: "doubles" | "teams",
  groupId: string,
  entries: string[],
): Promise<StandingRow[]> {
  if (kind === "doubles") {
    const matches = await fetchDoublesMatchesByGroup(groupId);
    return computeDoublesStandings(matches, entries);
  }
  const matches = await fetchTeamMatchesByGroup(groupId);
  return computeTeamStandings(matches, entries);
}

export async function fetchAllGroupStandings(
  kind: "doubles" | "teams",
  groups: GroupResolved[],
): Promise<Map<string, StandingRow[]>> {
  const results = await Promise.all(
    groups.map(async (g) => {
      const entries = g.entries.map((e) => e.label);
      const standings = await fetchGroupStandings(kind, g.id, entries);
      return [g.id, standings] as const;
    }),
  );
  return new Map(results);
}
