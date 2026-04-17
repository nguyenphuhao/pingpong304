import { tool } from "ai";
import { z } from "zod";
import {
  fetchDoublesMatchesByGroup,
  fetchTeamMatchesByGroup,
} from "@/lib/db/matches";
import { fetchDoublesGroups, fetchTeamGroups } from "@/lib/db/groups";
import { analyzePairForm } from "../form";

export const analyzeFormTool = tool({
  description:
    "Phân tích phong độ gần đây của 1 cặp/đội: N trận gần nhất, streak thắng/thua, hiệu số set trung bình.",
  inputSchema: z.object({
    entityId: z.string().min(1),
    type: z.enum(["pair", "team"]),
    lastN: z.number().int().min(1).max(10).default(5),
  }),
  execute: async ({ entityId, type, lastN }) => {
    if (type === "pair") {
      const groups = await fetchDoublesGroups();
      const all = (
        await Promise.all(groups.map((g) => fetchDoublesMatchesByGroup(g.id)))
      ).flat();
      return analyzePairForm({ pairId: entityId, matches: all, lastN });
    }
    // Team form: same analyzer via adapter
    const groups = await fetchTeamGroups();
    const all = (
      await Promise.all(groups.map((g) => fetchTeamMatchesByGroup(g.id)))
    ).flat();
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
    return analyzePairForm({ pairId: entityId, matches: adapted, lastN });
  },
});
