import { tool } from "ai";
import { z } from "zod";
import {
  fetchDoublesMatchesByGroup,
  fetchTeamMatchesByGroup,
} from "@/lib/db/matches";
import { fetchDoublesGroups, fetchTeamGroups } from "@/lib/db/groups";
import { resolveGroup } from "./resolve-group";

export const getUpcomingMatchesTool = tool({
  description:
    "Lấy danh sách trận sắp tới. Có thể lọc theo bảng (groupId — chấp nhận id 'gA' hoặc tên 'Bảng A'/'A') hoặc theo cặp/đội (entityId). Mặc định limit=5.",
  inputSchema: z.object({
    groupId: z.string().optional(),
    entityId: z.string().optional(),
    type: z.enum(["doubles", "teams"]),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  execute: async ({ groupId, entityId, type, limit }) => {
    if (type === "doubles") {
      const allGroups = await fetchDoublesGroups();
      const groups = groupId ? [resolveGroup(groupId, allGroups)] : allGroups;
      const allMatches = (
        await Promise.all(groups.map((g) => fetchDoublesMatchesByGroup(g.id)))
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
    const allGroups = await fetchTeamGroups();
    const groups = groupId ? [resolveGroup(groupId, allGroups)] : allGroups;
    const allMatches = (
      await Promise.all(groups.map((g) => fetchTeamMatchesByGroup(g.id)))
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
