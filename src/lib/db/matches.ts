import { supabaseServer } from "@/lib/supabase/server";
import type {
  MatchResolved,
  TeamMatchResolved,
  SubMatchResolved,
  SetScore,
  Status,
  BestOf,
} from "@/lib/schemas/match";

type DoublesMatchRow = {
  id: string;
  group_id: string;
  pair_a: string;
  pair_b: string;
  table: number | null;
  best_of: BestOf;
  sets: SetScore[];
  status: Status;
  winner: string | null;
  sets_a: number;
  sets_b: number;
};

type TeamMatchRow = {
  id: string;
  group_id: string;
  team_a: string;
  team_b: string;
  table: number | null;
  status: Status;
  score_a: number;
  score_b: number;
  winner: string | null;
  individual: Array<{
    id: string;
    label: string;
    kind: "singles" | "doubles";
    playersA: string[];
    playersB: string[];
    bestOf: BestOf;
    sets: SetScore[];
  }>;
};

const DOUBLES_SELECT =
  "id, group_id, pair_a, pair_b, table, best_of, sets, status, winner, sets_a, sets_b";
const TEAMS_SELECT =
  "id, group_id, team_a, team_b, table, status, score_a, score_b, winner, individual";

async function buildPairLabelMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .select("id, p1:doubles_players!p1(id,name), p2:doubles_players!p2(id,name)");
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown) as Array<{
    id: string;
    p1: { id: string; name: string };
    p2: { id: string; name: string };
  }>;
  return new Map(rows.map((r) => [r.id, `${r.p1.name} – ${r.p2.name}`]));
}

function resolveDoublesMatch(
  row: DoublesMatchRow,
  pairMap: Map<string, string>,
): MatchResolved {
  const labelOf = (id: string) => pairMap.get(id) ?? "?";
  return {
    id: row.id,
    groupId: row.group_id,
    pairA: { id: row.pair_a, label: labelOf(row.pair_a) },
    pairB: { id: row.pair_b, label: labelOf(row.pair_b) },
    table: row.table,
    bestOf: row.best_of,
    sets: row.sets ?? [],
    setsA: row.sets_a,
    setsB: row.sets_b,
    status: row.status,
    winner: row.winner ? { id: row.winner, label: labelOf(row.winner) } : null,
  };
}

export async function fetchDoublesMatchesByGroup(
  groupId: string,
): Promise<MatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select(DOUBLES_SELECT)
    .eq("group_id", groupId)
    .order("id");
  if (error) throw new Error(error.message);
  const pairMap = await buildPairLabelMap();
  return ((data ?? []) as DoublesMatchRow[]).map((r) =>
    resolveDoublesMatch(r, pairMap),
  );
}

export async function fetchDoublesMatchById(
  id: string,
): Promise<MatchResolved | null> {
  const chain = supabaseServer
    .from("doubles_matches")
    .select(DOUBLES_SELECT)
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: DoublesMatchRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const pairMap = await buildPairLabelMap();
  return resolveDoublesMatch(data, pairMap);
}

async function buildTeamNameMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("teams")
    .select("id, name");
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]),
  );
}

async function buildTeamPlayerNameMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name");
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]),
  );
}

function resolveTeamMatch(
  row: TeamMatchRow,
  teamMap: Map<string, string>,
  playerMap: Map<string, string>,
): TeamMatchResolved {
  const teamLabelOf = (id: string) => teamMap.get(id) ?? "?";
  const playerLabelOf = (id: string) => playerMap.get(id) ?? "?";
  const individual: SubMatchResolved[] = (row.individual ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    playersA: (s.playersA ?? []).map((id) => ({ id, name: playerLabelOf(id) })),
    playersB: (s.playersB ?? []).map((id) => ({ id, name: playerLabelOf(id) })),
    bestOf: s.bestOf,
    sets: s.sets ?? [],
  }));
  return {
    id: row.id,
    groupId: row.group_id,
    teamA: { id: row.team_a, name: teamLabelOf(row.team_a) },
    teamB: { id: row.team_b, name: teamLabelOf(row.team_b) },
    table: row.table,
    scoreA: row.score_a,
    scoreB: row.score_b,
    status: row.status,
    winner: row.winner
      ? { id: row.winner, name: teamLabelOf(row.winner) }
      : null,
    individual,
  };
}

export async function fetchTeamMatchesByGroup(
  groupId: string,
): Promise<TeamMatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select(TEAMS_SELECT)
    .eq("group_id", groupId)
    .order("id");
  if (error) throw new Error(error.message);
  const [teamMap, playerMap] = await Promise.all([
    buildTeamNameMap(),
    buildTeamPlayerNameMap(),
  ]);
  return ((data ?? []) as TeamMatchRow[]).map((r) =>
    resolveTeamMatch(r, teamMap, playerMap),
  );
}

export async function fetchTeamMatchById(
  id: string,
): Promise<TeamMatchResolved | null> {
  const chain = supabaseServer
    .from("team_matches")
    .select(TEAMS_SELECT)
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: TeamMatchRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [teamMap, playerMap] = await Promise.all([
    buildTeamNameMap(),
    buildTeamPlayerNameMap(),
  ]);
  return resolveTeamMatch(data, teamMap, playerMap);
}

// ── Live matches ──

export async function fetchLiveDoubles(): Promise<MatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select(DOUBLES_SELECT)
    .eq("status", "live")
    .order("id");
  if (error) throw new Error(error.message);
  const pairMap = await buildPairLabelMap();
  return ((data ?? []) as DoublesMatchRow[]).map((r) =>
    resolveDoublesMatch(r, pairMap),
  );
}

export async function fetchLiveTeams(): Promise<TeamMatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select(TEAMS_SELECT)
    .eq("status", "live")
    .order("id");
  if (error) throw new Error(error.message);
  const [teamMap, playerMap] = await Promise.all([
    buildTeamNameMap(),
    buildTeamPlayerNameMap(),
  ]);
  return ((data ?? []) as TeamMatchRow[]).map((r) =>
    resolveTeamMatch(r, teamMap, playerMap),
  );
}

// ── Recent results ──

export async function fetchRecentDoubles(
  limit: number,
): Promise<MatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select(DOUBLES_SELECT)
    .in("status", ["done", "forfeit"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const pairMap = await buildPairLabelMap();
  return ((data ?? []) as DoublesMatchRow[]).map((r) =>
    resolveDoublesMatch(r, pairMap),
  );
}

export async function fetchRecentTeams(
  limit: number,
): Promise<TeamMatchResolved[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select(TEAMS_SELECT)
    .in("status", ["done", "forfeit"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const [teamMap, playerMap] = await Promise.all([
    buildTeamNameMap(),
    buildTeamPlayerNameMap(),
  ]);
  return ((data ?? []) as TeamMatchRow[]).map((r) =>
    resolveTeamMatch(r, teamMap, playerMap),
  );
}

// ── All matches by group (for schedule lists) ──

export async function fetchAllDoublesMatchesByGroup(
  groupIds: string[],
): Promise<Map<string, MatchResolved[]>> {
  const results = await Promise.all(
    groupIds.map(async (gid) => {
      const matches = await fetchDoublesMatchesByGroup(gid);
      return [gid, matches] as const;
    }),
  );
  return new Map(results);
}

export async function fetchAllTeamMatchesByGroup(
  groupIds: string[],
): Promise<Map<string, TeamMatchResolved[]>> {
  const results = await Promise.all(
    groupIds.map(async (gid) => {
      const matches = await fetchTeamMatchesByGroup(gid);
      return [gid, matches] as const;
    }),
  );
  return new Map(results);
}
