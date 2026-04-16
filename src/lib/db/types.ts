// Single source of truth for DB entity types.
// Legacy types (Content, Player, Pair, Team, Group, etc.) re-export from _mock
// (will be deleted in Phase 7). New DB-shape types live in src/lib/schemas/.
export type {
  Content,
  Player,
  Pair,
  Team,
  Group,
  SetScore,
  MatchStatus,
  DoublesMatch,
  IndividualMatch,
  TeamSlot,
  OppSlot,
  TeamLineup,
  KnockoutRound,
  KnockoutMatch,
  TeamMatch,
} from "@/app/admin/_mock";

export type { PairWithNames } from "@/lib/schemas/pair";
export type { TeamWithNames } from "@/lib/schemas/team";
