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
