import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const path = join(process.cwd(), "docs", "tournament-rules.md");

if (!existsSync(path)) {
  console.error("✗ docs/tournament-rules.md missing");
  process.exit(1);
}

const content = readFileSync(path, "utf-8").trim();

if (content.length < 100) {
  console.error("✗ docs/tournament-rules.md too short (<100 chars)");
  process.exit(1);
}

if (!/^# /m.test(content)) {
  console.error("✗ docs/tournament-rules.md missing H1 heading");
  process.exit(1);
}

console.log("✓ tournament-rules.md valid");
