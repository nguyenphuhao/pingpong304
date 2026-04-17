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
import { resolveGroup } from "./resolve-group";

export const getStandingsTool = tool({
  description:
    "Lấy bảng xếp hạng của 1 bảng đấu (đã áp dụng luật tiebreaker). groupId chấp nhận id chính xác (vd 'gA') HOẶC tên bảng (vd 'Bảng A' hoặc chỉ 'A').",
  inputSchema: z.object({
    groupId: z.string().min(1),
    type: z.enum(["doubles", "teams"]),
  }),
  execute: async ({ groupId, type }) => {
    if (type === "doubles") {
      const groups = await fetchDoublesGroups();
      const group = resolveGroup(groupId, groups);
      const matches = await fetchDoublesMatchesByGroup(group.id);
      const rows = computeDoublesStandings(group.entries, matches);
      return { groupId: group.id, groupName: group.name, rows };
    }
    const groups = await fetchTeamGroups();
    const group = resolveGroup(groupId, groups);
    const matches = await fetchTeamMatchesByGroup(group.id);
    const rows = computeTeamStandings(group.entries, matches);
    return { groupId: group.id, groupName: group.name, rows };
  },
});
