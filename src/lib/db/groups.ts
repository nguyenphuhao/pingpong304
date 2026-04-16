import { supabaseServer } from "@/lib/supabase/server";
import { fetchPairs } from "./pairs";
import { fetchTeams } from "./teams";
import type { GroupResolved } from "@/lib/schemas/group";

type GroupRow = { id: string; name: string; entries: string[] };

function buildPairLabelMap(
  pairs: Awaited<ReturnType<typeof fetchPairs>>,
): Map<string, string> {
  return new Map(
    pairs.map((p) => [p.id, `${p.p1.name} – ${p.p2.name}`]),
  );
}

function resolveDoublesEntries(
  entries: string[],
  map: Map<string, string>,
): GroupResolved["entries"] {
  return entries.map((id) => ({ id, label: map.get(id) ?? "?" }));
}

export async function fetchDoublesGroups(): Promise<GroupResolved[]> {
  const [groupsResp, pairs] = await Promise.all([
    supabaseServer
      .from("doubles_groups")
      .select("id, name, entries")
      .order("id"),
    fetchPairs(),
  ]);
  if (groupsResp.error) throw new Error(groupsResp.error.message);
  const map = buildPairLabelMap(pairs);
  return ((groupsResp.data ?? []) as GroupRow[]).map((g) => ({
    id: g.id,
    name: g.name,
    entries: resolveDoublesEntries(g.entries, map),
  }));
}

export async function fetchDoublesGroupById(
  id: string,
): Promise<GroupResolved | null> {
  const chain = supabaseServer
    .from("doubles_groups")
    .select("id, name, entries")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: GroupRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const pairs = await fetchPairs();
  const map = buildPairLabelMap(pairs);
  return {
    id: data.id,
    name: data.name,
    entries: resolveDoublesEntries(data.entries, map),
  };
}

function buildTeamLabelMap(
  teams: Awaited<ReturnType<typeof fetchTeams>>,
): Map<string, string> {
  return new Map(teams.map((t) => [t.id, t.name]));
}

function resolveTeamEntries(
  entries: string[],
  map: Map<string, string>,
): GroupResolved["entries"] {
  return entries.map((id) => ({ id, label: map.get(id) ?? "?" }));
}

export async function fetchTeamGroups(): Promise<GroupResolved[]> {
  const [groupsResp, teams] = await Promise.all([
    supabaseServer
      .from("team_groups")
      .select("id, name, entries")
      .order("id"),
    fetchTeams(),
  ]);
  if (groupsResp.error) throw new Error(groupsResp.error.message);
  const map = buildTeamLabelMap(teams);
  return ((groupsResp.data ?? []) as GroupRow[]).map((g) => ({
    id: g.id,
    name: g.name,
    entries: resolveTeamEntries(g.entries, map),
  }));
}

export async function fetchTeamGroupById(
  id: string,
): Promise<GroupResolved | null> {
  const chain = supabaseServer
    .from("team_groups")
    .select("id, name, entries")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: GroupRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const teams = await fetchTeams();
  const map = buildTeamLabelMap(teams);
  return {
    id: data.id,
    name: data.name,
    entries: resolveTeamEntries(data.entries, map),
  };
}
