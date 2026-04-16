# Supabase Integration Design — PingPong304

**Date:** 2026-04-16
**Status:** Design approved, ready for implementation planning

## 1. Mục tiêu

Tích hợp Supabase làm database cho giải ping-pong PingPong304. Hiện tại repo đã có đầy đủ UI và flow (public pages + admin pages) nhưng toàn bộ data đang hardcode trong `src/app/admin/_mock.ts`. Mục tiêu là thay thế mock data bằng Supabase + API layer, làm **từng tính năng một** theo dependency, để UI vẫn chạy xuyên suốt quá trình migrate.

## 2. Decisions (đã chốt với user)

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Auth | Giữ password cứng `123456` + cookie `pp_admin` (nguyên trạng) |
| 2 | API style | Next.js Route Handlers tại `src/app/api/**` |
| 3 | Thứ tự làm | Theo entity dependency: Players → Pairs/Teams → Groups → Matches → KO |
| 4 | Schema | Tách bảng hoàn toàn giữa Doubles & Teams (mirror 1-1) |
| 5 | ID | `text` primary key, giữ nguyên id từ mock (`p1`, `pair-3`, `grp-A`...) |
| 6 | Realtime | Không dùng — user reload là đủ |
| 7 | API keys | Publishable key (public reads), Secret key (admin writes, server-only) |
| 8 | Arrays | `text[]` cho `entries`, `members` — map thẳng mock |
| 9 | Tiebreaker Đôi | Win count → H2H (2-tied) / Mini-league (3+), không dùng hiệu số điểm nhỏ |
| 10 | Tiebreaker Teams | Giống Đôi, đơn vị = trận thành phần (không dùng hiệu số ván) |
| 11 | Forfeit | Status `forfeit`, lưu `sets_a=2/3, sets_b=0, sets=[]` |
| 12 | Bốc thăm | Không xử lý tự động — để tied, admin tự quyết ngoài đời |
| 13 | Cache columns | `winner, sets_a, sets_b` trên matches (bỏ `points_a/b`) |
| 14 | Standings API | Vừa embedded trong `GET /groups/[id]`, vừa có endpoint riêng `/groups/[id]/standings` |

## 3. Kiến trúc

```
UI (Server + Client Components)
   ↓ fetch
Route Handlers  (src/app/api/**/route.ts)
   ↓ @supabase/supabase-js
Supabase (Postgres)
```

**Files mới cần tạo:**

