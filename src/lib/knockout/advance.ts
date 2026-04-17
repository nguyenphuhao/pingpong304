import { supabaseServer } from "@/lib/supabase/server";

type KoTable = "doubles_ko" | "team_ko";

export async function advanceWinner(
  table: KoTable,
  nextMatchId: string | null,
  nextSlot: "a" | "b" | null,
  winnerId: string,
): Promise<void> {
  if (!nextMatchId || !nextSlot) return;
  const update = nextSlot === "a" ? { entry_a: winnerId } : { entry_b: winnerId };
  const { error } = await supabaseServer
    .from(table)
    .update(update)
    .eq("id", nextMatchId);
  if (error) throw new Error(error.message);
}

export async function retractWinner(
  table: KoTable,
  nextMatchId: string,
  nextSlot: "a" | "b",
): Promise<void> {
  const chain = supabaseServer
    .from(table)
    .select("status")
    .eq("id", nextMatchId);
  const maybeSingle = (chain as unknown as {
    maybeSingle: () => Promise<{
      data: { status: string } | null;
      error: { message: string } | null;
    }>;
  }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  if (data?.status === "done" || data?.status === "forfeit") {
    throw new Error("Không thể mở lại, trận tiếp đã hoàn thành");
  }

  const update = nextSlot === "a" ? { entry_a: null } : { entry_b: null };
  const { error: updErr } = await supabaseServer
    .from(table)
    .update(update)
    .eq("id", nextMatchId);
  if (updErr) throw new Error(updErr.message);
}
