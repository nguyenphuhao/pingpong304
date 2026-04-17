import { tool } from "ai";
import { z } from "zod";
import {
  fetchDoublesMatchesByGroup,
  fetchTeamMatchesByGroup,
} from "@/lib/db/matches";
import { fetchDoublesGroups, fetchTeamGroups } from "@/lib/db/groups";
import { compareDoublesPairs } from "../compare";

export const comparePairsTool = tool({
  description: "So sánh 2 cặp hoặc 2 đội: đối đầu trực tiếp, đối thủ chung.",
  inputSchema: z.object({
    entityIdA: z.string().min(1),
    entityIdB: z.string().min(1),
    type: z.enum(["doubles", "teams"]),
  }),
  execute: async ({ entityIdA, entityIdB, type }) => {
    if (type === "doubles") {
      const groups = await fetchDoublesGroups();
      const all = (
        await Promise.all(groups.map((g) => fetchDoublesMatchesByGroup(g.id)))
      ).flat();
      return compareDoublesPairs({ idA: entityIdA, idB: entityIdB, matches: all });
    }
    // Teams: reuse same structure — adapt signature by mapping TeamMatch to pseudo-doubles
    const groups = await fetchTeamGroups();
    const all = (
      await Promise.all(groups.map((g) => fetchTeamMatchesByGroup(g.id)))
    ).flat();
    // Build pseudo-MatchResolved shape inline for compare (minimal)
    const adapted = all.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      pairA: { id: m.teamA.id, label: m.teamA.name },
      pairB: { id: m.teamB.id, label: m.teamB.name },
      table: m.table,
      bestOf: 3 as const,
      sets: [],
      setsA: m.scoreA,
      setsB: m.scoreB,
      status: m.status,
      winner: m.winner ? { id: m.winner.id, label: m.winner.name } : null,
    }));
    return compareDoublesPairs({ idA: entityIdA, idB: entityIdB, matches: adapted });
  },
});
