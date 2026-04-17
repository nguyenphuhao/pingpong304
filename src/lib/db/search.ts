import { supabaseServer } from "@/lib/supabase/server";

type PlayerResult = {
  id: string;
  name: string;
  phone: string;
  gender: string;
  club: string;
  kind: "doubles" | "teams";
};

export async function searchPlayers(query: string): Promise<PlayerResult[]> {
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q}%`;

  const [doublesResp, teamsResp] = await Promise.all([
    supabaseServer
      .from("doubles_players")
      .select("id, name, phone, gender, club")
      .ilike("name", pattern),
    supabaseServer
      .from("team_players")
      .select("id, name, phone, gender, club")
      .ilike("name", pattern),
  ]);

  if (doublesResp.error) throw new Error(doublesResp.error.message);
  if (teamsResp.error) throw new Error(teamsResp.error.message);

  type Row = { id: string; name: string; phone: string; gender: string; club: string };
  const doubles = ((doublesResp.data ?? []) as Row[]).map((p) => ({ ...p, kind: "doubles" as const }));
  const teams = ((teamsResp.data ?? []) as Row[]).map((p) => ({ ...p, kind: "teams" as const }));
  return [...doubles, ...teams];
}
