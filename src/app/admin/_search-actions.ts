"use server";

import { requireAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { MatchIndexItem } from "./_search-filter";

type DoublesRow = {
  id: string;
  group_id: string;
  status: MatchIndexItem["status"];
  pair_a: string;
  pair_b: string;
};

type TeamsRow = {
  id: string;
  group_id: string;
  status: MatchIndexItem["status"];
  team_a: string;
  team_b: string;
};

type GroupRow = { id: string; name: string };

async function fetchDoublesIndex(): Promise<MatchIndexItem[]> {
  const [matchesResp, groupsResp, pairsResp] = await Promise.all([
    supabaseServer
      .from("doubles_matches")
      .select("id, group_id, status, pair_a, pair_b")
      .order("id"),
    supabaseServer.from("doubles_groups").select("id, name"),
    supabaseServer
      .from("doubles_pairs")
      .select("id, p1:doubles_players!p1(id,name), p2:doubles_players!p2(id,name)"),
  ]);
  if (matchesResp.error) throw new Error(matchesResp.error.message);
  if (groupsResp.error) throw new Error(groupsResp.error.message);
  if (pairsResp.error) throw new Error(pairsResp.error.message);

  const groupName = new Map(
    ((groupsResp.data ?? []) as GroupRow[]).map((g) => [g.id, g.name]),
  );
  const pairLabel = new Map(
    (
      (pairsResp.data ?? []) as unknown as Array<{
        id: string;
        p1: { name: string };
        p2: { name: string };
      }>
    ).map((p) => [p.id, `${p.p1.name} – ${p.p2.name}`]),
  );

  return ((matchesResp.data ?? []) as DoublesRow[]).map((r) => ({
    id: r.id,
    kind: "doubles",
    groupId: r.group_id,
    groupName: groupName.get(r.group_id) ?? "?",
    sideA: pairLabel.get(r.pair_a) ?? "?",
    sideB: pairLabel.get(r.pair_b) ?? "?",
    status: r.status,
  }));
}

async function fetchTeamsIndex(): Promise<MatchIndexItem[]> {
  const [matchesResp, groupsResp, teamsResp] = await Promise.all([
    supabaseServer
      .from("team_matches")
      .select("id, group_id, status, team_a, team_b")
      .order("id"),
    supabaseServer.from("team_groups").select("id, name"),
    supabaseServer.from("teams").select("id, name"),
  ]);
  if (matchesResp.error) throw new Error(matchesResp.error.message);
  if (groupsResp.error) throw new Error(groupsResp.error.message);
  if (teamsResp.error) throw new Error(teamsResp.error.message);

  const groupName = new Map(
    ((groupsResp.data ?? []) as GroupRow[]).map((g) => [g.id, g.name]),
  );
  const teamName = new Map(
    ((teamsResp.data ?? []) as Array<{ id: string; name: string }>).map((t) => [
      t.id,
      t.name,
    ]),
  );

  return ((matchesResp.data ?? []) as TeamsRow[]).map((r) => ({
    id: r.id,
    kind: "teams",
    groupId: r.group_id,
    groupName: groupName.get(r.group_id) ?? "?",
    sideA: teamName.get(r.team_a) ?? "?",
    sideB: teamName.get(r.team_b) ?? "?",
    status: r.status,
  }));
}

export async function fetchMatchIndexForKind(
  kind: "doubles" | "teams",
): Promise<MatchIndexItem[]> {
  await requireAdmin();
  return kind === "doubles" ? fetchDoublesIndex() : fetchTeamsIndex();
}
