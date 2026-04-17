import { supabaseServer } from "@/lib/supabase/server";
import type {
  DoublesKoResolved,
  TeamKoResolved,
} from "@/lib/schemas/knockout";
import type {
  SetScore,
  Status,
  BestOf,
  SubMatchResolved,
} from "@/lib/schemas/match";

// ── Row types ──

type DoublesKoRow = {
  id: string;
  round: "qf" | "sf" | "f";
  best_of: BestOf;
  label_a: string | null;
  label_b: string | null;
  entry_a: string | null;
  entry_b: string | null;
  sets: SetScore[];
  status: Status;
  winner: string | null;
  sets_a: number;
  sets_b: number;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

type TeamKoRow = {
  id: string;
  round: "qf" | "sf" | "f";
  label_a: string | null;
  label_b: string | null;
  entry_a: string | null;
  entry_b: string | null;
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
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

// ── Selects ──

const DOUBLES_KO_SELECT =
  "id, round, best_of, label_a, label_b, entry_a, entry_b, sets, status, winner, sets_a, sets_b, next_match_id, next_slot";

const TEAM_KO_SELECT =
  "id, round, label_a, label_b, entry_a, entry_b, status, score_a, score_b, winner, individual, next_match_id, next_slot";

// ── Label maps ──

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

// ── Resolve ──

function resolveDoublesKo(
  row: DoublesKoRow,
  pairMap: Map<string, string>,
): DoublesKoResolved {
  const labelOf = (id: string) => pairMap.get(id) ?? "?";
  return {
    id: row.id,
    round: row.round,
    bestOf: row.best_of,
    table: null,
    labelA: row.label_a ?? "",
    labelB: row.label_b ?? "",
    entryA: row.entry_a ? { id: row.entry_a, label: labelOf(row.entry_a) } : null,
    entryB: row.entry_b ? { id: row.entry_b, label: labelOf(row.entry_b) } : null,
    sets: row.sets ?? [],
    setsA: row.sets_a,
    setsB: row.sets_b,
    status: row.status,
    winner: row.winner ? { id: row.winner, label: labelOf(row.winner) } : null,
    nextMatchId: row.next_match_id,
    nextSlot: row.next_slot,
  };
}

function resolveTeamKo(
  row: TeamKoRow,
  teamMap: Map<string, string>,
  playerMap: Map<string, string>,
): TeamKoResolved {
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
    round: row.round,
    labelA: row.label_a ?? "",
    labelB: row.label_b ?? "",
    entryA: row.entry_a ? { id: row.entry_a, name: teamLabelOf(row.entry_a) } : null,
    entryB: row.entry_b ? { id: row.entry_b, name: teamLabelOf(row.entry_b) } : null,
    scoreA: row.score_a,
    scoreB: row.score_b,
    status: row.status,
    winner: row.winner ? { id: row.winner, name: teamLabelOf(row.winner) } : null,
    individual,
    nextMatchId: row.next_match_id,
    nextSlot: row.next_slot,
  };
}

// ── Fetch functions ──

export async function fetchDoublesKo(): Promise<DoublesKoResolved[]> {
  const { data, error } = await supabaseServer
    .from("doubles_ko")
    .select(DOUBLES_KO_SELECT)
    .order("id");
  if (error) throw new Error(error.message);
  const pairMap = await buildPairLabelMap();
  return ((data ?? []) as DoublesKoRow[]).map((r) => resolveDoublesKo(r, pairMap));
}

export async function fetchDoublesKoById(id: string): Promise<DoublesKoResolved | null> {
  const chain = supabaseServer
    .from("doubles_ko")
    .select(DOUBLES_KO_SELECT)
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: DoublesKoRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const pairMap = await buildPairLabelMap();
  return resolveDoublesKo(data, pairMap);
}

export async function fetchTeamKo(): Promise<TeamKoResolved[]> {
  const { data, error } = await supabaseServer
    .from("team_ko")
    .select(TEAM_KO_SELECT)
    .order("id");
  if (error) throw new Error(error.message);
  const [teamMap, playerMap] = await Promise.all([
    buildTeamNameMap(),
    buildTeamPlayerNameMap(),
  ]);
  return ((data ?? []) as TeamKoRow[]).map((r) => resolveTeamKo(r, teamMap, playerMap));
}

export async function fetchTeamKoById(id: string): Promise<TeamKoResolved | null> {
  const chain = supabaseServer
    .from("team_ko")
    .select(TEAM_KO_SELECT)
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: TeamKoRow | null;
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
  return resolveTeamKo(data, teamMap, playerMap);
}
