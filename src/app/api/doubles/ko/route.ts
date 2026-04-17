import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { fetchDoublesKo } from "@/lib/db/knockout";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const matches = await fetchDoublesKo();
    return ok(matches);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}

export async function DELETE() {
  try {
    await requireAdmin();
    const { error } = await supabaseServer
      .from("doubles_ko")
      .delete()
      .neq("id", "");
    if (error) return err(error.message);
    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
