# Phase 5A: Matches API + Schema Seed + Admin Migration (Group Stage) — Design

**Date:** 2026-04-16
**Status:** Approved, ready for implementation planning
**Parent spec:** `docs/superpowers/specs/2026-04-16-supabase-integration-design.md`
**Sibling phases:** Phase 4 (groups), Phase 5B (standings + tiebreaker, deferred), Phase 5C (home feed, deferred)
**Branch (planned):** `feat/supabase-phase-5a`

## 1. Mục tiêu + Scope

Phase 5A migrate group-stage matches (doubles round-robin + teams round-robin) khỏi mock và đặt nền API + admin UX cho match editing. Public + home **vẫn mock** đến 5B/5C. Knockout là Phase 6.

**Sau 5A có:**
- Schema seed `0003_seed_matches.sql` sinh round-robin matches từ `doubles_groups.entries` + `team_groups.entries` hiện tại (mirror logic mock).
- 2 PATCH routes: `/api/doubles/matches/[id]`, `/api/teams/matches/[id]` — full-replace, server-derive `sets_a/sets_b/score_a/score_b/winner`.
- 2 POST regenerate routes: `/api/{kind}/groups/[id]/regenerate-matches` — diff-aware (giữ matches có cặp tồn tại trong pairings mới, xóa stale, thêm mới).
- Admin group detail pages `/admin/{d,t}/groups/[id]` đọc matches từ DB qua `fetchDoublesMatchesByGroup` / `fetchTeamMatchesByGroup`.
- Team match: 3 sub mặc định, jsonb shape `{id, label, kind, playersA[], playersB[], bestOf, sets[]}`. Admin có thể add/remove sub khi cần (vd cho chung kết Phase 6 dự kiến 5 sub).
- Status machine **lỏng**: mọi transition cho phép; edit `done` không cần revert.

**Out of 5A (defer):**
- Public `/d/[id]`, `/t/[id]` matches list — vẫn mock.
- Standings DB views integration + tiebreaker — Phase 5B.
- `_home.ts` migration (getFeed, leaderOf, topNOf, getStandings) — Phase 5B/5C.
- KO matches — Phase 6.
- `_publicGroup.tsx` migration — Phase 5B.

## 2. Decisions (đã chốt với user)

| # | Hạng mục | Quyết định | Lý do |
|---|---|---|---|
| 1 | Scope | Admin-only group-stage. Public + home stay mock. | User chốt 5A boundary nhỏ nhất → verify dễ. |
| 2 | Seed | SQL migration `0003_seed_matches.sql` (run 1 lần khi deploy) sinh round-robin từ entries hiện tại. | Mirror `reorderRoundRobin` mock logic. Deterministic. |
| 3 | Regenerate | POST `/api/{kind}/groups/[id]/regenerate-matches`, **diff-aware**: giữ matches có cặp tồn tại trong pairings mới, xóa stale, thêm thiếu. Body `{}`. | An toàn — admin đổi entries không mất sets/winner đã edit. |
| 4 | API surface | Minimal: PATCH match + POST regenerate. **Không** GET / POST single / DELETE single. | Mirror Phase 4 PATCH-only. RSC fetch đủ. |
| 5 | Status machine | **Lỏng** — mọi transition cho phép. Edit `done` không cần revert. Server re-derive winner sau mỗi PATCH có sets/individual. | User chọn. Đơn giản nhất. Risk standings flip là vấn đề Phase 5B. |
| 6 | Winner derivation | **Server-side**: PATCH gửi raw inputs (sets/individual). Server compute `sets_a/sets_b/winner` (doubles), `score_a/score_b/winner` (teams). Client không gửi derived fields. | Single source of truth. Less client error. |
| 7 | Forfeit | `status='forfeit'` yêu cầu body có `winner: pairId\|teamId`. Server validate winner ∈ {pair_a, pair_b} (hoặc {team_a, team_b}). | Forfeit không có sets → cần explicit winner. |
| 8 | `done` resolution | `status='done'`: server derive winner từ sets/individual count. Nếu tied → 400 error "Chưa đủ set quyết định". | Tránh inconsistency winner null khi status=done. |
| 9 | Sets validation | Trust admin — chỉ validate shape (array, mỗi set `{a:int≥0, b:int≥0, ≤99}`). **Không** enforce 11-deuce. | Admin là source of truth. Phase 4 cùng triết lý. |
| 10 | Team match shape | `individual jsonb` = `Array<{id, label, kind: 'singles'\|'doubles', playersA: string[], playersB: string[], bestOf: 3\|5, sets: SetScore[]}>`. Default 3 sub khi regenerate. Admin add/remove qua PATCH. | Flexible cho chung kết Phase 6 (3 hoặc 5 sub). Schema không cần migration. |
| 11 | Sub-match player IDs | Reference `team_players(id)` qua array. Resolve label server-side khi fetch (mirror GroupResolved Phase 4). Validation: `playersA ⊆ team.members` (business rule ở handler, không zod). | Referential integrity, no FK in jsonb (app-level enforcement). |
| 12 | Sub-match cardinality | `singles`: `playersA.length === 1`, `playersB.length === 1`. `doubles`: length 2 mỗi bên. Zod refine. | Invariant rõ ràng. |
| 13 | Sub-match winner | Mỗi sub: derive từ sets count (cùng logic doubles match). Match-level `score_a/score_b` = đếm subs đã winner. Match `winner` derive khi `count > N/2` với N = `individual.length`. | Recursive winner derivation. |
| 14 | Resolved shape | `MatchResolved` (doubles) + `TeamMatchResolved` types: trả `{id, sideA: {id,label}, sideB: {id,label}, ...}` cho RSC + PATCH response. | Mirror GroupResolved Phase 4. |
| 15 | RSC helpers | `fetchDoublesMatchesByGroup(groupId)`, `fetchTeamMatchesByGroup(groupId)`, `fetchDoublesMatchById(id)`, `fetchTeamMatchById(id)` — đặt ở `src/lib/db/matches.ts`. | Mirror Phase 4 layout. |
| 16 | Match ID format | Doubles `dm{NN}` (vd `dm01`), Teams `tm{NN}`. Sub-match ID: `{matchId}-{suffix}` (vd `tm01-d`). Generated server-side. | Reuse `next-id.ts` pattern. |
| 17 | Mock boundary | `MOCK_DOUBLES_MATCHES`, `MOCK_TEAM_MATCHES`, `TEAM_MATCH_TEMPLATE` giữ export. Cleanup Phase 7. | Phase 4 precedent. Không break callers chưa migrate. |

