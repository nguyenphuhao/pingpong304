import { tool } from "ai";
import { z } from "zod";
import {
  fetchDoublesMatchesByGroup,
  fetchTeamMatchesByGroup,
} from "@/lib/db/matches";
import { fetchDoublesGroups, fetchTeamGroups } from "@/lib/db/groups";
import { matchTimeAt } from "@/lib/live/format";
import { GROUP_STAGE } from "@/lib/tournament";
import { resolveGroup } from "./resolve-group";

export const getUpcomingMatchesTool = tool({
  description:
    "Lấy danh sách trận sắp tới, kèm số thứ tự trận trong bảng, GIỜ DỰ KIẾN và SỐ BÀN. " +
    "Dùng tool này cho mọi câu hỏi về lịch: trận mấy giờ, đánh bàn nào, khi nào tới lượt. " +
    "Có thể lọc theo bảng (groupId — chấp nhận id 'gA' hoặc tên 'Bảng A'/'A') hoặc theo cặp/đội (entityId). Mặc định limit=5.",
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
      // Giữ chỉ số trong bảng TRƯỚC khi gộp các bảng: giờ dự kiến suy từ chỉ số
      // đó, gộp xong mới đánh số là ra giờ của bảng khác.
      const perGroup = await Promise.all(
        groups.map((g) => fetchDoublesMatchesByGroup(g.id)),
      );
      const allMatches = perGroup.flatMap((ms) =>
        ms.map((m, i) => ({ match: m, no: i + 1 })),
      );
      const filtered = allMatches
        .filter(
          ({ match: m }) => m.status === "scheduled" || m.status === "live",
        )
        .filter(
          ({ match: m }) =>
            !entityId || m.pairA.id === entityId || m.pairB.id === entityId,
        )
        .slice(0, limit);
      return {
        matches: filtered.map(({ match: m, no }) => ({
          id: m.id,
          groupId: m.groupId,
          no,
          table: m.table,
          // Giờ không nằm trong DB — suy như màn /live để hai nơi nói cùng một giờ.
          estimatedTime: matchTimeAt(
            GROUP_STAGE.startTime,
            GROUP_STAGE.slotMinutes,
            no - 1,
          ),
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
