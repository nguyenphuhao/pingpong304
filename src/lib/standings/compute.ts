import type { MatchResolved, TeamMatchResolved } from "@/lib/schemas/match";
import type { EntryInfo, StandingRow } from "./types";
import { applyDoublesRanking, applyTeamRanking } from "./tiebreaker";

export function computeDoublesStandings(
  entries: EntryInfo[],
  matches: MatchResolved[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [
      e.id,
      {
        entryId: e.id,
        entry: e.label,
        played: 0,
        won: 0,
        lost: 0,
        diff: 0,
        setsWon: 0,
        setsLost: 0,
        points: 0,
        rank: 0,
      },
    ]),
  );

  for (const m of matches) {
    if (m.status !== "done" && m.status !== "forfeit") continue;
    const ra = rows.get(m.pairA.id);
    const rb = rows.get(m.pairB.id);
    if (!ra || !rb) continue;

    ra.played += 1;
    rb.played += 1;
    ra.setsWon += m.setsA;
    ra.setsLost += m.setsB;
    rb.setsWon += m.setsB;
    rb.setsLost += m.setsA;
    ra.diff += m.setsA - m.setsB;
    rb.diff += m.setsB - m.setsA;

    if (m.winner?.id === m.pairA.id) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 1;
    } else if (m.winner?.id === m.pairB.id) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 1;
    }
  }

  return applyDoublesRanking([...rows.values()], matches);
}

export function computeTeamStandings(
  entries: EntryInfo[],
  matches: TeamMatchResolved[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((e) => [
      e.id,
      {
        entryId: e.id,
        entry: e.label,
        played: 0,
        won: 0,
        lost: 0,
        diff: 0,
        setsWon: 0,
        setsLost: 0,
        points: 0,
        rank: 0,
      },
    ]),
  );

  for (const m of matches) {
    if (m.status !== "done" && m.status !== "forfeit") continue;
    const ra = rows.get(m.teamA.id);
    const rb = rows.get(m.teamB.id);
    if (!ra || !rb) continue;

    ra.played += 1;
    rb.played += 1;
    ra.setsWon += m.scoreA;
    ra.setsLost += m.scoreB;
    rb.setsWon += m.scoreB;
    rb.setsLost += m.scoreA;
    ra.diff += m.scoreA - m.scoreB;
    rb.diff += m.scoreB - m.scoreA;

    if (m.winner?.id === m.teamA.id) {
      ra.won += 1;
      rb.lost += 1;
      ra.points += 1;
    } else if (m.winner?.id === m.teamB.id) {
      rb.won += 1;
      ra.lost += 1;
      rb.points += 1;
    }
  }

  return applyTeamRanking([...rows.values()], matches);
}