## 3. Schema + Seed Migration

**Schema** đã đủ cho 5A — không cần ALTER. Recap relevant fields:

```sql
-- doubles_matches: id, group_id, pair_a, pair_b, "table", best_of, sets jsonb,
--                  status check (...), winner, sets_a, sets_b
-- team_matches:    id, group_id, team_a, team_b, "table", status check (...),
--                  score_a, score_b, winner, individual jsonb
```

Cả hai bảng đã có `status check (...) in ('scheduled','done','forfeit')`, default `scheduled`. `winner` text NULL.

### Migration mới: `supabase/migrations/0003_seed_matches.sql`

Functions PL/pgSQL idempotent + invocation block:

```sql
-- 0003_seed_matches.sql — initial round-robin seed for group-stage matches.
-- Idempotent: only inserts if matches table is empty for the group.
-- Tái tạo logic của reorderRoundRobin() trong _mock.ts (greedy avoid back-to-back).

create or replace function seed_round_robin_doubles(p_group_id text)
returns void language plpgsql as $$
declare
  v_entries text[];
  v_pairings record;
  v_n int := 0;
  v_id_seq int;
  v_existing int;
begin
  select count(*) into v_existing from doubles_matches where group_id = p_group_id;
  if v_existing > 0 then return; end if;

  select entries into v_entries from doubles_groups where id = p_group_id;
  if v_entries is null or array_length(v_entries, 1) is null then return; end if;

  select coalesce(max(substring(id from 'dm(\d+)')::int), 0) + 1
    into v_id_seq from doubles_matches;

  for v_pairings in
    select e1.entry as a, e2.entry as b
    from unnest(v_entries) with ordinality e1(entry, ord1)
    cross join unnest(v_entries) with ordinality e2(entry, ord2)
    where e1.ord1 < e2.ord2
    order by e1.ord1, e2.ord2
  loop
    insert into doubles_matches (id, group_id, pair_a, pair_b, best_of, sets, status)
    values (
      'dm' || lpad((v_id_seq + v_n)::text, 2, '0'),
      p_group_id, v_pairings.a, v_pairings.b, 3, '[]'::jsonb, 'scheduled'
    );
    v_n := v_n + 1;
  end loop;
end $$;

create or replace function seed_round_robin_teams(p_group_id text)
returns void language plpgsql as $$
declare
  v_entries text[];
  v_pairings record;
  v_n int := 0;
  v_id_seq int;
  v_existing int;
  v_match_id text;
begin
  select count(*) into v_existing from team_matches where group_id = p_group_id;
  if v_existing > 0 then return; end if;

  select entries into v_entries from team_groups where id = p_group_id;
  if v_entries is null or array_length(v_entries, 1) is null then return; end if;

  select coalesce(max(substring(id from 'tm(\d+)')::int), 0) + 1
    into v_id_seq from team_matches;

  for v_pairings in
    select e1.entry as a, e2.entry as b
    from unnest(v_entries) with ordinality e1(entry, ord1)
    cross join unnest(v_entries) with ordinality e2(entry, ord2)
    where e1.ord1 < e2.ord2
    order by e1.ord1, e2.ord2
  loop
    v_match_id := 'tm' || lpad((v_id_seq + v_n)::text, 2, '0');
    insert into team_matches (id, group_id, team_a, team_b, status, individual)
    values (
      v_match_id, p_group_id, v_pairings.a, v_pairings.b, 'scheduled',
      jsonb_build_array(
        jsonb_build_object('id', v_match_id || '-d',  'label', 'Đôi',
          'kind', 'doubles', 'playersA', '[]'::jsonb, 'playersB', '[]'::jsonb,
          'bestOf', 3, 'sets', '[]'::jsonb),
        jsonb_build_object('id', v_match_id || '-s1', 'label', 'Đơn 1',
          'kind', 'singles', 'playersA', '[]'::jsonb, 'playersB', '[]'::jsonb,
          'bestOf', 3, 'sets', '[]'::jsonb),
        jsonb_build_object('id', v_match_id || '-s2', 'label', 'Đơn 2',
          'kind', 'singles', 'playersA', '[]'::jsonb, 'playersB', '[]'::jsonb,
          'bestOf', 3, 'sets', '[]'::jsonb)
      )
    );
    v_n := v_n + 1;
  end loop;
end $$;

-- Seed all current groups
do $$ declare g record;
begin
  for g in select id from doubles_groups loop
    perform seed_round_robin_doubles(g.id);
  end loop;
  for g in select id from team_groups loop
    perform seed_round_robin_teams(g.id);
  end loop;
end $$;
```

