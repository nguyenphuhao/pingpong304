# Phase 6 — Knockout API + UI

## 1. Context

Giải có 2 nội dung:
- **Đôi:** 4 bảng × 2 = 8 cặp → QF (4) → SF (2) → F (1) = 7 trận. Best of 5.
- **Đồng đội:** 2 bảng × 2 = 4 đội → SF (2) → F (1) = 3 trận. SF best of 3, F best of 5.

Không có trận tranh hạng 3.

DB schema đã tồn tại: `doubles_ko`, `team_ko` (migration 0001). UI shell đã có: `KnockoutSection`, `KnockoutMatchCard`, `PublicKnockoutSection` — chỉ cần wire lên API.

## 2. Decisions

| # | Quyết định |
|---|---|
| 1 | Auto-seed cross-group: Đôi A1vD2, C1vB2, B1vC2, D1vA2. Đội A1vB2, B1vA2. |
| 2 | Admin có thể PATCH `entry_a`/`entry_b` để swap thủ công sau seed |
| 3 | Auto-advance: khi PATCH winner → server tự đẩy vào `next_match_id.next_slot` |
| 4 | Không có trận hạng 3 |
| 5 | Reuse `deriveDoublesWinner` cho doubles KO, `deriveTeamScore`/`deriveTeamWinner` cho teams KO |
| 6 | Teams KO sub-matches dùng cùng `SubMatchSchema` / `SubMatchResolved` type từ Phase 5A |
| 7 | Seed endpoint idempotent check: 409 nếu bracket đã tồn tại |

## 3. DB Schema (đã có, reference)

### doubles_ko
```sql
create table doubles_ko (
  id            text primary key,
  round         text not null check (round in ('qf','sf','f')),
  best_of       int not null,
  label_a       text,
  label_b       text,
  entry_a       text references doubles_pairs(id),
  entry_b       text references doubles_pairs(id),
  sets          jsonb not null default '[]'::jsonb,
  status        text not null default 'scheduled',
  winner        text,
  sets_a        int not null default 0,
  sets_b        int not null default 0,
  next_match_id text references doubles_ko(id),
  next_slot     text check (next_slot in ('a','b'))
);
```

### team_ko
```sql
create table team_ko (
  id            text primary key,
  round         text not null check (round in ('qf','sf','f')),
  label_a       text,
  label_b       text,
  entry_a       text references teams(id),
  entry_b       text references teams(id),
  status        text not null default 'scheduled',
  score_a       int not null default 0,
  score_b       int not null default 0,
  winner        text,
  individual    jsonb not null default '[]'::jsonb,
  lineup        jsonb,
  next_match_id text references team_ko(id),
  next_slot     text check (next_slot in ('a','b'))
);
```

Note: `team_ko` không có `best_of` hay `sets` ở match level — score tính từ `individual` sub-matches (giống `team_matches`).

## 4. API

### 4.1 Doubles KO

#### `POST /api/doubles/ko/seed`

1. Check `doubles_ko` table không rỗng → 409 "Bracket đã tồn tại"
2. Fetch all `doubles_groups` + `doubles_matches`
3. Compute standings per group dùng `assignRanks` (Phase 5B)
4. Lấy rank 1 + rank 2 mỗi bảng. Sort groups alphabetically (A, B, C, D).
5. Tạo 7 rows:

```
QF1: entry_a = A1, entry_b = D2, next_match_id = SF1, next_slot = 'a'
QF2: entry_a = C1, entry_b = B2, next_match_id = SF1, next_slot = 'b'
QF3: entry_a = B1, entry_b = C2, next_match_id = SF2, next_slot = 'a'
QF4: entry_a = D1, entry_b = A2, next_match_id = SF2, next_slot = 'b'
SF1: entry_a = null, entry_b = null, next_match_id = F, next_slot = 'a'
SF2: entry_a = null, entry_b = null, next_match_id = F, next_slot = 'b'
F:   entry_a = null, entry_b = null, next_match_id = null
```

6. IDs: `dko-qf1`, `dko-qf2`, `dko-qf3`, `dko-qf4`, `dko-sf1`, `dko-sf2`, `dko-f`
7. Labels: QF dùng "Nhất bảng X" / "Nhì bảng Y". SF dùng "Thắng TK 1" / "Thắng TK 2". F dùng "Thắng BK 1" / "Thắng BK 2".
8. `best_of = 5` cho tất cả trận.
9. Insert batch, return full bracket resolved.

