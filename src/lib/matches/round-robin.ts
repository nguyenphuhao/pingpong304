export type Pairing = { a: string; b: string };
export type CurrentMatch = { id: string; a: string; b: string };

export function generatePairings(entries: string[]): Pairing[] {
  const out: Pairing[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      out.push({ a: entries[i], b: entries[j] });
    }
  }
  return out;
}

function canonKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export type DiffResult = {
  keep: CurrentMatch[];
  delete: string[];
  add: Pairing[];
};

export function computeMatchDiff(
  current: CurrentMatch[],
  target: Pairing[],
): DiffResult {
  const targetKeys = new Set(target.map((p) => canonKey(p.a, p.b)));
  const currentKeys = new Map(
    current.map((m) => [canonKey(m.a, m.b), m]),
  );

  const keep: CurrentMatch[] = [];
  const del: string[] = [];
  for (const m of current) {
    if (targetKeys.has(canonKey(m.a, m.b))) keep.push(m);
    else del.push(m.id);
  }

  const add: Pairing[] = [];
  for (const p of target) {
    if (!currentKeys.has(canonKey(p.a, p.b))) add.push(p);
  }

  return { keep, delete: del, add };
}

export function nextMatchId(prefix: string, existing: string[]): string {
  const nums = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(2, "0")}`;
}
