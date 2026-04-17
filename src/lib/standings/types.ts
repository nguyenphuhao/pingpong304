import type { Status } from "@/lib/schemas/match";

/** Display-ready standings row with rank assigned after tiebreaker. */
export type StandingRow = {
  entryId: string;
  entry: string;
  played: number;
  won: number;
  lost: number;
  diff: number;
  setsWon: number;
  setsLost: number;
  points: number;
  rank: number;
};

/** Entry input: ID for tiebreaker matching, label for display. */
export type EntryInfo = { id: string; label: string };

/** Minimal doubles match shape for tiebreaker computation. */
export type DoublesMatchForTiebreak = {
  pairA: { id: string };
  pairB: { id: string };
  setsA: number;
  setsB: number;
  status: Status;
  winner: { id: string } | null;
};

/** Minimal team match shape for tiebreaker computation. */
export type TeamMatchForTiebreak = {
  teamA: { id: string };
  teamB: { id: string };
  scoreA: number;
  scoreB: number;
  status: Status;
  winner: { id: string } | null;
};
