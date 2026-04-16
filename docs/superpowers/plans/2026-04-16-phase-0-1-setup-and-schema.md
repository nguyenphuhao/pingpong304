# Phase 0 + 1: Supabase Setup & Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Supabase integration infrastructure and create the full database schema + seed data from `_mock.ts` for PingPong304.

**Architecture:** Next.js 16 App Router app, adding Supabase (Postgres) as DB. Two Supabase clients (publishable key for reads, secret key server-only for writes). Schema mirrors `_mock.ts` types with `text` PKs. Seed via a Node script that imports `_mock.ts` and emits idempotent SQL.

**Tech Stack:** Next.js 16, TypeScript, `@supabase/supabase-js` v2, `tsx` for running the seed-generator script.

**Spec reference:** `docs/superpowers/specs/2026-04-16-supabase-integration-design.md` — Phase 0 & Phase 1 only.

**Checkpoint-driven execution:** This plan is broken into 3 checkpoints. At each checkpoint, STOP and wait for user confirmation before continuing. Do not proceed to the next checkpoint until the user says "ok" / "tiếp tục" / equivalent.

---

## Checkpoint A — Infrastructure

Install deps, set up clients and env. Nothing yet touches the DB. Goal: verify everything compiles and env is valid.

### Task A1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install**

```bash
cd /Users/haonguyen/Projects/pingpong304
npm install @supabase/supabase-js
npm install -D tsx
```

- [ ] **Step 2: Verify**

Run: `npm ls @supabase/supabase-js tsx`
Expected: both packages listed with versions.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @supabase/supabase-js and tsx"
```

### Task A2: Env template and gitignore

**Files:** `.env.local.example`, `.gitignore`

- [ ] **Step 1: Create `.env.local.example`**

```env
# Supabase project URL (Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co

# Publishable key — safe to expose in client (replaces anon key)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

# Secret key — SERVER ONLY, never expose. Used by admin route handlers to bypass RLS.
SUPABASE_SECRET_KEY=sb_secret_xxx
```

- [ ] **Step 2: Ensure `.env.local` is git-ignored**

Read `.gitignore`. If it does not already contain `.env.local` or `.env*`, append `.env.local` on its own line.

- [ ] **Step 3: Commit template**

```bash
git add .env.local.example .gitignore
git commit -m "chore: add env template for Supabase"
```

### Task A3: Supabase server client

**Files:** `src/lib/supabase/server.ts`

- [ ] **Step 1: Write client**

```ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");

// Server-only client. Uses the secret key which bypasses RLS.
// NEVER import this from a Client Component or send to the browser.
export const supabaseServer = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase/server.ts
git commit -m "feat: add Supabase server client (secret key)"
```

### Task A4: Supabase public client

**Files:** `src/lib/supabase/public.ts`

- [ ] **Step 1: Write client**

```ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
if (!publishableKey) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");

// Public read client. Safe to use from both server and client components.
export const supabasePublic = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase/public.ts
git commit -m "feat: add Supabase public client (publishable key)"
```

### Task A5: DB types re-export

**Files:** `src/lib/db/types.ts`

- [ ] **Step 1: Read `_mock.ts` to confirm exported type names**

Run: `grep '^export type' src/app/admin/_mock.ts`
Note the exact type names exported.

- [ ] **Step 2: Re-export types**

Write `src/lib/db/types.ts`:

```ts
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
  DoublesMatch,
  TeamMatch,
  IndividualMatch,
  KnockoutMatch,
  TeamLineup,
  MatchStatus,
  KnockoutRound,
  StandingRow,
  GroupLeader,
  GroupTops,
  FeedItem,
} from "@/app/admin/_mock";
```

If any of the above type names do NOT exist in `_mock.ts` (per Step 1), remove them from the re-export list. Only re-export types that actually exist. Do not invent types.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors related to `src/lib/db/types.ts` or Supabase clients.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/types.ts
git commit -m "feat: re-export DB types as single source of truth"
```

---

