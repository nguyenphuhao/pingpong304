import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: string | null = null;

export function loadTournamentRules(): string {
  if (cached !== null) return cached;
  const path = join(process.cwd(), "docs", "tournament-rules.md");
  cached = readFileSync(path, "utf-8");
  return cached;
}
