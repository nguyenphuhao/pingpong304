import { tool } from "ai";
import { z } from "zod";
import {
  fetchDoublesMatchesByGroup,
  fetchTeamMatchesByGroup,
} from "@/lib/db/matches";
import { fetchDoublesGroups, fetchTeamGroups } from "@/lib/db/groups";

export const getUpcomingMatchesTool = tool({
  description:
    "Lấy danh sách trận sắp tới. Có thể lọc theo bảng (groupId) hoặc theo cặp/đội (entityId). Mặc định limit=5.",
  inputSchema: z.object({
    groupId: z.string().optional(),
    entityId: z.string().optional(),
    type: z.enum(["doubles", "teams"]),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  execute: async ({ groupId, entityId, type, limit }) => {
    if (type === "doubles") {
      const groups = groupId
        ? [(await fetchDoublesGroups()).find((g) => g.id === groupId)].filter((g) => g !== undefined)
        : await fetchDoublesGroups();
      const allMatches = (
        await Promise.all(groups.map((g) => fetchDoublesMatchesByGroup(g!.id)))
      ).flat();
      const filtered = allMatches
        .filter((m) => m.status === "scheduled" || m.status === "live")
        .filter(
          (m) =>
            !entityId || m.pairA.id === entityId || m.pairB.id === entityId,
        )
        .slice(0, limit);
      return {
        matches: filtered.map((m) => ({
          id: m.id,
          groupId: m.groupId,
          pairA: m.pairA,
          pairB: m.pairB,
          status: m.status,
          bestOf: m.bestOf,
        })),
      };
    }
    const groups = groupId
      ? [(await fetchTeamGroups()).find((g) => g.id === groupId)].filter((g) => g !== undefined)
      : await fetchTeamGroups();
    const allMatches = (
      await Promise.all(groups.map((g) => fetchTeamMatchesByGroup(g!.id)))
    ).flat();
    const filtered = allMatches
      .filter((m) => m.status === "scheduled" || m.status === "live")
      .filter(
        (m) =>
          !entityId || m.teamA.id === entityId || m.teamB.id === entityId,
      )
      .slice(0, limit);
    return {
      matches: filtered.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        teamA: m.teamA,
        teamB: m.teamB,
        status: m.status,
      })),
    };
  },
});
