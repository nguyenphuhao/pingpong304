-- 0004_add_live_status.sql — add 'live' to match status check constraints.
-- Applies to all 4 match tables: doubles_matches, team_matches, doubles_ko, team_ko.
-- Idempotent: DROP IF EXISTS + ADD CONSTRAINT.

alter table doubles_matches drop constraint if exists doubles_matches_status_check;
alter table doubles_matches
  add constraint doubles_matches_status_check
  check (status in ('scheduled','done','forfeit','live'));

alter table team_matches drop constraint if exists team_matches_status_check;
alter table team_matches
  add constraint team_matches_status_check
  check (status in ('scheduled','done','forfeit','live'));

alter table doubles_ko drop constraint if exists doubles_ko_status_check;
alter table doubles_ko
  add constraint doubles_ko_status_check
  check (status in ('scheduled','done','forfeit','live'));

alter table team_ko drop constraint if exists team_ko_status_check;
alter table team_ko
  add constraint team_ko_status_check
  check (status in ('scheduled','done','forfeit','live'));
