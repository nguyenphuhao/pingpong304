# Phase 5C — Home Feed Migration & Redesign

## Goal

Migrate public-facing pages from mock data to Supabase. Redesign `/d/` and `/t/` tabs with a mobile-first layout optimized for players (primary) and spectators (secondary) checking live scores, standings, and match schedules during the tournament.

## Current State

- `_home.ts`: 6 functions, all mock-based — `getFeed`, `getGroupLeaders`, `getGroupTops`, `getStandings`, `searchPlayersAndMatches`
- `_publicGroup.tsx`: imports `MOCK_DOUBLES_MATCHES`, `MOCK_TEAM_MATCHES` directly, calls `getStandings()` from `_home.ts`
- `search/page.tsx`: calls `searchPlayersAndMatches()` from `_home.ts`
- `/d/page.tsx`, `/t/page.tsx`: already use Supabase for groups + knockout, but delegate to `_ContentHome.tsx` → `_publicGroup.tsx` which uses mocks
- `page.tsx` (home): static event info — **no changes**

## Layout Design (approved mockup)

Five sections on `/d/` and `/t/` tabs, scrollable vertically:

### 1. Đang ��ấu (Live Matches Carousel)

- Swipeable horizontal cards, one match per card
- Card shows: group badge, table number, both side names, live score, set scores
- Green background (`bg-green-900` family), red pulse dot
- Dots indicator below
- **Hidden when no live matches**

### 2. Bảng xếp hạng (Standings Summary Carousel)

- Swipeable pages, 2 groups per page (2-column grid)
- Each group card: group label + top 2 entries with points
- Dots indicator
- Link "Xem chi tiết từng bảng →" navigates to group detail (`/d/[groupId]`)
- Doubles: 2 pages (A+B, C+D). Teams: 1 page (A+B), no swipe needed

### 3. Kết quả gần nhất (Recent Results Carousel)

- Swipeable cards, same card style as live matches
- Difference: gray border instead of green, "Đã xong" badge instead of live dot
- Shows set scores
- Sorted by `updated_at` DESC
- **Hidden when no completed matches**

### 4. Lịch vòng bảng (Group Schedule List)

- Accordion header with progress count (e.g., "8/24 xong")
- Filter chips: Tất cả / A / B / C / D
- Compact rows: group tag + abbreviated names + status pill + chevron ›
- Tap row → inline expand showing full names, set scores, table
- All matches shown (scheduled + done + live)

### 5. Vòng loại trực tiếp (Knockout Schedule List)

- Same pattern as group schedule
- Filter chips: Tất cả / TK / BK / CK
- Compact rows: round tag (TK1, BK1, CK) + names/placeholders + status + chevron
- Tap → inline expand

### Edge Cases

| State | Live | BXH | Results | Group Schedule | KO Schedule |
|-------|------|-----|---------|---------------|-------------|
| Not started | Hidden | Show groups, "Chưa có k��t quả" | Hidden | All "Chưa đấu" | Show if seeded |
| Group stage active | Show | Show standings | Show done | Show | Placeholder if not seeded |
| KO active | Show KO | Final standings | Show KO results | All done | Show active |
| Tournament done | Hidden | Final | Show recent | All done | All done |

Sections with no data are not rendered (no empty state placeholders).

`FinalRanking` (existing): shows when bracket final is done, positioned below header above live matches.

## Data Layer

### New DB queries in `src/lib/db/`

**`matches.ts` (extend existing):**

- `fetchLiveMatches(kind: 'doubles' | 'teams')` — `SELECT ... WHERE status = 'live'`, resolve pair/team labels
- `fetchRecentResults(kind, limit: number)` — `SELECT ... WHERE status IN ('done', 'forfeit') ORDER BY updated_at DESC LIMIT N`, resolve labels + sets

**`matches.ts` (extend, continued):**

- `fetchAllMatchesByGroup(kind, groupIds: string[])` — call `fetchDoublesMatchesByGroup` / `fetchTeamMatchesByGroup` per group, return `Map<groupId, DoublesMatchResolved[] | TeamMatchResolved[]>`. Uses existing resolved types from `matches.ts`.