### 🛑 CHECKPOINT A — User verification

**STOP. Report to user:**

> Checkpoint A done. Đã xong:
> - Cài `@supabase/supabase-js` + `tsx`
> - `.env.local.example` template
> - 2 Supabase clients (server + public)
> - `src/lib/db/types.ts` re-export types
> - `npx tsc --noEmit` pass
>
> **Việc user cần làm:**
> 1. Tạo Supabase project tại https://supabase.com (nếu chưa có)
> 2. Copy `.env.local.example` → `.env.local`, điền URL + 2 keys từ Dashboard → Settings → API
>
> Xong báo "ok" để tiếp tục Checkpoint B (schema).

**Do not proceed until user confirms `.env.local` is filled in with real values.**

---

## Checkpoint B — Schema & views

Create all tables + aggregate views in Supabase. Verify structure before seeding.

### Task B1: Migration 0001 — tables

**Files:** `supabase/migrations/0001_init_schema.sql`

- [ ] **Step 1: Write schema**

```sql
-- 0001_init_schema.sql — initial schema for PingPong304
-- Creates 10 tables: 5 for Doubles content, 5 for Teams content.

-- =============================
-- DOUBLES
-- =============================

create table if not exists doubles_players (
  id    text primary key,
  name  text not null,
  phone text,
  gender text check (gender in ('M','F')),
  club  text
);

create table if not exists doubles_pairs (
  id text primary key,
  p1 text references doubles_players(id) on delete restrict,
  p2 text references doubles_players(id) on delete restrict
);

create table if not exists doubles_groups (
  id   text primary key,
  name text not null,
  entries text[] not null default '{}'
);

create table if not exists doubles_matches (
  id       text primary key,
  group_id text references doubles_groups(id) on delete cascade,
  pair_a   text references doubles_pairs(id) on delete restrict,
  pair_b   text references doubles_pairs(id) on delete restrict,
  "table"  int,
  best_of  int not null check (best_of in (3,5)),
  sets     jsonb not null default '[]'::jsonb,
  status   text not null default 'scheduled' check (status in ('scheduled','done','forfeit')),
  winner   text,
  sets_a   int not null default 0,
  sets_b   int not null default 0
);

create table if not exists doubles_ko (
  id            text primary key,
  round         text not null check (round in ('qf','sf','f')),
  best_of       int not null,
  label_a       text,
  label_b       text,
  entry_a       text references doubles_pairs(id),
  entry_b       text references doubles_pairs(id),
  sets          jsonb not null default '[]'::jsonb,
  status        text not null default 'scheduled' check (status in ('scheduled','done','forfeit')),
  winner        text,
  sets_a        int not null default 0,
  sets_b        int not null default 0,
  next_match_id text references doubles_ko(id),
  next_slot     text check (next_slot in ('a','b'))
);

-- =============================
-- TEAMS
-- =============================

create table if not exists team_players (
  id    text primary key,
  name  text not null,
  phone text,
  gender text check (gender in ('M','F')),
  club  text
);

create table if not exists teams (
  id      text primary key,
  name    text not null,
  members text[] not null default '{}'
);

create table if not exists team_groups (
  id      text primary key,
  name    text not null,
  entries text[] not null default '{}'
);

create table if not exists team_matches (
  id         text primary key,
  group_id   text references team_groups(id) on delete cascade,
  team_a     text references teams(id) on delete restrict,
  team_b     text references teams(id) on delete restrict,
  "table"    int,
  status     text not null default 'scheduled' check (status in ('scheduled','done','forfeit')),
  score_a    int not null default 0,
  score_b    int not null default 0,
  winner     text,
  individual jsonb not null default '[]'::jsonb
);

create table if not exists team_ko (
  id            text primary key,
  round         text not null check (round in ('qf','sf','f')),
  label_a       text,
  label_b       text,
  entry_a       text references teams(id),
  entry_b       text references teams(id),
  status        text not null default 'scheduled' check (status in ('scheduled','done','forfeit')),
  score_a       int not null default 0,
  score_b       int not null default 0,
  winner        text,
  individual    jsonb not null default '[]'::jsonb,
  lineup        jsonb,
  next_match_id text references team_ko(id),
  next_slot     text check (next_slot in ('a','b'))
);

-- Indexes for common queries
create index if not exists idx_doubles_matches_group on doubles_matches(group_id);
create index if not exists idx_team_matches_group    on team_matches(group_id);
create index if not exists idx_doubles_groups_entries on doubles_groups using gin(entries);
create index if not exists idx_team_groups_entries    on team_groups using gin(entries);
create index if not exists idx_teams_members          on teams using gin(members);
```

