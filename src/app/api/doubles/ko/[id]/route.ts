import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchDoublesKoById } from "@/lib/db/knockout";
import { IdSchema } from "@/lib/schemas/id";
import { DoublesKoPatchSchema } from "@/lib/schemas/knockout";
import type { SetScore, Status, BestOf } from "@/lib/schemas/match";
import { supabaseServer } from "@/lib/supabase/server";
import { deriveDoublesWinner, deriveSetCounts } from "@/lib/matches/derive";
import { advanceWinner, retractWinner } from "@/lib/knockout/advance";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

type ExistingRow = {
  entry_a: string | null;
  entry_b: string | null;
  sets: SetScore[];
  best_of: BestOf;
  status: Status;
  winner: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

async function fetchExisting(id: string): Promise<ExistingRow | null> {
  const chain = supabaseServer
    .from("doubles_ko")
    .select("entry_a, entry_b, sets, best_of, status, winner, next_match_id, next_slot")
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

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const match = await fetchDoublesKoById(id);
    if (!match) return err("Trận không tồn tại", 404);
    return ok(match);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const existing = await fetchExisting(id);
    if (!existing) return err("Trận không tồn tại", 404);

    const body = await req.json();
    const parsed = DoublesKoPatchSchema.parse(body);

    // Entry swap validation
    if (parsed.entryA !== undefined && parsed.entryA !== null) {
      const { data } = await supabaseServer
        .from("doubles_pairs")
        .select("id")
        .eq("id", parsed.entryA)
        .limit(1);
      if (!data?.length) throw new BadRequestError(`Cặp ${parsed.entryA} không tồn tại`);
    }
    if (parsed.entryB !== undefined && parsed.entryB !== null) {
      const { data } = await supabaseServer
        .from("doubles_pairs")
        .select("id")
        .eq("id", parsed.entryB)
        .limit(1);
      if (!data?.length) throw new BadRequestError(`Cặp ${parsed.entryB} không tồn tại`);
    }

    const effEntryA = parsed.entryA !== undefined ? parsed.entryA : existing.entry_a;
    const effEntryB = parsed.entryB !== undefined ? parsed.entryB : existing.entry_b;

    // Forfeit gate
    if (parsed.status === "forfeit") {
      const w = parsed.winner;
      if (w !== effEntryA && w !== effEntryB) {
        throw new BadRequestError("Winner phải thuộc entry_a hoặc entry_b");
      }
    }

    const effSets = parsed.sets ?? existing.sets;
    const effBestOf = parsed.bestOf ?? existing.best_of;
    const effStatus: Status = parsed.status ?? existing.status;

    const updates: Record<string, unknown> = {};
    if (parsed.sets !== undefined) updates.sets = parsed.sets;
    if (parsed.bestOf !== undefined) updates.best_of = parsed.bestOf;
    if (parsed.table !== undefined) updates.table = parsed.table;
    if (parsed.status !== undefined) updates.status = parsed.status;
    if (parsed.entryA !== undefined) updates.entry_a = parsed.entryA;
    if (parsed.entryB !== undefined) updates.entry_b = parsed.entryB;

    // Re-derive set counts
    if (parsed.sets !== undefined || parsed.bestOf !== undefined) {
      const { a, b } = deriveSetCounts(effSets);
      updates.sets_a = a;
      updates.sets_b = b;
    }

    // Winner derivation
    let newWinner: string | null = null;
    if (effStatus === "done") {
      if (!effEntryA || !effEntryB) {
        throw new BadRequestError("Chưa có đủ 2 đội để hoàn thành trận");
      }
      const w = deriveDoublesWinner(effSets, effEntryA, effEntryB, effBestOf);
      if (!w) {
        throw new BadRequestError("Chưa đủ set quyết định");
      }
      newWinner = w;
      updates.winner = w;
    } else if (effStatus === "forfeit") {
      newWinner = (parsed.winner ?? existing.winner)!;
      updates.winner = newWinner;
    } else {
      updates.winner = null;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseServer
        .from("doubles_ko")
        .update(updates)
        .eq("id", id);
      if (updErr) return err(updErr.message);
    }

    // Auto-advance / retract
    const hadWinner = existing.winner !== null;
    const hasWinner = newWinner !== null;

    if (!hadWinner && hasWinner && existing.next_match_id) {
      await advanceWinner("doubles_ko", existing.next_match_id, existing.next_slot, newWinner!);
    } else if (hadWinner && !hasWinner && existing.next_match_id && existing.next_slot) {
      await retractWinner("doubles_ko", existing.next_match_id, existing.next_slot);
    }

    const resolved = await fetchDoublesKoById(id);
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
