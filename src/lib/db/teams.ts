import { supabaseServer } from "@/lib/supabase/server";
import type { TeamWithNames } from "@/lib/schemas/team";

async function playerMap(): Promise<Map<string, string>> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name");
  if (error) throw new Error((error as { message: string }).message);
  return new Map(((data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
}

function resolveMembers(ids: string[], map: Map<string, string>) {
  return ids.map((id) => ({ id, name: map.get(id) ?? "?" }));
}

export async function fetchTeams(): Promise<TeamWithNames[]> {
  const { data: teams, error } = await supabaseServer
    .from("teams")
    .select("id, name, members")
    .order("id");
  if (error) throw new Error((error as { message: string }).message);
  const map = await playerMap();
  return ((teams ?? []) as { id: string; name: string; members: string[] }[]).map(
    (t) => ({
      id: t.id,
      name: t.name,
      members: resolveMembers(t.members, map),
    }),
  );
}

export async function fetchTeamById(id: string): Promise<TeamWithNames | null> {
  const chain = supabaseServer.from("teams").select("id, name, members").eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: { id: string; name: string; members: string[] } | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (!data) return null;
  const map = await playerMap();
  return { id: data.id, name: data.name, members: resolveMembers(data.members, map) };
}
