import { NextResponse } from "next/server";
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";
import { IdSchema } from "@/lib/schemas/id";
import { supabaseServer } from "@/lib/supabase/server";
import {
  computeMatchDiff,
  generatePairings,
  nextMatchId,
  type CurrentMatch,
} from "@/lib/matches/round-robin";

type Ctx = { params: Promise<{ id: string }> };

async function fetchCurrentMatches(groupId: string): Promise<CurrentMatch[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select("id, pair_a, pair_b")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as Array<{ id: string; pair_a: string; pair_b: string }>
  ).map((r) => ({ id: r.id, a: r.pair_a, b: r.pair_b }));
}

async function fetchAllMatchIds(): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("doubles_matches")
    .select("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const group = await fetchDoublesGroupById(id);
    if (!group) return err("Bảng không tồn tại", 404);

    const entryIds = group.entries.map((e) => e.id);
    const target = generatePairings(entryIds);
    const current = await fetchCurrentMatches(id);
    const diff = computeMatchDiff(current, target);

    let deletedCount = 0;
    let partialError: string | null = null;

    // Delete stale
    if (diff.delete.length > 0) {
      const { error: delErr } = await supabaseServer
        .from("doubles_matches")
        .delete()
        .in("id", diff.delete);
      if (delErr) partialError = delErr.message;
      else deletedCount = diff.delete.length;
    }

    // Insert new
    let added = 0;
    if (diff.add.length > 0 && !partialError) {
      const allIds = await fetchAllMatchIds();
      const generated: string[] = [];
      const rows = diff.add.map((p) => {
        const newId = nextMatchId("dm", [...allIds, ...generated]);
        generated.push(newId);
        return {
          id: newId,
          group_id: id,
          pair_a: p.a,
          pair_b: p.b,
          best_of: 3,
          sets: [],
          status: "scheduled",
          sets_a: 0,
          sets_b: 0,
          winner: null,
          table: null,
        };
      });
      const { error: insErr } = await supabaseServer
        .from("doubles_matches")
        .insert(rows);
      if (insErr) partialError = insErr.message;
      else added = rows.length;
    }

    const matches = await fetchDoublesMatchesByGroup(id);
    const summary = {
      kept: diff.keep.length,
      deleted: deletedCount,
      added,
    };

    if (partialError) {
      return NextResponse.json(
        { data: { matches, summary }, error: partialError },
        { status: 207 },
      );
    }
    return ok({ matches, summary });
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
