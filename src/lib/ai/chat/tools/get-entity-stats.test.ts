import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEntityStatsTool } from "./get-entity-stats";

vi.mock("@/lib/db/groups", () => ({
  fetchDoublesGroups: vi.fn(),
  fetchTeamGroups: vi.fn(),
}));
vi.mock("@/lib/db/matches", () => ({
  fetchDoublesMatchesByGroup: vi.fn(),
  fetchTeamMatchesByGroup: vi.fn(),
}));

import { fetchDoublesGroups } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";
import { doublesGroupMidTournament } from "../fixtures/groups";

describe("getEntityStatsTool — pair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts played/won/lost/remaining", async () => {
    (fetchDoublesGroups as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "g1", name: "A", entries: doublesGroupMidTournament.entries },
    ]);
    (fetchDoublesMatchesByGroup as ReturnType<typeof vi.fn>).mockResolvedValue(
      doublesGroupMidTournament.matches,
    );

    const result = await (getEntityStatsTool.execute as any)(
      { entityId: "p1", type: "pair" },
      { toolCallId: "t", messages: [] },
    );
    expect(result.played).toBeGreaterThanOrEqual(0);
    expect(result.won + result.lost).toBe(result.played);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it("throws NOT_FOUND when entity not in any group", async () => {
    (fetchDoublesGroups as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await expect(
      (getEntityStatsTool.execute as any)(
        { entityId: "unknown", type: "pair" },
        { toolCallId: "t", messages: [] },
      ),
    ).rejects.toThrow(/NOT_FOUND/);
  });
});
