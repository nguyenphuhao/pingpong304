import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamMatchById } from "@/lib/db/matches";
import { IdSchema } from "@/lib/schemas/id";
import {
  TeamMatchPatchSchema,
  type Status,
  type SubMatch,
} from "@/lib/schemas/match";
import { supabaseServer } from "@/lib/supabase/server";
import {
  deriveTeamScore,
  deriveTeamWinner,
} from "@/lib/matches/derive";

type Ctx = { params: Promise<{ id: string }> };

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

type ExistingRow = {
  team_a: string;
  team_b: string;
  individual: SubMatch[];
  status: Status;
  winner: string | null;
};

async function fetchExisting(id: string): Promise<ExistingRow | null> {
  const chain = supabaseServer
    .from("team_matches")
    .select("team_a, team_b, individual, status, winner")
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

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const existing = await fetchExisting(id);
    if (!existing) return err("Trận không tồn tại", 404);

    const body = await req.json();
    const parsed = TeamMatchPatchSchema.parse(body);

    // Forfeit gate
    if (parsed.status === "forfeit") {
      const w = parsed.winner;
      if (w !== existing.team_a && w !== existing.team_b) {
        throw new BadRequestError(
          "Winner phải thuộc team_a hoặc team_b của trận",
        );
      }
    }

    const effIndividual = parsed.individual ?? existing.individual;
    const effStatus: Status = parsed.status ?? existing.status;

    // Player membership validation
    if (parsed.individual !== undefined) {
      const members = await fetchTeamsMembers(existing.team_a, existing.team_b);
      validatePlayerMembership(
        parsed.individual,
        members,
        existing.team_a,
        existing.team_b,
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.individual !== undefined) updates.individual = parsed.individual;
    if (parsed.table !== undefined) updates.table = parsed.table;
    if (parsed.status !== undefined) updates.status = parsed.status;

    if (parsed.individual !== undefined) {
      const { scoreA, scoreB } = deriveTeamScore(
        effIndividual,
        existing.team_a,
        existing.team_b,
      );
      updates.score_a = scoreA;
      updates.score_b = scoreB;
    }

    if (effStatus === "done") {
      const w = deriveTeamWinner(
        effIndividual,
        existing.team_a,
        existing.team_b,
      );
      if (!w) {
        throw new BadRequestError(
          "Chưa đủ sub-match quyết định, không thể đặt status='done'",
        );
      }
      updates.winner = w;
    } else if (effStatus === "forfeit") {
      updates.winner = parsed.winner ?? existing.winner;
    } else {
      updates.winner = null;
    }

    updates.updated_at = new Date().toISOString();
    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseServer
        .from("team_matches")
        .update(updates)
        .eq("id", id);
      if (updErr) return err(updErr.message);
    }

    const resolved = await fetchTeamMatchById(id);
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
