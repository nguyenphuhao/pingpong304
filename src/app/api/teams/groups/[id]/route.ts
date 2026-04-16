import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamGroupById } from "@/lib/db/groups";
import { IdSchema } from "@/lib/schemas/id";
import { GroupEntriesPatchSchema } from "@/lib/schemas/group";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

class ConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ConflictError";
  }
}

async function groupExists(id: string): Promise<boolean> {
  const chain = supabaseServer
    .from("team_groups")
    .select("id")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: { id: string } | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  return data !== null;
}

async function verifyTeamsExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data, error } = await supabaseServer
    .from("teams")
    .select("id")
    .or(ids.map((id) => `id.eq.${id}`).join(","));
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const id of ids) {
    if (!found.has(id))
      throw new BadRequestError(`Đội không tồn tại: ${id}`);
  }
}

async function verifyCrossGroupTeams(
  entries: string[],
  currentGroupId: string,
): Promise<void> {
  if (entries.length === 0) return;
  const { data, error } = await supabaseServer
    .from("team_groups")
    .select("id, name, entries")
    .neq("id", currentGroupId);
  if (error) throw new Error(error.message);
  const others = (data ?? []) as Array<{
    id: string;
    name: string;
    entries: string[];
  }>;
  const entrySet = new Set(entries);
  for (const g of others) {
    for (const e of g.entries) {
      if (entrySet.has(e)) {
        throw new ConflictError(
          `Đội ${e} đang ở ${g.name}, xóa khỏi đó trước`,
        );
      }
    }
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    if (!(await groupExists(id))) return err("Bảng không tồn tại", 404);

    const body = await req.json();
    const parsed = GroupEntriesPatchSchema.parse(body);
    await verifyTeamsExist(parsed.entries);
    await verifyCrossGroupTeams(parsed.entries, id);

    const { error: updErr } = await supabaseServer
      .from("team_groups")
      .update({ entries: parsed.entries })
      .eq("id", id);
    if (updErr) return err(updErr.message);

    const resolved = await fetchTeamGroupById(id);
    return ok(resolved);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    if (e instanceof BadRequestError) return err(e.message, 400);
    if (e instanceof ConflictError) return err(e.message, 409);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