**`standings.ts` (new file):**

- `fetchGroupStandings(kind, groupId)` — query all matches in group, compute W/L/diff/points server-side, return `StandingRow[]`
- `fetchAllGroupStandings(kind)` — call per group, return `Map<groupId, StandingRow[]>`

Standings computation logic (same as existing `getStandings` in `_home.ts`):
- Doubles: count sets won/lost from `sets` JSONB, 1 point per match win
- Teams: count `score_a`/`score_b`, 1 point per match win
- Sort: points DESC → diff DESC → name ASC (tiebreaker from Phase 5B)

### Migration: `0005_add_updated_at.sql`

```sql
ALTER TABLE doubles_matches ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE team_matches ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE doubles_ko ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE team_ko ADD COLUMN updated_at timestamptz DEFAULT now();
```

Existing PATCH API routes will set `updated_at = now()` on each update.

### Data flow

```
/d/page.tsx (server component)
  → Promise.all([
      fetchDoublesGroups(),
      fetchDoublesKo(),
      fetchLiveMatches('doubles'),
      fetchRecentResults('doubles', 10),
      fetchAllGroupStandings('doubles'),
      fetchAllMatchesByGroup('doubles', groupIds),
    ])
  → <ContentHome kind="doubles" groups={...} knockout={...} 
      liveMatches={...} recentResults={...} standings={...} matches={...} />
```

Same pattern for `/t/page.tsx` with team equivalents.

## UI Components

### File structure

| File | Components | Notes |
|------|-----------|-------|
| `_ContentHome.tsx` | `ContentHome` (server layout) | Rewrite, ~60 LOC |
| `_LiveCarousel.tsx` | `LiveMatchesCarousel`, `MatchCard` | New, ~100 LOC. `MatchCard` shared by live + results |
| `_StandingsSummary.tsx` | `StandingsSummaryCarousel` | New, ~70 LOC |
| `_RecentResults.tsx` | `RecentResultsCarousel` | New, ~40 LOC (reuses `MatchCard`) |
| `_ScheduleList.tsx` | `GroupScheduleList`, `KnockoutScheduleList`, `FilterChips`, `CompactMatchRow` | New, ~120 LOC |

### Swipe implementation

CSS-only: `scroll-snap-type: x mandatory` + `overflow-x: auto` on container, `scroll-snap-align: start` on each card. Dots indicator via `IntersectionObserver`. No external libraries.

### Shared `MatchCard` component

Used by both live carousel and recent results carousel. Props control variant:

- `variant: 'live' | 'done'` — controls border color (green vs gray), badge text, background
- Same layout: group badge, names, score, set pills

## `_publicGroup.tsx` Migration

Remove all mock imports. Receive data via props instead:

- `GroupStageTabs` receives `standings: Map<string, StandingRow[]>` and `matches: Map<string, MatchResolved[]>`
- `MatchesAccordion` receives matches via props (no more `MOCK_DOUBLES_MATCHES` filter)
- `StandingsDialog` receives standings via props (no more `getStandings()` call)

This file is used by both the new `ContentHome` and by group detail pages (`/d/[id]`, `/t/[id]`).

## Search Page Migration

Replace `searchPlayersAndMatches()` with Supabase queries:

- `doubles_players` / `team_players`: `WHERE name ILIKE '%query%'`
- `doubles_pairs` join players: match on player name
- `teams`: `WHERE name ILIKE '%query%'`
- `doubles_matches` / `team_matches`: join pairs/teams, match on names

Keep existing search UI, only replace data source.

## Cleanup

- **Delete** `src/app/_home.ts` — all consumers migrated
- **Delete** `src/app/_feedCards.tsx` — if no remaining consumers after migration (check `CompactMatchRow`, `GroupLeaderRow` usage)
- **Keep** `admin/_mock.ts` — types may still be referenced by admin UI. Full cleanup in Phase 7

## Out of Scope

- Home page (`page.tsx`) changes — stays as static event info
- `_mock.ts` removal — Phase 7
- `_components.tsx` split (~2400 LOC) — Phase 7
- Admin KO ranking bug — separate fix
- Entry swap UI — separate feature