**Notes:**
- SQL functions phục vụ **chỉ initial seed**. Regenerate API logic là **TS-only** (port sang `src/lib/matches/round-robin.ts`) để test dễ.
- Insert theo i<j order — không reorder back-to-back ở SQL. Admin có thể PATCH `table` field nếu cần thứ tự cụ thể. Reorder ergonomics-only, không phải invariant.
- ID format `dm{NN}`/`tm{NN}` — đổi mock `tmm{NN}` → `tm{NN}` thống nhất. Mock không bị ảnh hưởng (không dùng schema IDs).

## 4. Architecture / Data Flow

```
Admin /admin/{d,t}/groups/[id] (RSC)
  ↓ fetchDoublesGroupById / fetchTeamGroupById  [Phase 4, resolved]
  ↓ fetchDoublesMatchesByGroup / fetchTeamMatchesByGroup  [NEW]
  → props: group: GroupResolved, matches: MatchResolved[] | TeamMatchResolved[]

Admin client (DoublesSchedule / TeamSchedule, refactored)
  ↓ EditMatchDialog (existing) — types swap to ID-based
  ↓ optimistic update + sonner toast
  → fetch PATCH /api/{kind}/matches/[id]  [NEW]

Admin client (GroupRegenerateButton, NEW small component)
  → fetch POST /api/{kind}/groups/[id]/regenerate-matches  [NEW]

Route handlers
  PATCH /api/doubles/matches/[id]:
    requireAdmin → IdSchema(params.id) → fetchById → 404 nếu null
    → DoublesMatchPatchSchema.parse(body)
    → server-derive: sets_a, sets_b, winner-if-done
    → validate forfeit body (winner ∈ {pair_a, pair_b})
    → supabaseServer update
    → return resolved MatchResolved

  PATCH /api/teams/matches/[id]:
    + verify mỗi sub-match's playersA/playersB ⊆ team.members
    + derive sub-match winners → match-level score_a/score_b/winner

  POST /api/{kind}/groups/[id]/regenerate-matches:
    requireAdmin → IdSchema → fetchGroup → 404
    → fetch current matches for group + group.entries (resolved)
    → computeMatchDiff(currentMatches, generatePairings(group.entries))
       → {keep, delete, add}
    → execute inserts + deletes (best-effort sequential)
    → return { kept, deleted, added, matches: MatchResolved[] }

Supabase tables: doubles_matches, team_matches
```

**Boundaries (mới trong 5A):**

- **`src/lib/db/matches.ts`** — RSC fetch helpers + label resolution. 4 functions:
  - `fetchDoublesMatchesByGroup(groupId): MatchResolved[]`
  - `fetchTeamMatchesByGroup(groupId): TeamMatchResolved[]`
  - `fetchDoublesMatchById(id): MatchResolved | null`
  - `fetchTeamMatchById(id): TeamMatchResolved | null`
  - Resolution: 1-shot fetch matches + reuse `fetchPairs`/`fetchTeams` → build label map → resolve. Team helpers thêm `fetchTeamPlayersByTeam(teamId)` resolve mỗi sub-match's `playersA[]`/`playersB[]` → `[{id, name}]`.

- **`src/lib/schemas/match.ts`** — Zod schemas + types (chi tiết Section 5).

- **`src/lib/matches/round-robin.ts`** (NEW pure module) — diff logic, không touch DB:
  - `generatePairings(entries: string[]): Array<{a, b}>` — i<j combinations, optional reorder.
  - `computeMatchDiff(current, target): {keep, delete, add}` — pure, fully testable.
  - `nextMatchId(prefix: 'dm'|'tm', existing: id[]): id` — uses existing `next-id.ts` pattern.

