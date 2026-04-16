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
