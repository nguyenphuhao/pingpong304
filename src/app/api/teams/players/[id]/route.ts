import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { PlayerPatchSchema } from "@/lib/schemas/player";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name, phone, gender, club")
    .eq("id", id)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
    return err(error.message);
  }
  return ok(data);
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = PlayerPatchSchema.parse(body);

    const update: Record<string, unknown> = {};
    if (parsed.name !== undefined) update.name = parsed.name;
    if (parsed.gender !== undefined) update.gender = parsed.gender;
    if (parsed.club !== undefined) update.club = parsed.club;
    if (parsed.phone !== undefined) {
      update.phone = parsed.phone && parsed.phone.length > 0 ? parsed.phone : null;
    }

    const { data, error } = await supabaseServer
      .from("team_players")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
      return err(error.message);
    }
    return ok(data);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    // Pre-check: any team has this player in members array?
    const { data: teams, error: checkErr } = await supabaseServer
      .from("teams")
      .select("id, name, members")
      .contains("members", [id]);
    if (checkErr) return err(checkErr.message);

    if (teams && teams.length > 0) {
      const names = teams.map((t: { name: string }) => t.name).join(", ");
      return err(
        `VĐV đang trong ${teams.length} đội: ${names} — xoá khỏi đội trước`,
        409,
      );
    }

    const { error } = await supabaseServer.from("team_players").delete().eq("id", id);
    if (error) return err(error.message);
    return ok(null);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
