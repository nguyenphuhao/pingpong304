# Phase 5B: Standings DB Views Integration + Tiebreaker TS Layer

## Scope

Replace mock-based standings computation in admin + public group pages with DB-aware logic and proper tiebreaker rules. Home feed functions (`leaderOf`, `topNOf`, etc.) stay mock-based — deferred to Phase 5C.

**In scope:**
- New `src/lib/standings/` module: types, compute, tiebreaker (pure functions)
- Replace `computeDoublesStandings` / `computeTeamStandings` in `_components.tsx`
- Delete `resolvedToLegacy*` wrappers and `LegacyDoublesMatch` / `LegacyTeamMatch` types
- Update `StandingsCard` to support tied ranks
- Update `DoublesSchedule` / `TeamSchedule` entry signatures to include IDs
- Unit tests for tiebreaker logic

**Out of scope:**
- Home feed migration (Phase 5C)
- New API routes (not needed — components already have matches data)
- New DB migrations (views already exist in 0002)
- Knockout standings (Phase 6)

---

## Tiebreaker Rules

### Doubles (Đôi)

**Primary sort:** Số trận thắng (won) DESC

**Tiebreaker khi ngang trận thắng (waterfall):**

**Case: exactly 2 entries tied:**
1. H2H trực tiếp — winner of their direct match ranks higher
2. Hiệu số ván (sets_won - sets_lost) DESC
3. Tổng số ván thắng (sets_won) DESC
4. Unresolved → same rank (bốc thăm handled offline)

**Case: 3+ entries tied:**
1. Build mini-league — filter matches to only those between tied entries
2. Recompute standings within mini-league:
   a. Số trận thắng trong mini-league DESC
   b. Hiệu số ván trong mini-league DESC
   c. Tổng ván thắng trong mini-league DESC
3. If after mini-league exactly 2 entries still tied → fall back to H2H (case above)
4. If still unresolved → same rank

**Metrics used:** sets (ván)

### Teams (Đồng đội)

**Primary sort:** Số trận đồng đội thắng (won) DESC

**Tiebreaker khi ngang trận thắng (waterfall):**

**Case: exactly 2 teams tied:**
1. H2H trực tiếp — winner of their direct team match ranks higher
2. Hiệu số trận thành phần (sub_won - sub_lost) DESC
3. Tổng trận thành phần thắng (sub_won) DESC
4. Unresolved → same rank

**Case: 3+ teams tied:**
1. Build mini-league — filter team matches to only those between tied teams
2. Recompute standings within mini-league:
   a. Số trận đồng đội thắng trong mini-league DESC
   b. Hiệu số trận thành phần trong mini-league DESC
   c. Tổng trận thành phần thắng trong mini-league DESC
3. If after mini-league exactly 2 teams still tied → fall back to H2H
4. If still unresolved → same rank

**Metrics used:** sub-matches (trận thành phần), NOT sets (ván)

**Sub-match counting rule:** Only count sub-matches that were actually played or received walkover/forfeit. Do NOT count remaining sub-matches after the overall team match winner has been determined.

---

## Data Flow

### Current (Phase 5A)

```
DoublesSchedule(entries: string[], matches: MatchResolved[])
  → resolvedToLegacyDoublesMatch(m) → LegacyDoublesMatch
  → computeDoublesStandings(labels, legacyMatches)
  → StandingsCard(rows: StandingRow[])
```

Standings computation uses label strings for identity. No tiebreaker. Sort: points → diff → won.

### New (Phase 5B)

```
DoublesSchedule(entries: {id: string, label: string}[], matches: MatchResolved[])
  → computeDoublesStandings(entries, matches)
     ↳ aggregate stats from matches (inline, same logic as DB view)
     ↳ applyTiebreaker(rows, matches) → sorted + ranked
  → StandingsCard(rows: StandingRow[])
```

Standings computation uses entry IDs for identity. Full tiebreaker applied. Delete legacy wrappers.

DB views (`doubles_standings_raw`, `team_standings_raw`) remain for Phase 5C home feed use. Phase 5B components already have matches data — no need to query views separately.

---

## Types

### StandingRow (updated)

```typescript
type StandingRow = {
  entryId: string;     // pair/team ID
  entry: string;       // display label
  played: number;
  won: number;
  lost: number;
  diff: number;        // hiệu số ván (doubles) / hiệu số trận thành phần (teams)
  setsWon: number;     // tổng ván thắng (doubles) / tổng sub thắng (teams)
  setsLost: number;
  points: number;      // won * 2 (display convenience)
  rank: number;        // 1-based, same rank = tied after tiebreaker
};
```

### Helper types

```typescript
// Input entry with ID for tiebreaker matching
type EntryInfo = { id: string; label: string };

// Minimal match shape for tiebreaker (doubles)
type DoublesMatchForTiebreak = {
  pairA: { id: string };
  pairB: { id: string };
  setsA: number;
  setsB: number;
  status: Status;
  winner: { id: string } | null;
};

// Minimal match shape for tiebreaker (teams)
type TeamMatchForTiebreak = {
  teamA: { id: string };
  teamB: { id: string };
  scoreA: number;       // sub-matches won by A
  scoreB: number;       // sub-matches won by B
  status: Status;
  winner: { id: string } | null;
};
```

