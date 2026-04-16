import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { PlayerInputSchema } from "@/lib/schemas/player";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name, phone, gender, club")
    .order("id");
  if (error) return err(error.message);
  return ok(data);
}

async function nextTeamPlayerId(): Promise<string> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id")
    .like("id", "t%");
  if (error) throw new Error(error.message);
  const nums = (data ?? [])
    .map((r: { id: string }) => parseInt(r.id.slice(1), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `t${String(next).padStart(2, "0")}`;
}

async function insertWithRetry(
  body: z.infer<typeof PlayerInputSchema>,
  attempt = 0,
): Promise<unknown> {
  if (attempt >= 3) throw new Error("Không sinh được id sau 3 lần thử");
  const id = await nextTeamPlayerId();
  const row = {
    id,
    name: body.name,
    gender: body.gender,
    club: body.club ?? "",
    phone: body.phone && body.phone.length > 0 ? body.phone : null,
  };
  const { data, error } = await supabaseServer
    .from("team_players")
    .insert(row)
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return insertWithRetry(body, attempt + 1);
    }
    throw new Error(error.message);
  }
  return data;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = PlayerInputSchema.parse(body);
    const created = await insertWithRetry(parsed);
    return ok(created, 201);
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