- **`src/lib/matches/derive.ts`** (NEW pure module) — winner derivation:
  - `deriveSetCounts(sets): {a, b}` (mirror mock `setsSummary`).
  - `deriveDoublesWinner(sets, pairAId, pairBId, bestOf): id | null`.
  - `deriveTeamScore(individual): {scoreA, scoreB}`.
  - `deriveTeamWinner(individual, teamAId, teamBId): id | null`.
  - `deriveSubMatchWinner(sub, sideAId, sideBId): id | null`.

- **Route handlers** (4 files mới):
  - `src/app/api/doubles/matches/[id]/route.ts` (PATCH)
  - `src/app/api/teams/matches/[id]/route.ts` (PATCH)
  - `src/app/api/doubles/groups/[id]/regenerate-matches/route.ts` (POST)
  - `src/app/api/teams/groups/[id]/regenerate-matches/route.ts` (POST)

- **Auth:** `requireAdmin()` reuse Phase 2.
- **Validation:** `IdSchema` reuse cho `params.id`, `pair_a/b`, `team_a/b`, mỗi player ID trong sub-match. Body shape qua zod. Cross-validation (winner ∈ sides, players ⊆ team.members) là business rule trong handler.
- **Resolved shape:** Return resolved sau PATCH/POST cho client cập nhật optimistic state mà không cần re-fetch.

**Trade-off — regenerate transactional?**

- Sequential inserts/deletes — risk inconsistent state nếu network drop.
- Wrap RPC function (PL/pgSQL transaction) — atomic, nhưng test khó (cần DB).
- Best-effort sequential, return partial result — admin re-run sẽ converge (idempotent diff).

**Chọn: best-effort sequential + idempotent diff** — pure TS, test dễ, Phase 4 cùng triết lý.

## 5. API Endpoints

### PATCH `/api/doubles/matches/[id]`

**Request body** (all fields optional, partial update):
```ts
{
  sets?: Array<{a: number, b: number}>,  // full-replace
  status?: 'scheduled' | 'done' | 'forfeit',
  winner?: string | null,                // pair ID; required if status='forfeit'
  table?: number | null,
  bestOf?: 3 | 5,
}
```

**Flow:**
1. `requireAdmin()` → 401.
2. `IdSchema.parse(params.id)` → 400.
3. Fetch match `select id, pair_a, pair_b, sets, sets_a, sets_b, best_of, status from doubles_matches where id=?` → 404 nếu null.
4. `DoublesMatchPatchSchema.parse(body)` → 400.
5. **Forfeit gate**: nếu `body.status==='forfeit'` → require `body.winner`, validate `winner ∈ {pair_a, pair_b}` → 400.
6. **Server derive** (chỉ nếu `body.sets` hoặc `body.bestOf` có):
   - `{a, b} = deriveSetCounts(body.sets ?? existing.sets)`
   - `update.sets_a = a; update.sets_b = b`
   - Effective status = `body.status ?? existing.status`.
   - Nếu effective status `'done'`: `update.winner = deriveDoublesWinner(...)` — null (tied) → 400 `"Chưa đủ set quyết định"`.
   - Nếu effective `'forfeit'`: `update.winner = body.winner ?? existing.winner`.
   - Nếu effective `'scheduled'`: `update.winner = null`.
7. `supabaseServer.from('doubles_matches').update(updates).eq('id', params.id)`.
8. Fetch resolved qua `fetchDoublesMatchById(id)` → return 200 `{data: MatchResolved, error: null}`.

**Response codes:**

| Code | Khi nào | Body |
|---|---|---|
| 200 | Success | `{data: MatchResolved, error: null}` |
| 400 | Shape / forfeit-without-winner / done-but-tied / sets > bestOf | `{data: null, error: "..."}` |
| 401 | Không auth | `{data: null, error: "Unauthorized"}` |
| 404 | Match ID không tồn tại | `{data: null, error: "Trận không tồn tại"}` |
| 500 | Lỗi DB | `{data: null, error: "Internal error" \| err.message}` |

### PATCH `/api/teams/matches/[id]`

**Request body:**
```ts
{
  individual?: SubMatch[],     // full-replace
  status?: 'scheduled' | 'done' | 'forfeit',
  winner?: string | null,      // team ID; required if status='forfeit'
  table?: number | null,
}
```

**Flow** (khác doubles ở step 5–6):
1–4. Same shape (`TeamMatchPatchSchema`).
5. **Forfeit gate**: validate `winner ∈ {team_a, team_b}`.
6. **Player membership validation** (chỉ nếu `body.individual`):
   - Fetch `team_a.members` + `team_b.members` từ `teams` table.
   - Cho mỗi sub: `playersA ⊆ team_a.members` AND `playersB ⊆ team_b.members`. Sai → 400 `"VĐV {id} không thuộc đội {team_a/b name}"`.