- [ ] **Step 2: Apply**

In Supabase Dashboard → SQL Editor: paste the file contents → Run.

- [ ] **Step 3: Verify tables**

In SQL Editor:
```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```

Expected: 10 table rows — `doubles_groups, doubles_ko, doubles_matches, doubles_pairs, doubles_players, team_groups, team_ko, team_matches, team_players, teams`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init_schema.sql
git commit -m "feat(db): initial schema for doubles + teams"
```

### Task B2: Migration 0002 — standings views

**Files:** `supabase/migrations/0002_standings_views.sql`

- [ ] **Step 1: Write views**

```sql
-- 0002_standings_views.sql
-- Aggregate views for overall standings (pre-tiebreaker).
-- Tiebreaker (head-to-head, mini-league) is resolved in TypeScript layer.

create or replace view doubles_standings_raw as
select
  m.group_id,
  e.entry_id,
  count(*)                                                    as played,
  sum(case when m.winner = e.entry_id then 1 else 0 end)      as won,
  sum(case when m.winner is not null and m.winner <> e.entry_id
           then 1 else 0 end)                                 as lost,
  sum(case when e.entry_id = m.pair_a then m.sets_a else m.sets_b end) as sets_won,
  sum(case when e.entry_id = m.pair_a then m.sets_b else m.sets_a end) as sets_lost
from doubles_matches m
cross join lateral (values (m.pair_a), (m.pair_b)) as e(entry_id)
where m.status in ('done','forfeit')
group by m.group_id, e.entry_id;

create or replace view team_standings_raw as
select
  m.group_id,
  e.entry_id,
  count(*)                                                    as played,
  sum(case when m.winner = e.entry_id then 1 else 0 end)      as won,
  sum(case when m.winner is not null and m.winner <> e.entry_id
           then 1 else 0 end)                                 as lost,
  sum(case when e.entry_id = m.team_a then m.score_a else m.score_b end) as sub_won,
  sum(case when e.entry_id = m.team_a then m.score_b else m.score_a end) as sub_lost
from team_matches m
cross join lateral (values (m.team_a), (m.team_b)) as e(entry_id)
where m.status in ('done','forfeit')
group by m.group_id, e.entry_id;
```

- [ ] **Step 2: Apply in SQL Editor**

- [ ] **Step 3: Verify views run**

```sql
select * from doubles_standings_raw limit 1;
select * from team_standings_raw limit 1;
```

Expected: both run without error (0 rows OK — no data yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_standings_views.sql
git commit -m "feat(db): add standings aggregate views"
```

---

### 🛑 CHECKPOINT B — User verification

**STOP. Report to user:**

> Checkpoint B done. Đã tạo 10 bảng + 2 view trong Supabase.
>
> **Hãy verify giúp:**
> - Vào Supabase Dashboard → Table Editor, confirm thấy đủ 10 bảng
> - Click vài bảng, xem schema đúng không (cột, FK, check constraints)
>
> Xong báo "ok" để tiếp tục Checkpoint C (seed data).

**Do not proceed until user confirms.**

---

## Checkpoint C — Seed data

Generate + apply seed from `_mock.ts`. Verify data correctness.

### Task C1: Inspect `_mock.ts` exports

**Files:** read only — `src/app/admin/_mock.ts`

- [ ] **Step 1: Enumerate exports**

