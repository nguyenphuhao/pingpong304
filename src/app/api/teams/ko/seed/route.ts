import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchTeamGroups } from "@/lib/db/groups";
import { fetchTeamMatchesByGroup } from "@/lib/db/matches";
import { computeTeamStandings } from "@/lib/standings/compute";
import { buildTeamBracket, type SeedEntry } from "@/lib/knockout/seed";
import { fetchTeamKo } from "@/lib/db/knockout";

export async function POST() {
  try {
    await requireAdmin();

    const { data: existing } = await supabaseServer
      .from("team_ko")
      .select("id")
      .limit(1);
    if (existing && existing.length > 0) {
      return err("Bracket đã tồn tại. Xoá bracket cũ trước khi tạo mới.", 409);
    }

    const groups = await fetchTeamGroups();
    if (groups.length < 2) {
      return err("Cần ít nhất 2 bảng để tạo bracket", 400);
    }

    const seeds: SeedEntry[] = [];
    for (const group of groups) {
      const matches = await fetchTeamMatchesByGroup(group.id);
      const standings = computeTeamStandings(
        group.entries.map((e) => ({ id: e.id, label: e.label })),
        matches,
      );
      const sorted = standings.filter((s) => s.played > 0).sort((a, b) => a.rank - b.rank);
      for (let i = 0; i < Math.min(2, sorted.length); i++) {
        seeds.push({
          groupName: group.name,
          rank: i + 1,
          entryId: sorted[i].entryId,
        });
      }
    }

    const bracket = buildTeamBracket(seeds);

    const { error: insertErr } = await supabaseServer
      .from("team_ko")
      .insert(bracket);
    if (insertErr) return err(insertErr.message);

    const resolved = await fetchTeamKo();
    return ok(resolved, 201);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