7. **Server derive** (nếu `body.individual` có):
   - Cho mỗi sub: `subWinner = deriveSubMatchWinner(sub, team_a, team_b)`.
   - `{scoreA, scoreB} = deriveTeamScore(individual)` — count sub winners.
   - Effective status = `body.status ?? existing.status`.
   - Nếu effective `'done'`: `update.winner = deriveTeamWinner(individual, team_a, team_b)` → 400 nếu null.
   - Nếu effective `'forfeit'`: `update.winner = body.winner ?? existing.winner`.
   - Update `score_a`, `score_b`, `individual` (full jsonb), `winner`, `status`, `table`.
8. Fetch resolved qua `fetchTeamMatchById(id)` → return 200.

**Response codes:** same shape as doubles, thêm 400 cho player membership.

### POST `/api/doubles/groups/[id]/regenerate-matches`

**Request body:** `{}` (no params).

**Flow:**
1. `requireAdmin()` → 401.
2. `IdSchema.parse(params.id)` → 400.
3. `fetchDoublesGroupById(id)` → 404 nếu null. Lấy `group.entries.map(e => e.id)` (resolved IDs).
4. Fetch current matches: `select id, pair_a, pair_b from doubles_matches where group_id=?`.
5. **Pure compute**: `computeMatchDiff(current, generatePairings(entryIds))` → `{keep, delete, add}`.
6. Best-effort sequential:
   - `delete` IDs: `.in('id', deleteIds)`.
   - `insert` new matches: `.insert(addRows)` với generated IDs từ `nextMatchId`.
   - Bất kỳ failure → return 207 với partial result `{kept, deleted, added, error}`.
7. `fetchDoublesMatchesByGroup(id)` → return 200 `{data: {matches, summary: {kept, deleted, added}}, error: null}`.

**Response codes:**

| Code | Khi nào |
|---|---|
| 200 | Success — possibly no-op (kept all) |
| 207 | Partial — một số inserts/deletes failed |
| 401 | Không auth |
| 404 | Group ID không tồn tại |
| 500 | Compute / fetch error |

### POST `/api/teams/groups/[id]/regenerate-matches`

Mirror, thêm bước build default `individual` (3 sub empty: Đôi/Đơn 1/Đơn 2) cho mỗi match mới — như SQL seed function. PATCH-only-add: `keep` matches giữ nguyên `individual` đã edit.

### Zod schemas (`src/lib/schemas/match.ts`)

```ts
import { z } from "zod";
import { IdSchema } from "./id";

export const SetScoreSchema = z.object({
  a: z.number().int().min(0).max(99),
  b: z.number().int().min(0).max(99),
});

export const StatusSchema = z.enum(['scheduled', 'done', 'forfeit']);
export const BestOfSchema = z.union([z.literal(3), z.literal(5)]);

export const SubMatchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(50),
  kind: z.enum(['singles', 'doubles']),
  playersA: z.array(IdSchema).min(1).max(2),
  playersB: z.array(IdSchema).min(1).max(2),
  bestOf: BestOfSchema,
  sets: z.array(SetScoreSchema).max(5),
}).refine(
  s => s.kind === 'singles'
    ? s.playersA.length === 1 && s.playersB.length === 1
    : s.playersA.length === 2 && s.playersB.length === 2,
  { message: "Số VĐV không khớp loại sub-match" }
).refine(
  s => s.sets.length <= s.bestOf,
  { message: "Số set vượt quá bestOf" }
);

export const DoublesMatchPatchSchema = z.object({
  sets: z.array(SetScoreSchema).max(5).optional(),
  status: StatusSchema.optional(),
  winner: IdSchema.nullable().optional(),
  table: z.number().int().min(1).max(99).nullable().optional(),
  bestOf: BestOfSchema.optional(),
}).refine(
  data => data.status !== 'forfeit' || data.winner != null,
  { message: "Forfeit yêu cầu winner" }
);

export const TeamMatchPatchSchema = z.object({
  individual: z.array(SubMatchSchema).min(1).max(7).optional(),
  status: StatusSchema.optional(),
  winner: IdSchema.nullable().optional(),
  table: z.number().int().min(1).max(99).nullable().optional(),
}).refine(
  data => data.status !== 'forfeit' || data.winner != null,
  { message: "Forfeit yêu cầu winner" }
);

export type MatchResolved = {
  id: string;
  groupId: string;
  pairA: { id: string; label: string };
  pairB: { id: string; label: string };
  table: number | null;
  bestOf: 3 | 5;
  sets: Array<{ a: number; b: number }>;
  setsA: number;
  setsB: number;
  status: 'scheduled' | 'done' | 'forfeit';
  winner: { id: string; label: string } | null;
};

export type SubMatchResolved = {
  id: string;
  label: string;
  kind: 'singles' | 'doubles';
  playersA: Array<{ id: string; name: string }>;
  playersB: Array<{ id: string; name: string }>;
  bestOf: 3 | 5;
  sets: Array<{ a: number; b: number }>;
};

export type TeamMatchResolved = {
  id: string;
  groupId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  table: number | null;
  scoreA: number;
  scoreB: number;
  status: 'scheduled' | 'done' | 'forfeit';
  winner: { id: string; name: string } | null;
  individual: SubMatchResolved[];
};
```

## 6. Admin UX Changes

