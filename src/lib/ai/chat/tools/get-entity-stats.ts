import { tool } from "ai";
import { z } from "zod";
import { fetchDoublesGroups, fetchTeamGroups } from "@/lib/db/groups";
import {
  fetchDoublesMatchesByGroup,
  fetchTeamMatchesByGroup,
} from "@/lib/db/matches";

export const getEntityStatsTool = tool({
  description:
    "Lấy thống kê 1 cặp hoặc 1 đội: số trận đã đánh, thắng, thua, còn lại, đối thủ tiếp theo.",
  inputSchema: z.object({
    entityId: z.string().min(1),
    type: z.enum(["pair", "team"]),
  }),
  execute: async ({ entityId, type }) => {
    if (type === "pair") {
      const groups = await fetchDoublesGroups();
      const group = groups.find((g) => g.entries.some((e) => e.id === entityId));
      if (!group) throw new Error("NOT_FOUND: cặp không nằm trong bảng nào");
      const matches = await fetchDoublesMatchesByGroup(group.id);
      const mine = matches.filter(
        (m) => m.pairA.id === entityId || m.pairB.id === entityId,
      );
      const done = mine.filter((m) => m.status === "done" || m.status === "forfeit");
      const won = done.filter((m) => m.winner?.id === entityId).length;
      const remaining = mine.filter(
        (m) => m.status === "scheduled" || m.status === "live",
      );
      const nextMatch = remaining[0];
      return {
        played: done.length,
        won,
        lost: done.length - won,
        remaining: remaining.length,
        groupId: group.id,
        groupName: group.name,
        nextOpponent: nextMatch
          ? {
              id: nextMatch.pairA.id === entityId ? nextMatch.pairB.id : nextMatch.pairA.id,
              label: nextMatch.pairA.id === entityId ? nextMatch.pairB.label : nextMatch.pairA.label,
              matchId: nextMatch.id,
            }
          : null,
      };
    }
    // type === "team"
    const groups = await fetchTeamGroups();
    const group = groups.find((g) => g.entries.some((e) => e.id === entityId));
    if (!group) throw new Error("NOT_FOUND: đội không nằm trong bảng nào");
    const matches = await fetchTeamMatchesByGroup(group.id);
    const mine = matches.filter(
      (m) => m.teamA.id === entityId || m.teamB.id === entityId,
    );
    const done = mine.filter((m) => m.status === "done" || m.status === "forfeit");
    const won = done.filter((m) => m.winner?.id === entityId).length;
    const remaining = mine.filter(
      (m) => m.status === "scheduled" || m.status === "live",
    );
    const nextMatch = remaining[0];
    return {
      played: done.length,
      won,
      lost: done.length - won,
      remaining: remaining.length,
      groupId: group.id,
      groupName: group.name,
      nextOpponent: nextMatch
        ? {
            id: nextMatch.teamA.id === entityId ? nextMatch.teamB.id : nextMatch.teamA.id,
            label:
              nextMatch.teamA.id === entityId
                ? nextMatch.teamB.name
                : nextMatch.teamA.name,
            matchId: nextMatch.id,
          }
        : null,
    };
  },
});