Run: `grep '^export' src/app/admin/_mock.ts`

Note exact names of exported consts (expected names based on spec: `MOCK_DOUBLES_PLAYERS`, `MOCK_PAIRS`, `MOCK_DOUBLES_GROUPS`, `MOCK_DOUBLES_MATCHES`, `MOCK_DOUBLES_KO`, `MOCK_TEAM_PLAYERS`, `MOCK_TEAMS`, `MOCK_TEAM_GROUPS`, `MOCK_TEAM_MATCHES`, `MOCK_TEAM_KO`). **Use the actual names found. Do not invent.**

- [ ] **Step 2: Check `groups.entries` shape**

Read `MOCK_DOUBLES_GROUPS` and `MOCK_TEAM_GROUPS` definitions in `_mock.ts`. Determine:
- Does `entries` contain **pair/team IDs** (like `"p01"`, `"t1"`), or **labels** (like `"Minh Quân – Tân Sinh"`, `"Team X"`)?

**Decision (per user): seed must store IDs, not labels.** If the mock entries are labels, the seed generator in Task C2 must convert label → id.

- [ ] **Step 3: Check `team_matches.individual` and `teams.members` shape**

Confirm `teams.members` is array of player IDs (expected from `_mock.ts` types). Confirm `team_matches.individual` is an array of `IndividualMatch` objects.

Note down findings as a short comment block; use them when writing the generator.

### Task C2: Seed generator script

**Files:** `scripts/generate-seed.ts`

- [ ] **Step 1: Write generator**