#### `GET /api/doubles/ko`

Fetch all `doubles_ko` rows, resolve `entry_a`/`entry_b` → pair labels từ `doubles_pairs`.

Response type:
```ts
type DoublesKoResolved = {
  id: string;
  round: "qf" | "sf" | "f";
  bestOf: BestOf;
  table: number | null;
  labelA: string;
  labelB: string;
  entryA: { id: string; label: string } | null;
  entryB: { id: string; label: string } | null;
  sets: SetScore[];
  setsA: number;
  setsB: number;
  status: Status;
  winner: { id: string; label: string } | null;
  nextMatchId: string | null;
  nextSlot: "a" | "b" | null;
};
```

#### `GET /api/doubles/ko/[id]`

Single match resolved. 404 nếu không tồn tại.

#### `PATCH /api/doubles/ko/[id]`

Body schema (reuse `DoublesMatchPatchSchema` logic, thêm entry swap):
```ts
DoublesKoPatchSchema = z.object({
  sets: z.array(SetScoreSchema).max(5).optional(),
  status: StatusSchema.optional(),
  winner: IdSchema.nullable().optional(),
  bestOf: BestOfSchema.optional(),
  table: z.number().int().min(1).max(99).nullable().optional(),
  entryA: IdSchema.nullable().optional(),
  entryB: IdSchema.nullable().optional(),
});
```

Logic:
1. Parse + validate
2. Nếu `entryA`/`entryB` thay đổi → validate FK tồn tại trong `doubles_pairs`
3. Auto-compute `sets_a`, `sets_b`, `winner` từ sets (dùng `deriveDoublesWinner`)
4. **Auto-advance:** nếu winner vừa xác định + match có `next_match_id`:
   - Update `next_match_id` row: set `entry_a` (nếu `next_slot='a'`) hoặc `entry_b` (nếu `next_slot='b'`) = winner
   - Cả 2 update trong 1 transaction (hoặc sequential, Supabase không hỗ trợ multi-statement transaction qua client — dùng 2 calls nhưng rollback logic nếu call 2 fail)
5. **Auto-retract:** nếu winner bị xoá (status đổi từ done → scheduled) + match có `next_match_id`:
   - Clear slot tương ứng ở next match (set `entry_a`/`entry_b` = null)
   - Nếu next match cũng đã done → reject: "Không thể mở lại, trận tiếp đã hoàn thành"
6. Return resolved match

#### `DELETE /api/doubles/ko`

Xoá toàn bộ bracket (tất cả rows trong `doubles_ko`). Dùng cho reset.
Cần confirm ở UI trước khi gọi.

### 4.2 Teams KO

#### `POST /api/teams/ko/seed`

1. Check `team_ko` table không rỗng → 409
2. Fetch `team_groups` + `team_matches`
3. Compute standings per group dùng `assignRanks`
4. 2 bảng, sort alphabetically (A, B). Tạo 3 rows:

```
SF1: entry_a = A1, entry_b = B2, next_match_id = F, next_slot = 'a'
SF2: entry_a = B1, entry_b = A2, next_match_id = F, next_slot = 'b'
F:   entry_a = null, entry_b = null, next_match_id = null
```

5. IDs: `tko-sf1`, `tko-sf2`, `tko-f`
6. Labels: SF dùng "Nhất bảng X" / "Nhì bảng Y". F dùng "Thắng BK 1" / "Thắng BK 2".
7. Mỗi trận tạo kèm `individual` sub-matches (3 lượt):
   - `{id}-sub1`: label "Đôi", kind "doubles", bestOf 3
   - `{id}-sub2`: label "Đơn 1", kind "singles", bestOf 3
   - `{id}-sub3`: label "Đơn 2", kind "singles", bestOf 3
8. SF: best_of không áp dụng ở match level (score tính từ individual). F: tương tự.
9. Insert batch, return resolved.

#### `GET /api/teams/ko`

Fetch all, resolve `entry_a`/`entry_b` → team names, resolve `individual` sub-match players.

