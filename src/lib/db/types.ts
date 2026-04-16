// Single source of truth for DB entity types.
// Currently re-exported from the mock file (which will be deleted in Phase 7).
// All future API and UI code should import types from here, not from _mock.
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