```ts
// scripts/generate-seed.ts
// Run: npx tsx scripts/generate-seed.ts
// Output: supabase/seed.sql (idempotent INSERT ... ON CONFLICT DO NOTHING)

import { writeFileSync } from "node:fs";
import {
  MOCK_DOUBLES_PLAYERS,
  MOCK_PAIRS,
  MOCK_DOUBLES_GROUPS,
  MOCK_DOUBLES_MATCHES,
  MOCK_DOUBLES_KO,
  MOCK_TEAM_PLAYERS,
  MOCK_TEAMS,
  MOCK_TEAM_GROUPS,
  MOCK_TEAM_MATCHES,
  MOCK_TEAM_KO,
} from "../src/app/admin/_mock";

// ---------- SQL literal helpers ----------
const q = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    return `array[${v.map((x) => q(String(x))).join(",")}]::text[]`;
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

const insert = (
  table: string,
  cols: string[],
  rows: Record<string, unknown>[],
): string => {
  if (rows.length === 0) return `-- (no rows for ${table})\n\n`;
  const colList = cols.map((c) => (c === "table" ? `"table"` : c)).join(", ");
  const values = rows
    .map((r) => `(${cols.map((c) => q(r[c])).join(", ")})`)
    .join(",\n  ");
  return `insert into ${table} (${colList}) values\n  ${values}\non conflict (id) do nothing;\n\n`;
};

// ---------- Label→ID resolver for doubles groups.entries ----------
// Per spec decision: entries must store pair IDs, not labels.
// If mock stores labels, build a labelPair → pairId map.
const pairLabelOf = (p: { p1: string; p2: string }) => `${p.p1} – ${p.p2}`;
const pairIdByLabel = new Map(MOCK_PAIRS.map((p) => [pairLabelOf(p), p.id]));

const resolveEntryToPairId = (entry: string): string => {
  // Accept either id or label; prefer id if already exists.
  if (MOCK_PAIRS.some((p) => p.id === entry)) return entry;
  const id = pairIdByLabel.get(entry);
  if (!id) throw new Error(`Cannot resolve doubles group entry "${entry}" to pair id`);
  return id;
};

// ---------- Label→ID resolver for team groups.entries ----------
const teamIdByName = new Map(MOCK_TEAMS.map((t) => [t.name, t.id]));
const resolveEntryToTeamId = (entry: string): string => {
  if (MOCK_TEAMS.some((t) => t.id === entry)) return entry;
  const id = teamIdByName.get(entry);
  if (!id) throw new Error(`Cannot resolve team group entry "${entry}" to team id`);
  return id;
};

// ---------- Match cache computer ----------
function computeMatchCache(
  sideA: string | null,
  sideB: string | null,
  bestOf: number,
  sets: { a: number; b: number }[] | undefined,
  status: string,
): { winner: string | null; sets_a: number; sets_b: number } {
  if (status === "scheduled" || !sideA || !sideB) {
    return { winner: null, sets_a: 0, sets_b: 0 };
  }
  if (status === "forfeit") {
    const need = bestOf === 5 ? 3 : 2;
    return { winner: sideA, sets_a: need, sets_b: 0 };
  }
  let a = 0, b = 0;
  for (const s of sets ?? []) {
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return {
    winner: a > b ? sideA : b > a ? sideB : null,
    sets_a: a,
    sets_b: b,
  };
}

// ---------- Build SQL ----------
let sql = "-- Generated by scripts/generate-seed.ts — do not edit by hand.\n\n";

sql += insert(
  "doubles_players",
  ["id", "name", "phone", "gender", "club"],
  MOCK_DOUBLES_PLAYERS.map((p) => ({ ...p })),
);

sql += insert(
  "doubles_pairs",
  ["id", "p1", "p2"],
  MOCK_PAIRS.map((p) => ({ ...p })),
);

sql += insert(
  "doubles_groups",
  ["id", "name", "entries"],
  MOCK_DOUBLES_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    entries: g.entries.map(resolveEntryToPairId), // ← labels → pair IDs
  })),
);

sql += insert(
  "doubles_matches",
  ["id", "group_id", "pair_a", "pair_b", "table", "best_of", "sets", "status", "winner", "sets_a", "sets_b"],
  MOCK_DOUBLES_MATCHES.map((m) => {
    const cache = computeMatchCache(m.pairA, m.pairB, m.bestOf, m.sets, m.status);
    return {
      id: m.id,
      group_id: m.groupId,
      pair_a: m.pairA,
      pair_b: m.pairB,
      table: m.table ?? null,
      best_of: m.bestOf,
      sets: m.sets ?? [],
      status: m.status,
      winner: cache.winner,
      sets_a: cache.sets_a,
      sets_b: cache.sets_b,
    };
  }),
);

sql += insert(
  "doubles_ko",
  ["id", "round", "best_of", "label_a", "label_b", "entry_a", "entry_b", "sets", "status", "winner", "sets_a", "sets_b", "next_match_id", "next_slot"],
  MOCK_DOUBLES_KO.map((k) => {
    const entryA = k.entryA ?? null;
    const entryB = k.entryB ?? null;
    const cache = computeMatchCache(entryA, entryB, k.bestOf, k.sets, k.status);
    const anyK = k as unknown as { nextMatchId?: string; nextSlot?: string };
    return {
      id: k.id,
      round: k.round,
      best_of: k.bestOf,
      label_a: k.labelA ?? null,
      label_b: k.labelB ?? null,
      entry_a: entryA,
      entry_b: entryB,
      sets: k.sets ?? [],
      status: k.status,
      winner: cache.winner,
      sets_a: cache.sets_a,
      sets_b: cache.sets_b,
      next_match_id: anyK.nextMatchId ?? null,
      next_slot: anyK.nextSlot ?? null,
    };
  }),
);

sql += insert(
  "team_players",
  ["id", "name", "phone", "gender", "club"],
  MOCK_TEAM_PLAYERS.map((p) => ({ ...p })),
);

sql += insert(
  "teams",
  ["id", "name", "members"],
  MOCK_TEAMS.map((t) => ({ id: t.id, name: t.name, members: t.members })),
);

sql += insert(
  "team_groups",
  ["id", "name", "entries"],
  MOCK_TEAM_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    entries: g.entries.map(resolveEntryToTeamId),
  })),
);

sql += insert(
  "team_matches",
  ["id", "group_id", "team_a", "team_b", "table", "status", "score_a", "score_b", "winner", "individual"],
  MOCK_TEAM_MATCHES.map((m) => ({
    id: m.id,
    group_id: m.groupId,
    team_a: m.teamA,
    team_b: m.teamB,
    table: m.table ?? null,
    status: m.status,
    score_a: m.scoreA,
    score_b: m.scoreB,
    winner:
      m.status === "scheduled"
        ? null
        : m.scoreA > m.scoreB
          ? m.teamA
          : m.scoreB > m.scoreA
            ? m.teamB
            : null,
    individual: m.individual ?? [],
  })),
);

sql += insert(
  "team_ko",
  ["id", "round", "label_a", "label_b", "entry_a", "entry_b", "status", "score_a", "score_b", "winner", "individual", "lineup", "next_match_id", "next_slot"],
  MOCK_TEAM_KO.map((k) => {
    const anyK = k as unknown as {
      scoreA?: number;
      scoreB?: number;
      individual?: unknown[];
      lineup?: unknown;
      nextMatchId?: string;
      nextSlot?: string;
    };
    const scoreA = anyK.scoreA ?? 0;
    const scoreB = anyK.scoreB ?? 0;
    return {
      id: k.id,
      round: k.round,
      label_a: k.labelA ?? null,
      label_b: k.labelB ?? null,
      entry_a: k.entryA ?? null,
      entry_b: k.entryB ?? null,
      status: k.status,
      score_a: scoreA,
      score_b: scoreB,
      winner:
        k.status === "scheduled" || !k.entryA || !k.entryB
          ? null
          : scoreA > scoreB
            ? k.entryA
            : scoreB > scoreA
              ? k.entryB
              : null,
      individual: anyK.individual ?? [],
      lineup: anyK.lineup ?? null,
      next_match_id: anyK.nextMatchId ?? null,
      next_slot: anyK.nextSlot ?? null,
    };
  }),
);

writeFileSync("supabase/seed.sql", sql);
console.log(`Wrote supabase/seed.sql (${sql.length} bytes)`);
```

