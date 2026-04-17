-- 0003_seed_matches.sql — initial round-robin seed for group-stage matches.
-- Idempotent: only inserts if matches table is empty for the group.
-- Tái tạo logic của reorderRoundRobin() trong _mock.ts (greedy avoid back-to-back)
-- bằng PL/pgSQL function. Insert theo i<j order — không reorder back-to-back ở SQL.
-- Admin có thể PATCH `table` field nếu cần thứ tự cụ thể.

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
