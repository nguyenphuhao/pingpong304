import { supabaseServer } from "@/lib/supabase/server";

export async function nextId(
  table: string,
  prefix: string,
  padLen: number,
): Promise<string> {
  const { data, error } = await supabaseServer
    .from(table)
    .select("id")
    .like("id", `${prefix}%`);
  if (error) throw new Error(error.message);
  const nums = (data ?? [])
    .map((r: { id: string }) => Number(r.id.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(padLen, "0")}`;
}