Response type:
```ts
type TeamKoResolved = {
  id: string;
  round: "qf" | "sf" | "f";
  labelA: string;
  labelB: string;
  entryA: { id: string; name: string } | null;
  entryB: { id: string; name: string } | null;
  scoreA: number;
  scoreB: number;
  status: Status;
  winner: { id: string; name: string } | null;
  individual: SubMatchResolved[];
  nextMatchId: string | null;
  nextSlot: "a" | "b" | null;
};
```

#### `PATCH /api/teams/ko/[id]`

Body schema (reuse `TeamMatchPatchSchema` logic, thêm entry swap):
```ts
TeamKoPatchSchema = z.object({
  individual: z.array(SubMatchSchema).min(1).max(7).optional(),
  status: StatusSchema.optional(),
  winner: IdSchema.nullable().optional(),
  entryA: IdSchema.nullable().optional(),
  entryB: IdSchema.nullable().optional(),
});
```

Logic:
1. Parse + validate
2. Entry swap validation (FK check teams table)
3. Player membership validation (giống team_matches route)
4. Auto-compute `score_a`, `score_b`, `winner` từ individual sub-matches
5. Auto-advance / auto-retract (giống doubles KO)
6. Return resolved

#### `DELETE /api/teams/ko`

Xoá toàn bộ bracket. Reset.

## 5. Shared code

### `src/lib/db/knockout.ts`

DB query functions:
```ts
fetchDoublesKo(): Promise<DoublesKoResolved[]>
fetchDoublesKoById(id: string): Promise<DoublesKoRow | null>
fetchTeamKo(): Promise<TeamKoResolved[]>
fetchTeamKoById(id: string): Promise<TeamKoRow | null>
```

### `src/lib/schemas/knockout.ts`

Zod schemas:
```ts
DoublesKoPatchSchema
TeamKoPatchSchema
```

Types:
```ts
DoublesKoResolved
TeamKoResolved
```

### Auto-advance logic in `src/lib/knockout/advance.ts`

```ts
advanceWinner(
  matchId: string,
  winner: string,
  nextMatchId: string | null,
  nextSlot: "a" | "b" | null,
  table: "doubles_ko" | "team_ko"
): Promise<void>

retractWinner(
  nextMatchId: string,
  nextSlot: "a" | "b",
  table: "doubles_ko" | "team_ko"
): Promise<void>
```

## 6. UI Changes

### Admin — `_components.tsx` (hoặc extract mới)

#### Knockout tab thêm:
- **Seed button:** "Tạo bracket từ BXH" → `POST /api/{doubles|teams}/ko/seed` → refresh
- **Reset button:** "Xoá bracket" → confirm dialog → `DELETE /api/{doubles|teams}/ko` → refresh
- Cả hai chỉ hiện khi phù hợp (seed khi chưa có bracket, reset khi đã có)

#### `KnockoutMatchCard` thay đổi:
- Wire save lên API (debounced, giống `MatchCard`/`TeamMatchCard` vòng bảng)
- Entry swap: dropdown pick `entry_a`/`entry_b` khi trận chưa bắt đầu
- Sau save thành công: callback `onMatchUpdated` để parent refresh bracket (auto-advance có thể thay đổi trận khác)
- Doubles: reuse `SetsEditor` component
- Teams: reuse `TeamMatchCard` sub-match logic (PlayerPicker, SubSetsEditor)
- Remove `MOCK_TEAMS` lookup, dùng team data từ props

#### Data flow:
- Admin page fetch từ `GET /api/{doubles|teams}/ko` (server component)
- Pass `knockout: DoublesKoResolved[] | TeamKoResolved[]` vào `ContentWorkspace`
- Sau seed/reset/save: `router.refresh()` để re-fetch

### Public — `_publicKnockout.tsx`

- Thay import từ `_mock.ts` → nhận data từ props (page server component fetch API)
- Resolve type: `DoublesKoResolved` / `TeamKoResolved` thay vì `KnockoutMatch`
- Teams sub-match display: map `individual: SubMatchResolved[]` thay vì `IndividualMatch` mock type

### Public pages cần thêm/sửa:
- `/d/page.tsx` — thêm knockout section (fetch `GET /api/doubles/ko`)
- `/t/page.tsx` — thêm knockout section (fetch `GET /api/teams/ko`)

## 7. Seeding algorithm detail

### Doubles (4 bảng → 8 entries)