---

## Module Structure

### `src/lib/standings/types.ts`
- `StandingRow`, `EntryInfo`, match shape types

### `src/lib/standings/compute.ts`
- `computeDoublesStandings(entries: EntryInfo[], matches: MatchResolved[]): StandingRow[]`
  - Aggregate stats from matches (filter done/forfeit, accumulate per entry)
  - Call `applyDoublesRanking` for tiebreaker + rank assignment
- `computeTeamStandings(entries: EntryInfo[], matches: TeamMatchResolved[]): StandingRow[]`
  - Same pattern, using sub-match metrics

### `src/lib/standings/tiebreaker.ts`
- `applyDoublesRanking(rows: StandingRow[], matches: DoublesMatchForTiebreak[]): StandingRow[]`
  - Group by `won` → for each tied group: resolve via H2H or mini-league
  - Assign `rank` field
- `applyTeamRanking(rows: StandingRow[], matches: TeamMatchForTiebreak[]): StandingRow[]`
  - Same structure, team metrics

Internal helpers (not exported):
- `resolveH2H(a, b, matches, metric)` — find direct match, return winner or null
- `resolveMiniLeague(tied, matches, metric)` — recompute standings for subset
- `metric` parameter distinguishes doubles (sets) vs teams (sub-matches)

---

## Component Changes

### `_components.tsx`

**Delete:**
- `LegacyDoublesMatch` type
- `LegacyTeamMatch` type
- `resolvedToLegacyStatus()`
- `resolvedToLegacyDoublesMatch()`
- `resolvedToLegacyTeamMatch()`
- `computeDoublesStandings()` (body — replaced by import)
- `computeTeamStandings()` (body — replaced by import)

**Update `DoublesSchedule` props:**
```typescript
// Before
entries: string[]

// After
entries: { id: string; label: string }[]
```

Update internal references: `entries.map(e => e.label)` for display, pass full entries to `computeDoublesStandings`.

**Update `TeamSchedule` props:** Same pattern.

**Update `StandingsCard`:**
- Accept `StandingRow[]` with `rank` field
- Display `rank` instead of `i + 1` — tied entries show same rank number
- Visual indicator for ties (same rank badge value)

### `src/app/d/[id]/page.tsx`

Update to pass `{id, label}` entries instead of bare labels. The fetch functions already return entry objects with IDs — just pass them through.

### `src/app/t/[id]/page.tsx`

Same update.

### Admin group detail pages

Update callers of `DoublesSchedule` / `TeamSchedule` to pass `{id, label}` entries. Check how entries are currently constructed and adapt.

---

## Testing

### Unit tests: `src/lib/standings/__tests__/tiebreaker.test.ts`

Test cases for tiebreaker:

1. **No ties** — all entries have different won counts → rank = sequential
2. **2-way tie, H2H resolves** — A beat B directly → A ranks higher
3. **2-way tie, H2H not played** — fall to hiệu số ván → resolved
4. **2-way tie, fully tied** — same rank assigned
5. **3-way tie, mini-league resolves all** — A > B > C in mini-league
6. **3-way tie, mini-league reduces to 2-way** — mini-league separates 1, leaves 2 tied → H2H fallback
7. **3-way tie, mini-league unresolved** — all same in mini-league → same rank
8. **Teams: sub-match counting** — verify only played/forfeit subs counted
9. **Teams: uses sub-match diff, not sets** — verify correct metric
10. **Edge: no matches played** — all entries rank 1, played = 0

### Unit tests: `src/lib/standings/__tests__/compute.test.ts`

1. Basic doubles standings computation (no ties)
2. Basic team standings computation (no ties)
3. Entries with no matches → all zeroes, rank 1
4. Forfeit matches counted correctly
5. Live matches excluded from standings

---

## Migration

No new DB migration required. Views from 0002 (`doubles_standings_raw`, `team_standings_raw`) remain unchanged and available for Phase 5C.

---

## Risk Notes

- **Zero-play entries:** Entries with 0 matches played are ranked below all entries with matches, ordered alphabetically. They all share the same rank. Tiebreaker logic only applies to entries with at least 1 match played.
- **Recursive tiebreaker depth:** Mini-league can theoretically recurse (3-way → mini-league → 2-way → H2H). Implementation caps at 2 levels to prevent infinite loops. In practice, round-robin groups of 4-5 entries won't recurse deeper.
- **`_components.tsx` size:** Currently 2276 LOC. Phase 5B reduces it (deleting ~100 LOC of legacy code). Full split deferred to Phase 7.
- **Entry ID availability:** Public pages fetch entries via `fetchDoublesGroupById` which returns `{id, label}` from DB. Admin pages need verification that entry IDs are available in the data flow.