### Hiện trạng (mock-driven, sẽ refactor)

`src/app/admin/_components.tsx` đã có:
- `DoublesSchedule` + `DoublesMatchCard` + `EditMatchDialog` (sets editor) cho doubles.
- `TeamSchedule` + `TeamMatchCard` + `IndividualMatchRow` cho teams.
- Tất cả nhận props là mock types từ `_mock.ts`, mutate qua `useState`.

### Refactor scope cho 5A

**Strategy: Minimal-swap** (preserve UI, đổi types + thêm PATCH calls) — đúng spirit Phase 4 C4-C6 deviation đã được approve.

**Doubles (`DoublesSchedule` + `DoublesMatchCard` + `EditMatchDialog`):**
1. Đổi prop type `matches: DoublesMatch[]` → `matches: MatchResolved[]`.
2. `pairA`/`pairB` đổi từ string → `{id, label}`. Render: `match.pairA.label`.
3. `EditMatchDialog`: khi save → fetch `PATCH /api/doubles/matches/[id]` body `{sets, status}`, optimistic update + sonner toast.
4. Thêm status switcher (3 options: scheduled/done/forfeit) trong dialog. Forfeit chọn winner từ dropdown {pairA.label, pairB.label}.
5. Server response → cập nhật state với resolved match.
6. Skeleton loading khi fetch in-flight.

**Teams (`TeamSchedule` + `TeamMatchCard` + `IndividualMatchRow`):**
1. Đổi prop type `matches: TeamMatch[]` → `matches: TeamMatchResolved[]`.
2. `teamA`/`teamB` đổi string → `{id, name}`. Sub-match `playerA`/`playerB` (string) → `playersA`/`playersB` (`Array<{id, name}>`).
3. **Player picker (NEW):** `IndividualMatchRow` thêm slot picker — dropdown 1 player (singles) hoặc 2 (doubles) từ `team.members` (cần fetch team_players → label). Sources:
   - `playersA` options: `team_a.members` resolved labels (truyền props `teamAPlayers: Array<{id, name}>`).
   - `playersB` options: `team_b.members` resolved labels.
4. **Sub-match add/remove (NEW):** Default 3 sub. Nút "+ Thêm sub" trên match card. Mỗi sub có nút xóa (disabled nếu len ≤ 1). Sub mới = `{id: nanoid, label: "Sub mới", kind: 'singles', playersA: [], playersB: [], bestOf: 3, sets: []}`.
5. Save: gom toàn bộ `individual` array → fetch `PATCH /api/teams/matches/[id]` body `{individual, status}`. 1 round-trip.
6. Status switcher tương tự doubles.

**Group regenerate UI:**
- Trên `/admin/{d,t}/groups/[id]`, thêm component `GroupRegenerateButton` (NEW, ~30 dòng):
  - Button "Tạo lại lịch" + 1 confirm dialog: "Đồng bộ lịch theo entries hiện tại?" (skip preview — diff-aware đã safe).
  - On click → POST regenerate → toast `"Giữ X / Xóa Y / Thêm Z trận"` + `router.refresh()`.
- Default position: section header của matches list, kế bên "X trận".

**Components mới/thay đổi:**
- `_components.tsx`: refactor `DoublesSchedule`, `DoublesMatchCard`, `EditMatchDialog`, `TeamSchedule`, `TeamMatchCard`, `IndividualMatchRow`. **Không** rewrite — chỉ swap types + add fetch logic.
- NEW: `_match-actions.ts` — fetch helpers `patchDoublesMatch`, `patchTeamMatch`, `regenerateMatches(kind, groupId)` (mirror Phase 4).
- NEW: `_group-regenerate-button.tsx` — client component.
- NEW: `_player-picker.tsx` (~50 dòng) — dropdown 1-N players from team members.

**Optimistic UI (mirror Phase 4):**
- Edit dialog onSave → setLocalState(optimistic) → fetch PATCH → on success: setLocalState(server resolved) → toast success. On error: revert + toast error.
- Regenerate button → fetch POST → on success: `router.refresh()` → toast với summary.

**Existing UI (deferred to 5B):**
- Standings table render trên admin group detail (`computeStandings` trong `_components.tsx`) — **giữ nguyên** trong 5A bằng wrapper `MatchResolved → mock-shape (label-based)`. Phase 5B replace bằng standings views.
- Public `_publicGroup.tsx` — không touch.

## 7. Testing

**Mirror Phase 4 strategy: pure unit tests + colocated route tests + manual smoke.**

### Pure unit tests

**`src/lib/matches/round-robin.test.ts`** — diff logic:
- `generatePairings(['p01','p02','p03','p04'])` → 6 pairings, i<j order.
- `generatePairings([])` → `[]`. `generatePairings(['p01'])` → `[]`.
- `computeMatchDiff(current=[], target=[{a:'p01',b:'p02'}])` → `{keep:[], delete:[], add:[{a:'p01',b:'p02'}]}`.
- `computeMatchDiff` preserve khi pair tồn tại 2 chiều (canonical order so sánh).
- `computeMatchDiff` khi entries thay đổi: thêm cặp mới + xóa cặp cũ + giữ nguyên cặp còn.
- `nextMatchId('dm', ['dm01','dm03'])` → `'dm04'`.

