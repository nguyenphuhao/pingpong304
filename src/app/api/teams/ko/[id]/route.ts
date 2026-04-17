import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamKoById } from "@/lib/db/knockout";
import { IdSchema } from "@/lib/schemas/id";
import { TeamKoPatchSchema } from "@/lib/schemas/knockout";
import type { Status, SubMatch } from "@/lib/schemas/match";
import { supabaseServer } from "@/lib/supabase/server";
import { deriveTeamScore, deriveTeamWinner } from "@/lib/matches/derive";
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
  individual: SubMatch[];
  status: Status;
  winner: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

async function fetchExisting(id: string): Promise<ExistingRow | null> {
  const chain = supabaseServer
    .from("team_ko")
    .select("entry_a, entry_b, individual, status, winner, next_match_id, next_slot")
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

async function fetchTeamsMembers(
  teamAId: string,
  teamBId: string,
): Promise<{ a: Set<string>; b: Set<string> }> {
  const { data, error } = await supabaseServer
    .from("teams")
    .select("id, members")
    .or(`id.eq.${teamAId},id.eq.${teamBId}`);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; members: string[] }>;
  const aRow = rows.find((r) => r.id === teamAId);
  const bRow = rows.find((r) => r.id === teamBId);
  return {
    a: new Set(aRow?.members ?? []),
    b: new Set(bRow?.members ?? []),
  };
}

function validatePlayerMembership(
  individual: SubMatch[],
  members: { a: Set<string>; b: Set<string> },
  teamAId: string,
  teamBId: string,
) {
  for (const sub of individual) {
    for (const p of sub.playersA) {
      if (!members.a.has(p)) {
        throw new BadRequestError(
          `VĐV ${p} không thuộc đội ${teamAId} (sub ${sub.id})`,
        );
      }
    }
    for (const p of sub.playersB) {
      if (!members.b.has(p)) {
        throw new BadRequestError(
          `VĐV ${p} không thuộc đội ${teamBId} (sub ${sub.id})`,
        );
      }
    }
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const match = await fetchTeamKoById(id);
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
    const parsed = TeamKoPatchSchema.parse(body);

    // Entry swap validation
    if (parsed.entryA !== undefined && parsed.entryA !== null) {
      const { data } = await supabaseServer
        .from("teams")
        .select("id")
        .eq("id", parsed.entryA)
        .limit(1);
      if (!data?.length) throw new BadRequestError(`Đội ${parsed.entryA} không tồn tại`);
    }
    if (parsed.entryB !== undefined && parsed.entryB !== null) {
      const { data } = await supabaseServer
        .from("teams")
        .select("id")
        .eq("id", parsed.entryB)
        .limit(1);
      if (!data?.length) throw new BadRequestError(`Đội ${parsed.entryB} không tồn tại`);
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

    const effIndividual = parsed.individual ?? existing.individual;
    const effStatus: Status = parsed.status ?? existing.status;

    // Player membership validation
    if (parsed.individual !== undefined && effEntryA && effEntryB) {
      const members = await fetchTeamsMembers(effEntryA, effEntryB);
      validatePlayerMembership(parsed.individual, members, effEntryA, effEntryB);
    }

    const updates: Record<string, unknown> = {};
    if (parsed.individual !== undefined) updates.individual = parsed.individual;
    if (parsed.status !== undefined) updates.status = parsed.status;
    if (parsed.entryA !== undefined) updates.entry_a = parsed.entryA;
    if (parsed.entryB !== undefined) updates.entry_b = parsed.entryB;

    if (parsed.individual !== undefined && effEntryA && effEntryB) {
      const { scoreA, scoreB } = deriveTeamScore(effIndividual, effEntryA, effEntryB);
      updates.score_a = scoreA;
      updates.score_b = scoreB;
    }

    let newWinner: string | null = null;
    if (effStatus === "done") {
      if (!effEntryA || !effEntryB) {
        throw new BadRequestError("Chưa có đủ 2 đội để hoàn thành trận");
      }
      const w = deriveTeamWinner(effIndividual, effEntryA, effEntryB);
      if (!w) {
        throw new BadRequestError("Chưa đủ sub-match quyết định");
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
        .from("team_ko")
        .update(updates)
        .eq("id", id);
      if (updErr) return err(updErr.message);
    }

    // Auto-advance / retract
    const hadWinner = existing.winner !== null;
    const hasWinner = newWinner !== null;

    if (!hadWinner && hasWinner && existing.next_match_id) {
      await advanceWinner("team_ko", existing.next_match_id, existing.next_slot, newWinner!);
    } else if (hadWinner && !hasWinner && existing.next_match_id && existing.next_slot) {
      await retractWinner("team_ko", existing.next_match_id, existing.next_slot);
    }

    const resolved = await fetchTeamKoById(id);
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
