import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchDoublesMatchById } from "@/lib/db/matches";
import { IdSchema } from "@/lib/schemas/id";
import {
  DoublesMatchPatchSchema,
  type SetScore,
  type Status,
  type BestOf,
} from "@/lib/schemas/match";
import { supabaseServer } from "@/lib/supabase/server";
import {
  deriveDoublesWinner,
  deriveSetCounts,
} from "@/lib/matches/derive";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

type ExistingRow = {
  pair_a: string;
  pair_b: string;
  sets: SetScore[];
  best_of: BestOf;
  status: Status;
  winner: string | null;
};

async function fetchExisting(id: string): Promise<ExistingRow | null> {
  const chain = supabaseServer
    .from("doubles_matches")
    .select("pair_a, pair_b, sets, best_of, status, winner")
    .eq("id", id);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: ExistingRow | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  return data;
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const existing = await fetchExisting(id);
    if (!existing) return err("Trận không tồn tại", 404);

    const body = await req.json();
    const parsed = DoublesMatchPatchSchema.parse(body);

    // Forfeit gate
    if (parsed.status === "forfeit") {
      const w = parsed.winner;
      if (w !== existing.pair_a && w !== existing.pair_b) {
        throw new BadRequestError(
          "Winner phải thuộc pair_a hoặc pair_b của trận",
        );
      }
    }

    // Effective values
    const effSets = parsed.sets ?? existing.sets;
    const effBestOf = parsed.bestOf ?? existing.best_of;
    const effStatus: Status = parsed.status ?? existing.status;

    const updates: Record<string, unknown> = {};
    if (parsed.sets !== undefined) {
      updates.sets = parsed.sets;
    }
    if (parsed.bestOf !== undefined) updates.best_of = parsed.bestOf;
    if (parsed.table !== undefined) updates.table = parsed.table;
    if (parsed.status !== undefined) updates.status = parsed.status;

    // Re-derive set counts whenever sets or bestOf changed
    if (parsed.sets !== undefined || parsed.bestOf !== undefined) {
      const { a, b } = deriveSetCounts(effSets);
      updates.sets_a = a;
      updates.sets_b = b;
    }

    // Winner derivation
    if (effStatus === "done") {
      const w = deriveDoublesWinner(
        effSets,
        existing.pair_a,
        existing.pair_b,
        effBestOf,
      );
      if (!w) {
        throw new BadRequestError(
          "Chưa đủ set quyết định, không thể đặt status='done'",
        );
      }
      updates.winner = w;
    } else if (effStatus === "forfeit") {
      updates.winner = parsed.winner ?? existing.winner;
    } else {
      // scheduled
      updates.winner = null;
    }

    updates.updated_at = new Date().toISOString();
    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseServer
        .from("doubles_matches")
        .update(updates)
        .eq("id", id);
      if (updErr) return err(updErr.message);
    }

    const resolved = await fetchDoublesMatchById(id);
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