**`src/lib/matches/derive.test.ts`** — winner derivation:
- `deriveSetCounts([{a:11,b:8},{a:9,b:11},{a:11,b:7}])` → `{a:2, b:1}`.
- `deriveDoublesWinner(sets='2-1', pairA='p01', pairB='p02', bestOf=3)` → `'p01'`.
- `deriveDoublesWinner(sets='1-1', ...)` → `null`.
- `deriveDoublesWinner(sets='2-2', bestOf=5)` → `null`.
- `deriveSubMatchWinner` cho singles + doubles sub.
- `deriveTeamScore(individual với 2 sub winner=A, 1 sub winner=B)` → `{scoreA:2, scoreB:1}`.
- `deriveTeamWinner` với 3 sub all done → returns winning team. Với 1 sub done → null.
- Edge: empty sets → counts (0,0), winner null.

### Schema tests (`src/lib/schemas/match.test.ts`)

- `SubMatchSchema` reject singles có 2 players, doubles có 1 player.
- `SubMatchSchema` reject sets > bestOf.
- `DoublesMatchPatchSchema` reject `status='forfeit'` không có winner.
- `DoublesMatchPatchSchema` reject sets có a/b âm hoặc > 99.
- `TeamMatchPatchSchema` reject individual array > 7 hoặc rỗng.

### Route tests (mock supabase, mirror Phase 4)

**`src/app/api/doubles/matches/[id]/route.test.ts`:**
- 401 / 400 malformed / 404.
- 200 PATCH sets only → re-derive setsA/setsB, status không đổi, winner null nếu chưa quyết.
- 200 PATCH sets + status='done' khi đủ quyết → winner derived.
- 400 PATCH status='done' khi sets tied → "Chưa đủ set quyết định".
- 400 PATCH status='forfeit' không có winner.
- 400 PATCH status='forfeit' winner không thuộc {pair_a, pair_b}.
- 200 PATCH status='forfeit' với valid winner.
- 200 PATCH status='scheduled' → reset winner=null.
- 200 PATCH table=null.
- 200 PATCH bestOf=5 → re-derive winner với new threshold.
- 500 nếu supabase update lỗi.

**`src/app/api/teams/matches/[id]/route.test.ts`:**
- All doubles equivalents.
- 400 sub-match player không thuộc team.members.
- 400 sub-match singles có 2 players.
- 200 PATCH individual full-replace → re-derive scoreA/scoreB/winner.
- 200 PATCH individual với mixed singles/doubles subs.
- 200 PATCH individual reduce 3 → 1.
- 200 PATCH individual mở rộng 3 → 5.

**`src/app/api/doubles/groups/[id]/regenerate-matches/route.test.ts`:**
- 401 / 404 / 400 standard.
- 200 group rỗng → no-op.
- 200 first run (no matches) → add toàn bộ pairings.
- 200 idempotent re-run (same entries, no edits) → keep all.
- 200 entries đổi → keep matching, delete stale, add new.
- 200 keep matches có sets/winner đã edit (gọi 2 lần, lần 2 không touch trận đã edit).
- 207 partial failure khi insert lỗi giữa chừng.

**`src/app/api/teams/groups/[id]/regenerate-matches/route.test.ts`:**
- All doubles equivalents.
- New matches có default 3 sub empty (Đôi/Đơn 1/Đơn 2).
- Keep matches preserve `individual` đã edit.

### DB helper tests (`src/lib/db/matches.test.ts`)

- `fetchDoublesMatchesByGroup` resolve pairs labels từ pair IDs.
- `fetchTeamMatchesByGroup` resolve teams + sub-match players.
- `fetchDoublesMatchById` returns null nếu không tồn tại.
- Resolution: ID không có trong pair/player table → label `"?"`.

### Manual smoke test (cuối phase)

1. `bun run db:reset` + apply migrations 0001-0003 → verify matches seed.
2. Login admin → `/admin/doubles/groups/gA` → thấy 3 trận round-robin (3 cặp trong gA, C(3,2)=3).
3. Click trận đầu → edit dialog → input sets `11-8, 11-7` → status='done' → save → verify winner = pairA, toast success.
4. Re-edit → đổi sets `11-8, 9-11, 11-5` → save → winner vẫn pairA, setsA=2 setsB=1.
5. Status='scheduled' → save → winner cleared.
6. Status='forfeit' không pick winner → 400 error toast.
7. Status='forfeit' + pick winner=pairB → save → winner=pairB.
8. `/admin/teams/groups/gtA` → trận đầu → edit individual: sub Đôi pick 2 players từ team A + 2 từ team B → input sets → save → verify subMatch winner derived.
9. Add sub mới (kind=singles) → save → verify 4 sub.
10. Click "Tạo lại lịch" → confirm → verify toast `"Giữ N / Xóa 0 / Thêm 0"`.
11. Vào admin groups → swap pair p05 từ gB sang gA → quay lại `/admin/doubles/groups/gA` → click "Tạo lại lịch" → verify toast `"Giữ 3 / Xóa 0 / Thêm 3"`.
12. `tsc --noEmit` clean. `bun test` pass. `bun run build` 18+ routes.