- `src/lib/supabase/server.ts` — client với `SUPABASE_SECRET_KEY`, chỉ dùng trong admin route handlers
- `src/lib/supabase/public.ts` — client với `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dùng cho public reads
- `src/lib/db/types.ts` — re-export types từ `_mock.ts` thành source-of-truth cho DB layer
- `src/lib/standings/compute.ts` — pure function tính standings từ matches
- `src/lib/standings/tiebreaker.ts` — resolve tiebreaker đệ quy theo rule VN
- `supabase/migrations/*.sql` — schema migrations
- `supabase/seed.sql` — seed từ mock data
- `.env.local` — env vars

**Env vars:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

**Auth:** Giữ nguyên `src/lib/auth.ts` + middleware `src/proxy.ts`. Route handlers admin check cookie `pp_admin` trước khi mutate. RLS tắt (dùng secret key bypass).

## 4. Schema

### 4.1. Doubles

```sql
create table doubles_players (
  id text primary key,
  name text not null,
  phone text,
  gender text check (gender in ('M','F')),
  club text
);

create table doubles_pairs (
  id text primary key,
  p1 text references doubles_players(id),
  p2 text references doubles_players(id)
);

create table doubles_groups (
  id text primary key,
  name text not null,
  entries text[] not null default '{}'  -- array of pair ids
);

create table doubles_matches (
  id text primary key,
  group_id text references doubles_groups(id) on delete cascade,
  pair_a text references doubles_pairs(id),
  pair_b text references doubles_pairs(id),
  "table" int,
  best_of int check (best_of in (3,5)) not null,
  sets jsonb not null default '[]',        -- [{a,b}, ...]
  status text check (status in ('scheduled','done','forfeit')) not null default 'scheduled',
  winner text,                             -- pair_a or pair_b id; null until done
  sets_a int not null default 0,           -- sets won by A in this match
  sets_b int not null default 0            -- sets won by B in this match
);

create table doubles_ko (
  id text primary key,
  round text check (round in ('qf','sf','f')) not null,
  best_of int not null,
  label_a text, label_b text,
  entry_a text references doubles_pairs(id),
  entry_b text references doubles_pairs(id),
  sets jsonb not null default '[]',
  status text check (status in ('scheduled','done','forfeit')) not null default 'scheduled',
  winner text,
  sets_a int not null default 0,
  sets_b int not null default 0,
  next_match_id text references doubles_ko(id),
  next_slot text check (next_slot in ('a','b'))
);
```

### 4.2. Teams

```sql
create table team_players (
  id text primary key,
  name text not null,
  phone text,
  gender text check (gender in ('M','F')),
  club text
);

create table teams (
  id text primary key,
  name text not null,
  members text[] not null default '{}'   -- array of team_player ids
);

create table team_groups (
  id text primary key,
  name text not null,
  entries text[] not null default '{}'   -- array of team ids
);

create table team_matches (
  id text primary key,
  group_id text references team_groups(id) on delete cascade,
  team_a text references teams(id),
  team_b text references teams(id),
  "table" int,
  status text check (status in ('scheduled','done','forfeit')) not null default 'scheduled',
  score_a int not null default 0,          -- số trận thành phần A thắng
  score_b int not null default 0,
  winner text,                             -- team_a or team_b id
  individual jsonb not null default '[]'   -- [{id,label,playerA,playerB,bestOf,sets}]
);

create table team_ko (
  id text primary key,
  round text check (round in ('qf','sf','f')) not null,
  label_a text, label_b text,
  entry_a text references teams(id),
  entry_b text references teams(id),
  status text check (status in ('scheduled','done','forfeit')) not null default 'scheduled',
  score_a int not null default 0,
  score_b int not null default 0,
  winner text,
  individual jsonb not null default '[]',
  lineup jsonb,                            -- TeamLineup
  next_match_id text references team_ko(id),
  next_slot text check (next_slot in ('a','b'))
);
```

### 4.3. Ghi chú về cache columns

`winner`, `sets_a`, `sets_b` (hoặc `score_a/score_b` cho teams) là **giá trị của 1 trận đó**, không phải tích luỹ. Tính 1 lần khi admin submit kết quả:
- Parse `sets jsonb`
- `sets_a` = count sets where `a > b`
- `sets_b` = count sets where `b > a`
- `winner` = pair/team id có sets nhiều hơn (hoặc theo forfeit rule)

Mục đích: aggregate standings không cần parse `sets jsonb` mỗi lần.

### 4.4. Forfeit

Khi mark forfeit:
- BO3 → `sets_a=2, sets_b=0` (hoặc ngược lại)
- BO5 → `sets_a=3, sets_b=0`
- `sets = []` (không điền score giả)
- `status = 'forfeit'`
- UI hiển thị "W.O." (walkover)

Với team_matches (BO3 cố định 3 trận thành phần): `score_a=2, score_b=0` + `individual=[]`.

### 4.5. Views

```sql
create view doubles_standings_raw as
select
  m.group_id,
  e.entry_id,
  count(*) filter (where m.status in ('done','forfeit')) as played,
  sum(case when m.winner = e.entry_id then 1 else 0 end) as won,
  sum(case when m.winner is not null and m.winner <> e.entry_id then 1 else 0 end) as lost,
  sum(case when e.entry_id = m.pair_a then m.sets_a else m.sets_b end) as sets_won,
  sum(case when e.entry_id = m.pair_a then m.sets_b else m.sets_a end) as sets_lost
from doubles_matches m,
     lateral (values (m.pair_a), (m.pair_b)) as e(entry_id)
where m.status in ('done','forfeit')
group by m.group_id, e.entry_id;
```

View tương tự cho `team_standings_raw` (thay `sets_a/b` bằng `score_a/b`).

View chỉ tính **tổng overall**. Tiebreaker H2H / mini-league tính ở TS layer (dễ test, dễ đọc).

## 5. Standings & Tiebreaker Logic

### 5.1. Rule Đôi

- **Điểm** = số trận thắng (thắng +1, thua/bỏ cuộc 0)
- Chỉ số phụ: tổng ván thắng/thua, hiệu số ván
- Xếp hạng:
  1. Số trận thắng
  2. **Nếu 2 đôi bằng nhau:** đối đầu trực tiếp → hiệu số ván → tổng ván thắng → bốc thăm
  3. **Nếu ≥3 đôi bằng nhau:** lập bảng phụ chỉ gồm trận giữa các đôi đó, xếp theo: số trận thắng trong bảng phụ → hiệu số ván trong bảng phụ → tổng ván thắng trong bảng phụ. Sau đó nếu còn đúng 2 đôi tied thì quay về rule 2-tied.

### 5.2. Rule Đồng đội (Teams)

Giống rule Đôi, nhưng:
- **Đơn vị đo** = trận thành phần (individual sub-match), KHÔNG dùng hiệu số ván
- Chỉ số: tổng trận thành phần thắng/thua, hiệu số trận thành phần
- Chỉ tính các trận thành phần đã đấu thực tế hoặc xử thắng/thua. KHÔNG tính "dead rubber" sau khi đã xác định thắng chung cuộc.

### 5.3. Implementation

```ts
// src/lib/standings/tiebreaker.ts

type Row = {
  entryId: string;
  played: number;
  won: number;
  lost: number;
  // Đôi: setsWon/Lost; Teams: subWon/Lost
  unitWon: number;
  unitLost: number;
};

function resolveTies(
  rows: Row[],
  matches: Match[],
): (Row & { rank: number; tied: boolean })[] {
  // 1. Sort by won desc
  // 2. Group rows with same `won`
  // 3. For each tied group:
  //    - size 1: assign rank, done
  //    - size 2: apply H2H rule (winner of direct match ranks higher;
  //      if no direct match or forfeit'd → compare unitDiff → unitWon → leave tied)
  //    - size >= 3: build mini-league from matches where both sides ∈ group,
  //      recompute Row on that subset, recursively resolveTies on mini-league.
  //      After recursion, if sub-group still tied → leave tied.
  // 4. Return flat sorted array with rank + tied flag
}
```

Pure function, no side effects, fully testable.

**Bốc thăm:** Sau mọi bước, nếu vẫn còn tied → set `tied: true` và giữ nguyên thứ tự input. Admin tự quyết ngoài đời.

### 5.4. Standings response shape

```ts
type StandingRow = {
  rank: number;
  tied: boolean;
  entryId: string;       // pair_id hoặc team_id
  played: number;
  won: number;
  lost: number;
  // Đôi:
  setsWon: number;
  setsLost: number;
  setsDiff: number;
  // Teams:
  subWon: number;
  subLost: number;
  subDiff: number;
  points: number;        // = won
};
```

Trả về riêng cho Đôi (chỉ có `sets*`) hoặc Teams (chỉ có `sub*`).

## 6. API endpoints

### 6.1. Quy ước

- **Path:** `/api/<content>/<entity>[/<id>][/<sub>]`
- **Response:** `{ data, error }` giống Supabase
- **Auth:**
  - `GET` → public, dùng publishable key
  - `POST/PATCH/DELETE` → check cookie `pp_admin`, dùng secret key; trả `401` nếu thiếu

### 6.2. Danh sách đầy đủ

**Auth (2)**
- `POST /api/auth/login` — `{ password }` → set cookie
- `POST /api/auth/logout` → clear cookie

**Doubles — Players (5)**
- `GET /api/doubles/players`
- `POST /api/doubles/players`
- `GET /api/doubles/players/[id]`
- `PATCH /api/doubles/players/[id]`
- `DELETE /api/doubles/players/[id]`

**Doubles — Pairs (5)**
- `GET /api/doubles/pairs` (query `?groupId=`)
- `POST /api/doubles/pairs`
- `GET /api/doubles/pairs/[id]` (embed player info)
- `PATCH /api/doubles/pairs/[id]`
- `DELETE /api/doubles/pairs/[id]`

**Doubles — Groups (6)**
- `GET /api/doubles/groups`
- `POST /api/doubles/groups`
- `GET /api/doubles/groups/[id]` → `{ group, matches, standings }`
- `PATCH /api/doubles/groups/[id]`
- `DELETE /api/doubles/groups/[id]`
- `GET /api/doubles/groups/[id]/standings`

**Doubles — Matches (5)**
- `GET /api/doubles/matches` (query `?groupId=`)
- `POST /api/doubles/matches`
- `GET /api/doubles/matches/[id]`
- `PATCH /api/doubles/matches/[id]` — update sets/status/forfeit; server auto-compute winner/sets_a/sets_b
- `DELETE /api/doubles/matches/[id]`

**Doubles — Knockout (4)**
- `GET /api/doubles/ko` — full bracket (qf/sf/f)
- `POST /api/doubles/ko` — seed/create
- `GET /api/doubles/ko/[id]`
- `PATCH /api/doubles/ko/[id]` — update + auto-advance winner vào `next_match_id` slot

**Teams** — mirror toàn bộ cấu trúc Doubles (players/teams/groups/matches/ko) — 25 endpoints

**Search & Misc**
- `GET /api/search?q=` — cross-content player/match search
- `GET /api/feed` — nếu home page cần feed tổng hợp

**Tổng: ~54 endpoints.**

### 6.3. Auto-compute rules

Khi `PATCH /api/doubles/matches/[id]` với `sets` hoặc `status='forfeit'`:
1. Validate sets theo `best_of`
2. Tính `sets_a`, `sets_b` từ `sets[]`
3. Xác định `winner`
4. Nếu match nằm trong KO → auto-advance winner vào `next_match_id` + `next_slot`
5. Response trả về match đã update

Với teams: thêm logic đếm `individual` đã done, chỉ tính đến khi 1 bên đủ 2/3 → các sub-match sau là dead rubber (vẫn lưu nếu admin nhập, nhưng không tính vào standings).

## 7. Phasing plan

Mỗi phase độc lập, testable, ship được. Trong mỗi phase, UI chưa migrate vẫn dùng `_mock.ts`.

### Phase 0 — Setup (1 lần, ~30 phút)

- Tạo Supabase project
- `npm install @supabase/supabase-js`
- Tạo `.env.local`
- Tạo `src/lib/supabase/{server,public}.ts`
- Tạo `supabase/migrations/` folder

### Phase 1 — Schema & seed toàn bộ

- Viết migration SQL cho tất cả bảng 2 nội dung
- Tạo views `doubles_standings_raw`, `team_standings_raw`
- Viết script export `_mock.ts` → `supabase/seed.sql`
- Chạy migration + seed → verify trên Supabase Studio

### Phase 2 — Players (cả 2 nội dung)

- API: `/api/doubles/players/*`, `/api/teams/players/*`
- UI: admin players pages swap sang fetch API
- Public: chưa cần

### Phase 3 — Pairs + Teams

- API: `/api/doubles/pairs/*`, `/api/teams/teams/*`
- UI: admin pairs/teams pages swap sang API

### Phase 4 — Groups

- API: `/api/doubles/groups/*`, `/api/teams/groups/*` (chưa có standings)
- UI: admin groups + public list groups swap

### Phase 5 — Matches + Standings (phase nặng nhất)

- Helper `src/lib/standings/{compute.ts, tiebreaker.ts}` + unit tests đầy đủ
- API: matches CRUD + standings endpoints (embedded + dedicated)
- UI: admin edit match (auto compute server-side) + public standings page swap

### Phase 6 — Knockout

- API: KO CRUD + auto-advance logic
- UI: admin KO editor + public bracket view swap

### Phase 7 — Search & cleanup

- API: `/api/search`
- UI: search page swap
- Xoá `_mock.ts` hoặc giữ làm test fixture

### Phase 8 — Auth migration (optional, future)

- Giữ password cứng theo decision hiện tại. Chỉ upgrade Supabase Auth khi có yêu cầu.

### 7.1. Quy trình swap trong mỗi phase

1. Schema + seed đã sẵn sàng (từ Phase 1)
2. Viết API route handler
3. Test API bằng curl/Postman
4. Swap import trong UI từ `_mock.ts` → `fetch('/api/...')`
5. Manual verify UI
6. Commit

Rollback: revert commit UI swap → UI quay về dùng mock.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `text[]` không có FK constraint → id "ma" khi xoá pair/player | Validate ở API layer trước khi insert/update; API `DELETE /pairs/[id]` check xem còn dùng trong group/match nào không |
| Cache columns (`winner, sets_a, sets_b`) lệch với `sets jsonb` | Chỉ compute server-side trong route handler; UI không được gửi `winner/sets_a/sets_b` — server tự tính |
| Tiebreaker đệ quy edge case | Unit test kỹ: 2 tied, 3 tied, 4 tied, bảng phụ tách ra 2 nhóm con, vẫn tied sau mọi bước |
| Dead rubber trong team_matches | `compute.ts` chỉ đếm individual matches đến khi 1 bên đủ 2/3 |
| KO auto-advance sai slot | `PATCH /ko/[id]` transaction: update match + update next slot atomic; có test |

## 9. Out of scope

- Supabase Auth migration
- Realtime subscriptions
- Upload avatar player
- Export PDF/Excel bảng xếp hạng
- Multi-tournament support
- Bốc thăm tự động
- Tính hiệu số điểm nhỏ (11-9)

## 10. Next step

Invoke `writing-plans` skill để tạo implementation plan chi tiết cho Phase 0 + Phase 1 trước (setup + schema). Các phase sau có thể planning riêng từng cái khi bắt đầu.
