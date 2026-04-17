import { NextResponse } from "next/server";
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamGroupById } from "@/lib/db/groups";
import { fetchTeamMatchesByGroup } from "@/lib/db/matches";
import { IdSchema } from "@/lib/schemas/id";
import { supabaseServer } from "@/lib/supabase/server";
import {
  computeMatchDiff,
  generatePairings,
  nextMatchId,
  type CurrentMatch,
} from "@/lib/matches/round-robin";

type Ctx = { params: Promise<{ id: string }> };

function defaultIndividual(matchId: string) {
  return [
    {
      id: `${matchId}-d`,
      label: "Đôi",
      kind: "doubles",
      playersA: [],
      playersB: [],
      bestOf: 3,
      sets: [],
    },
    {
      id: `${matchId}-s1`,
      label: "Đơn 1",
      kind: "singles",
      playersA: [],
      playersB: [],
      bestOf: 3,
      sets: [],
    },
    {
      id: `${matchId}-s2`,
      label: "Đơn 2",
      kind: "singles",
      playersA: [],
      playersB: [],
      bestOf: 3,
      sets: [],
    },
  ];
}

async function fetchCurrentMatches(groupId: string): Promise<CurrentMatch[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select("id, team_a, team_b")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as Array<{ id: string; team_a: string; team_b: string }>
  ).map((r) => ({ id: r.id, a: r.team_a, b: r.team_b }));
}

async function fetchAllMatchIds(): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("team_matches")
    .select("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    IdSchema.parse(id);

    const group = await fetchTeamGroupById(id);
    if (!group) return err("Bảng không tồn tại", 404);

    const entryIds = group.entries.map((e) => e.id);
    const target = generatePairings(entryIds);
    const current = await fetchCurrentMatches(id);
    const diff = computeMatchDiff(current, target);

    let deletedCount = 0;
    let partialError: string | null = null;

    if (diff.delete.length > 0) {
      const { error: delErr } = await supabaseServer
        .from("team_matches")
        .delete()
        .in("id", diff.delete);
      if (delErr) partialError = delErr.message;
      else deletedCount = diff.delete.length;
    }

    let added = 0;
    if (diff.add.length > 0 && !partialError) {
      const allIds = await fetchAllMatchIds();
      const generated: string[] = [];
      const rows = diff.add.map((p) => {
        const newId = nextMatchId("tm", [...allIds, ...generated]);
        generated.push(newId);
        return {
          id: newId,
          group_id: id,
          team_a: p.a,
          team_b: p.b,
          status: "scheduled",
          score_a: 0,
          score_b: 0,
          winner: null,
          table: null,
          individual: defaultIndividual(newId),
        };
      });
      const { error: insErr } = await supabaseServer
        .from("team_matches")
        .insert(rows);
      if (insErr) partialError = insErr.message;
      else added = rows.length;
    }

    const matches = await fetchTeamMatchesByGroup(id);
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