### Counts target

Phase 4 = 165 tests. Phase 5A target ~84 tests mới → **~249 total**.

## 8. Out of Scope (Defer) + Risk Register

### Out of 5A — defer rõ ràng

| Item | Defer to | Lý do |
|---|---|---|
| Public `/d/[id]`, `/t/[id]` matches list migrate | 5B | Render chung với standings → migrate cùng lúc tránh half-DB-half-mock UI. |
| `_publicGroup.tsx` matches reference | 5B | Same. |
| Standings DB views integration | 5B | Cần matches có data trước. |
| Tiebreaker TS layer (head-to-head mini-league) | 5B | Sau views integration. |
| `_home.ts: getStandings` migrate | 5B | Phase 4 đã refactor signature, sẵn sàng. |
| `_home.ts: getFeed, leaderOf, topNOf, getGroupLeaders, getGroupTops` | 5C | Home page consumers. |
| `_home.ts: searchPlayersAndMatches` | 5C / 7 | Search functionality. |
| KO matches API + UI | Phase 6 | `team_ko`, `doubles_ko` schema riêng. |
| `_mock.ts` cleanup hoàn toàn | Phase 7 | Nhiều callers chưa migrate. |
| GET endpoints cho matches | Phase post-5C nếu cần | RSC fetch đủ. Add khi cần client polling. |
| Live scoring real-time (Supabase realtime) | Future | Chưa có yêu cầu. |
| Match history / undo log | Future | Chưa có yêu cầu. |
| Admin batch edit | Future | YAGNI. |
| Drag-reorder matches (table assignment UX) | Future | Chỉ PATCH `table` field qua dialog. |

### Risk register

**R1 — Mock matches dùng labels (string), DB dùng IDs**
- *Risk:* RSC helpers + admin UX phải resolve IDs → labels. Bug nếu mismatch.
- *Mitigation:* `MatchResolved` type với `pairA: {id, label}`, server-side resolution trong `src/lib/db/matches.ts`. Test cover ID-not-found → label `"?"`.

**R2 — Sub-match player IDs vs team_players FK (jsonb)**
- *Risk:* Player có thể bị xóa khỏi `teams.members` mà sub-match jsonb vẫn reference → resolution `?`.
- *Mitigation:* PATCH validate `playersA ⊆ team_a.members` tại write time. Read time graceful (label `?`). Phase 7 thêm GC nếu cần.

**R3 — Regenerate diff edge cases**
- *Risk:* Pair swap qua group khác → regenerate gA xóa pair, regenerate gB thêm. Nếu admin chỉ regen 1 group → lệch.
- *Mitigation:* Diff-aware là per-group. Document UX. Toast remind sau regenerate (nice-to-have, defer).

**R4 — Schema seed (migration 0003) chạy lại trên DB đã có data**
- *Risk:* Seed function có guard `existing > 0 → return`, nhưng nếu admin xóa hết matches thì re-seed → tạo lại với entries hiện tại.
- *Mitigation:* Idempotent guard ở SQL function. Document trong migration comment.

**R5 — Status='done' với tied sets**
- *Risk:* Admin thử set status='done' khi sets chưa quyết → 400. UX có thể confuse.
- *Mitigation:* Frontend pre-validate trước khi enable nút "Đặt done". Backend defense-in-depth.

**R6 — Best-effort regenerate có partial state**
- *Risk:* Insert/delete fail giữa chừng → state không nhất quán.
- *Mitigation:* Pure diff function tự convergence khi admin re-run. Return 207 cho admin biết.

**R7 — Team match individual array có ID conflicts khi add/remove**
- *Risk:* Sub IDs phải unique trong array. Admin add sub mới cần ID generation.
- *Mitigation:* Sub ID = match-id + nanoid suffix. Server validate uniqueness trong array.

**R8 — Mock Group/DoublesMatch type drift**
- *Risk:* `_home.ts` còn dùng mock types — Phase 5A migrate `_components.tsx` to `MatchResolved` có thể require Group casting hack.
- *Mitigation:* Admin pages 5A dùng `GroupResolved` (Phase 4). `MatchResolved` mới — không touch mock types. Boundary ở `_home.ts` defer 5B/5C.

**R9 — Phase 4 standings (computeStandings trong _components.tsx) còn dùng mock-shape**
- *Risk:* Admin group detail page render standings từ matches local. Phase 5A swap matches to `MatchResolved` → standings function cần reshape.
- *Mitigation:* Wrapper `MatchResolved → DoublesMatch-shape (label-based)` để feed legacy `computeStandings` trong 5A. Phase 5B replace bằng DB views.
