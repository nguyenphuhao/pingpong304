import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchTeamById, fetchTeams } from "@/lib/db/teams";
import { nextId } from "@/lib/db/next-id";
import { TeamInputSchema, type TeamInput } from "@/lib/schemas/team";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const data = await fetchTeams();
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

async function verifyPlayersExist(ids: string[]): Promise<void> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id")
    .or(ids.map((id) => `id.eq.${id}`).join(","));
  if (error) throw new Error(error.message);
  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  for (const id of ids) {
    if (!found.has(id)) throw new BadRequestError(`VĐV không tồn tại: ${id}`);
  }
}

async function insertWithRetry(body: TeamInput, attempt = 0): Promise<string> {
  if (attempt >= 3) throw new Error("Không sinh được id sau 3 lần thử");
  const id = await nextId("teams", "T", 2);
  const { data, error } = await supabaseServer
    .from("teams")
    .insert({ id, name: body.name, members: body.members })
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return insertWithRetry(body, attempt + 1);
    }
    throw new Error(error.message);
  }
  return (data as { id: string }).id;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = TeamInputSchema.parse(body);
    await verifyPlayersExist(parsed.members);
    const id = await insertWithRetry(parsed);
    const resolved = await fetchTeamById(id);
    return ok(resolved, 201);
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