**If the actual `_mock.ts` uses different field names (e.g. `pair_a` instead of `pairA`, `team_a` instead of `teamA`), adjust the generator accordingly. Cross-check with Task C1 findings. Do not invent fields.**

- [ ] **Step 2: Run generator**

Run: `mkdir -p supabase && npx tsx scripts/generate-seed.ts`
Expected: prints `Wrote supabase/seed.sql (N bytes)`. No thrown errors.

If `resolveEntryToPairId` or `resolveEntryToTeamId` throws "Cannot resolve...", inspect the unresolved entry in `_mock.ts` and fix the resolver (adjust label format or mapping).

- [ ] **Step 3: Inspect output**

Read first ~50 lines of `supabase/seed.sql`. Verify:
- Starts with `-- Generated by scripts/generate-seed.ts`
- Has `insert into doubles_players (...) values` block
- Entries in `doubles_groups` look like `array['p01','p04',...]::text[]` (IDs, NOT labels)

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-seed.ts supabase/seed.sql
git commit -m "feat(db): seed generator and initial seed from mock"
```

### Task C3: Apply seed

**Files:** none (operational)

- [ ] **Step 1: Apply seed**

In Supabase Dashboard → SQL Editor: open the file `supabase/seed.sql`, copy all, paste into editor → Run.

Expected: "Success. No rows returned." or similar. No errors.

- [ ] **Step 2: Verify row counts**

In SQL Editor:
```sql
select 'doubles_players' t, count(*) from doubles_players
union all select 'doubles_pairs',   count(*) from doubles_pairs
union all select 'doubles_groups',  count(*) from doubles_groups
union all select 'doubles_matches', count(*) from doubles_matches
union all select 'doubles_ko',      count(*) from doubles_ko
union all select 'team_players',    count(*) from team_players
union all select 'teams',           count(*) from teams
union all select 'team_groups',     count(*) from team_groups
union all select 'team_matches',    count(*) from team_matches
union all select 'team_ko',         count(*) from team_ko;
```

Expected (per mock): each count > 0. Per spec notes: `doubles_pairs` = 18, `doubles_groups` = 4, `doubles_players` = 36, `teams` = 8, `team_groups` = 2.

- [ ] **Step 3: Spot-check entries are IDs**

```sql
select id, name, entries from doubles_groups;
```

Expected: `entries` is array of strings like `{p01,p04,p12,p13}` (pair IDs), NOT labels like `{"Minh Quân – Tân Sinh",...}`.

- [ ] **Step 4: Spot-check standings view**

```sql
select * from doubles_standings_raw where group_id = 'gA' order by won desc;
```

Expected: 1 row per pair in group A that has played ≥ 1 done/forfeit match; columns populated.

### Task C4: Smoke test — server client reads real data

**Files:** `scripts/smoke-test.ts` (temporary)

- [ ] **Step 1: Write smoke test**

```ts
// scripts/smoke-test.ts — temporary, deleted after verification
import { supabaseServer } from "../src/lib/supabase/server";

