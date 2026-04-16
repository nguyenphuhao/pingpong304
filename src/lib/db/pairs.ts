import { supabaseServer } from "@/lib/supabase/server";
import type { PairWithNames } from "@/lib/schemas/pair";

const SELECT =
  "id, p1:doubles_players!p1(id,name), p2:doubles_players!p2(id,name)";

export async function fetchPairs(): Promise<PairWithNames[]> {
  const { data, error } = await supabaseServer
    .from("doubles_pairs")
    .select(SELECT)
    .order("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown) as PairWithNames[];
}

export async function fetchPairById(id: string): Promise<PairWithNames | null> {
  const chain = supabaseServer.from("doubles_pairs").select(SELECT).eq("id", id);
  const maybeSingle = (chain as unknown as { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> }).maybeSingle;
  const { data, error } = await maybeSingle.call(chain);
  if (error) throw new Error(error.message);
  return (data as PairWithNames | null) ?? null;
}