Sort groups alphabetically → [A, B, C, D].
Lấy top 2 per group từ standings (rank 1 = nhất, rank 2 = nhì).

Cross-group pattern (tránh cùng bảng gặp nhau ở QF):
```
QF1: A1 vs D2  ──┐
                  SF1 ──┐
QF2: C1 vs B2  ──┘      │
                         F
QF3: B1 vs C2  ──┐      │
                  SF2 ──┘
QF4: D1 vs A2  ──┘
```

Nếu bảng có ít hơn 2 entries đủ rank → seed null, admin tự fill.

### Teams (2 bảng → 4 entries)

Sort groups alphabetically → [A, B].
```
SF1: A1 vs B2 ──┐
                 F
SF2: B1 vs A2 ──┘
```

## 8. File structure

**New files:**
- `src/lib/schemas/knockout.ts` — Zod schemas + resolved types
- `src/lib/db/knockout.ts` — DB query functions
- `src/lib/knockout/advance.ts` — auto-advance/retract logic
- `src/app/api/doubles/ko/route.ts` — GET all + DELETE all
- `src/app/api/doubles/ko/seed/route.ts` — POST seed
- `src/app/api/doubles/ko/[id]/route.ts` — GET + PATCH single
- `src/app/api/teams/ko/route.ts` — GET all + DELETE all
- `src/app/api/teams/ko/seed/route.ts` — POST seed
- `src/app/api/teams/ko/[id]/route.ts` — GET + PATCH single

**Modified files:**
- `src/app/admin/_components.tsx` — wire KO card to API, add seed/reset, entry swap
- `src/app/admin/doubles/page.tsx` — fetch KO from API instead of mock
- `src/app/admin/teams/page.tsx` — fetch KO from API instead of mock
- `src/app/_publicKnockout.tsx` — use resolved types instead of mock types
- `src/app/d/page.tsx` — add KO section
- `src/app/t/page.tsx` — add KO section

**Not modified (reused as-is):**
- `src/lib/matches/derive.ts` — `deriveDoublesWinner`, `deriveTeamScore`, `deriveTeamWinner`
- `src/lib/standings/compute.ts` + `tiebreaker.ts` — `assignRanks` for seeding
- `src/lib/schemas/match.ts` — `SubMatchSchema`, `SetScoreSchema`, etc.

## 9. Test plan

### Schema tests (`src/lib/schemas/knockout.test.ts`)
- DoublesKoPatchSchema: accepts sets, entry swap, rejects invalid
- TeamKoPatchSchema: accepts individual, entry swap, rejects invalid

### Advance logic tests (`src/lib/knockout/advance.test.ts`)
- advanceWinner: fills correct slot in next match
- retractWinner: clears slot, rejects if next match already done
- No next match: no-op

### API route tests
- POST seed: creates correct bracket structure, 409 on duplicate
- GET: returns resolved bracket
- PATCH: auto-compute, auto-advance, entry swap
- PATCH retract: undo winner, clear next slot
- DELETE: clears all

### Manual verification
- Seed doubles bracket, verify 7 matches with correct cross-group pairing
- Seed teams bracket, verify 3 matches
- Complete QF match → verify winner auto-advances to SF slot
- Undo QF result → verify SF slot cleared
- Swap entry manually → verify save
- Teams KO: assign players to sub-matches, enter scores, verify winner
- Public view: verify bracket displays correctly
- Reset bracket, re-seed

## 10. Risks

| Risk | Mitigation |
|---|---|
| Auto-advance race: 2 QF finish simultaneously, both write to same SF | Supabase single-row update is atomic. Each PATCH only writes to its own next slot (a or b). No conflict. |
| Retract cascade: undo QF when SF already done | Server rejects: "Không thể mở lại, trận tiếp đã hoàn thành" |
| Standings not ready when seeding | Check each group has enough entries with standings. Return 400 with message nếu thiếu. |
| `_components.tsx` quá lớn (~2200 LOC) | Extract KO components vào file riêng nếu thêm >200 LOC. Đây là cleanup, không block Phase 6. |

## 11. Out of scope

- Trận hạng 3
- Bracket layout dạng tree/diagram (giữ layout list-by-round hiện tại)
- Realtime updates
- Custom seeding patterns (hardcode cross-group pattern)
