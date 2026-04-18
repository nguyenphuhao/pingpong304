import { normalizeVi } from "@/lib/text/normalize";

export type MatchKind = "doubles" | "teams";

export type MatchIndexItem = {
  id: string;
  kind: MatchKind;
  groupId: string;
  groupName: string;
  sideA: string;
  sideB: string;
  status: "scheduled" | "live" | "done" | "forfeit";
};

const STATUS_RANK: Record<MatchIndexItem["status"], number> = {
  live: 0,
  scheduled: 1,
  done: 2,
  forfeit: 3,
};

export function filterAndSortMatches(
  items: MatchIndexItem[],
  query: string,
): MatchIndexItem[] {
  const q = normalizeVi(query);
  const filtered =
    q === ""
      ? items.filter((m) => m.status === "live")
      : items.filter(
          (m) =>
            normalizeVi(m.sideA).includes(q) ||
            normalizeVi(m.sideB).includes(q),
        );

  return [...filtered].sort((a, b) => {
    const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (s !== 0) return s;
    return a.groupName.localeCompare(b.groupName, "vi");
  });
}