async function main() {
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .select("id, p1, p2")
    .limit(3);
  if (error) { console.error("ERROR:", error); process.exit(1); }
  console.log("OK — sample pairs:", data);
}
main();
```

- [ ] **Step 2: Run**

Run: `npx tsx --env-file=.env.local scripts/smoke-test.ts`
Expected: `OK — sample pairs: [ { id: 'p01', p1: 'd01', p2: 'd02' }, ... ]` (3 rows, exit 0).

- [ ] **Step 3: Clean up**

Run: `rm scripts/smoke-test.ts`

### Task C5: Update README

**Files:** `README.md`

- [ ] **Step 1: Read existing README**

- [ ] **Step 2: Append setup section**

Add at end:

```markdown
## Supabase setup

1. Create a Supabase project at https://supabase.com.
2. Copy `.env.local.example` → `.env.local` and fill in values from Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
3. Apply migrations (Supabase Dashboard SQL Editor, in order):
   - `supabase/migrations/0001_init_schema.sql`
   - `supabase/migrations/0002_standings_views.sql`
4. Regenerate seed from mock (optional, already committed): `npx tsx scripts/generate-seed.ts`
5. Apply seed: paste `supabase/seed.sql` into SQL Editor and run.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Supabase setup instructions"
```

---

### 🛑 CHECKPOINT C — User verification

**STOP. Report to user:**

> Checkpoint C done — Phase 0 + 1 complete.
>
> **Đã xong:**
> - Seed script generated `supabase/seed.sql` from `_mock.ts`
> - Seed applied vào Supabase
> - Row counts khớp mock (18 pairs, 4 groups, 36 players, 8 teams, 2 team groups, ...)
> - `doubles_groups.entries` chứa pair IDs (không phải labels)
> - Smoke test đọc được data qua `supabaseServer` client
> - README updated với hướng dẫn setup
>
> **Hãy verify giúp:**
> - Vào Supabase Studio → mở bảng `doubles_pairs`, `doubles_groups` — xem data đúng không
> - Mở `doubles_matches` — xem các trận đã seed với `sets_a/sets_b/winner` đúng
>
> Báo "ok" nếu verify xong. Phase 2 (Players API + UI) sẽ có plan riêng.

**End of Phase 0 + 1.**

---

## Done criteria

- [ ] `@supabase/supabase-js` + `tsx` installed
- [ ] `.env.local.example` committed, `.env.local` created locally with real values
- [ ] 2 Supabase clients + `db/types.ts` exist and typecheck
- [ ] 10 tables + 2 views created in Supabase project
- [ ] `supabase/seed.sql` generated (with pair/team IDs in entries) and applied
- [ ] Row counts match `_mock.ts` arrays
- [ ] Smoke test returned real rows
- [ ] README has setup instructions
- [ ] User approved at all 3 checkpoints

**Next:** Phase 2 plan (Players API + admin UI swap). Written separately when this phase is merged.
