import { tool } from "ai";
import { z } from "zod";
import { fetchDoublesGroups, fetchTeamGroups } from "@/lib/db/groups";
import {
  fetchDoublesMatchesByGroup,
  fetchTeamMatchesByGroup,
} from "@/lib/db/matches";
import {
  computeDoublesStandings,
  computeTeamStandings,
} from "@/lib/standings/compute";

export const getStandingsTool = tool({
  description: "Lấy bảng xếp hạng của 1 bảng đấu (đã áp dụng luật tiebreaker).",
  inputSchema: z.object({
    groupId: z.string().min(1),
    type: z.enum(["doubles", "teams"]),
  }),
  execute: async ({ groupId, type }) => {
    if (type === "doubles") {
      const groups = await fetchDoublesGroups();
      const group = groups.find((g) => g.id === groupId);
      if (!group) throw new Error("NOT_FOUND: bảng không tồn tại");
      const matches = await fetchDoublesMatchesByGroup(groupId);
      const rows = computeDoublesStandings(group.entries, matches);
      return { groupName: group.name, rows };
    }
    const groups = await fetchTeamGroups();
    const group = groups.find((g) => g.id === groupId);
    if (!group) throw new Error("NOT_FOUND: bảng không tồn tại");
    const matches = await fetchTeamMatchesByGroup(groupId);
    const rows = computeTeamStandings(group.entries, matches);
    return { groupName: group.name, rows };
  },
});
