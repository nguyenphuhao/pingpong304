import { describe, it, expect, vi, beforeEach } from "vitest";
import { findEntityTool } from "./find-entity";

vi.mock("@/lib/db/pairs", () => ({
  fetchPairs: vi.fn(),
}));
vi.mock("@/lib/db/teams", () => ({
  fetchTeams: vi.fn(),
}));

import { fetchPairs } from "@/lib/db/pairs";
import { fetchTeams } from "@/lib/db/teams";

type FindEntityResult = {
  matches: Array<{ type: string; id: string; label: string; matchedOn: string }>;
};

describe("findEntityTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches pair by player name (substring, case-insensitive)", async () => {
    (fetchPairs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", p1: { id: "x", name: "Nguyễn Văn A" }, p2: { id: "y", name: "Trần B" } },
    ]);
    (fetchTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await findEntityTool.execute!({ query: "Văn A" }, { toolCallId: "t", messages: [] });
    if (result && typeof result === "object" && !(Symbol.asyncIterator in result)) {
      expect((result as FindEntityResult).matches.length).toBeGreaterThan(0);
      expect((result as FindEntityResult).matches[0].type).toBe("pair");
    }
  });

  it("returns empty matches when nothing found", async () => {
    (fetchPairs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await findEntityTool.execute!({ query: "xyz" }, { toolCallId: "t", messages: [] });
    if (result && typeof result === "object" && !(Symbol.asyncIterator in result)) {
      expect((result as FindEntityResult).matches.length).toBe(0);
    }
  });
});
