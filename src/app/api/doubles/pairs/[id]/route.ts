import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchPairById } from "@/lib/db/pairs";
import { IdSchema } from "@/lib/schemas/id";
import { PairPatchSchema } from "@/lib/schemas/pair";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

async function verifyPlayersExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id")
    .or(ids.map((id) => `id.eq.${id}`).join(","));
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const id of ids) {
    if (!found.has(id)) throw new BadRequestError(`VĐV không tồn tại: ${id}`);
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const data = await fetchPairById(id);
    if (!data) return err("Not found", 404);
    return ok(data);
  } catch (e) {
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);
    const body = await req.json();
    const parsed = PairPatchSchema.parse(body);

    // Merged integrity: when the patch only touches one slot, the other is
    // the existing row. Enforce p1 != p2 on the merged state (refine only
    // catches the both-in-patch case).
    const onlyP1 = parsed.p1 !== undefined && parsed.p2 === undefined;
    const onlyP2 = parsed.p2 !== undefined && parsed.p1 === undefined;
    if (onlyP1 || onlyP2) {
      const existing = await fetchPairById(id);
      if (!existing) return err("Not found", 404);
      const mergedP1 = parsed.p1 ?? existing.p1.id;
      const mergedP2 = parsed.p2 ?? existing.p2.id;
      if (mergedP1 === mergedP2) return err("p2: 2 VĐV phải khác nhau", 400);
    }

    const verifyIds: string[] = [];
    if (parsed.p1) verifyIds.push(parsed.p1);
    if (parsed.p2) verifyIds.push(parsed.p2);
    await verifyPlayersExist(verifyIds);

    const update: Record<string, unknown> = {};
    if (parsed.p1 !== undefined) update.p1 = parsed.p1;
    if (parsed.p2 !== undefined) update.p2 = parsed.p2;

    const { error } = await supabaseServer
      .from("doubles_pairs")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
      return err(error.message);
    }
    const resolved = await fetchPairById(id);
    return ok(resolved);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    if (e instanceof BadRequestError) return err(e.message, 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const { data: matches, error: mErr } = await supabaseServer
      .from("doubles_matches")
      .select("id")
      .or(`pair_a.eq.${id},pair_b.eq.${id}`);
    if (mErr) return err(mErr.message);

    const { data: groups, error: gErr } = await supabaseServer
      .from("doubles_groups")
      .select("id, name")
      .contains("entries", [id]);
    if (gErr) return err(gErr.message);

    const refs: string[] = [];
    if (matches && matches.length > 0) refs.push(`${matches.length} trận đấu`);
    if (groups && groups.length > 0) {
      const names = groups.map((g: { name: string }) => g.name).join(", ");
      refs.push(`bảng ${names}`);
    }
    if (refs.length > 0) {
      return err(
        `Cặp đang dùng trong ${refs.join(" và ")} — xoá các tham chiếu trước`,
        409,
      );
    }

    const { error } = await supabaseServer
      .from("doubles_pairs")
      .delete()
      .eq("id", id);
    if (error) return err(error.message);
    return ok(null);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) return err("ID không hợp lệ", 400);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
