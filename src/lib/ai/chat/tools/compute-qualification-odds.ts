import { tool } from "ai";
import { z } from "zod";
import { fetchDoublesGroups, fetchTeamGroups } from "@/lib/db/groups";
import {
  fetchDoublesMatchesByGroup,
  fetchTeamMatchesByGroup,
} from "@/lib/db/matches";
import { computeDoublesOdds, computeTeamsOdds } from "../qualification";
import { resolveGroup } from "./resolve-group";

export const computeQualificationOddsTool = tool({
  description:
    "Tính xác suất 1 cặp/đội vào vòng trong. Enumerate hết kịch bản còn lại, trả về % + trận quyết định + kịch bản cần thắng. groupId chấp nhận id chính xác hoặc tên bảng ('A'/'Bảng A').",
  inputSchema: z.object({
    groupId: z.string().min(1),
    entityId: z.string().min(1),
    type: z.enum(["doubles", "teams"]),
    advanceCount: z.number().int().min(1).max(4).default(2),
  }),
  execute: async ({ groupId, entityId, type, advanceCount }) => {
    if (type === "doubles") {
      const groups = await fetchDoublesGroups();
      const group = resolveGroup(groupId, groups);
      if (!group.entries.some((e) => e.id === entityId)) {
        throw new Error(
          `NOT_FOUND: ${entityId} không có trong bảng ${group.id}`,
        );
      }
      const matches = await fetchDoublesMatchesByGroup(group.id);
      return computeDoublesOdds({
        entries: group.entries,
        matches,
        targetId: entityId,
        advanceCount,
      });
    }
    const groups = await fetchTeamGroups();
    const group = resolveGroup(groupId, groups);
    if (!group.entries.some((e) => e.id === entityId)) {
      throw new Error(
        `NOT_FOUND: ${entityId} không có trong bảng ${group.id}`,
      );
    }
    const matches = await fetchTeamMatchesByGroup(group.id);
    return computeTeamsOdds({
      entries: group.entries,
      matches,
      targetId: entityId,
      advanceCount,
    });
  },
});
