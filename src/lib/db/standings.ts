import {
  computeDoublesStandings,
  computeTeamStandings,
} from "@/lib/standings/compute";
import type { StandingRow, EntryInfo } from "@/lib/standings/types";
import type { GroupResolved } from "@/lib/schemas/group";
import { fetchDoublesMatchesByGroup, fetchTeamMatchesByGroup } from "./matches";

export type { StandingRow } from "@/lib/standings/types";

export async function fetchGroupStandings(
  kind: "doubles" | "teams",
  groupId: string,
  entries: EntryInfo[],
): Promise<StandingRow[]> {
  if (kind === "doubles") {
    const matches = await fetchDoublesMatchesByGroup(groupId);
    return computeDoublesStandings(entries, matches);
  }
  const matches = await fetchTeamMatchesByGroup(groupId);
  return computeTeamStandings(entries, matches);
}

export async function fetchAllGroupStandings(
  kind: "doubles" | "teams",
  groups: GroupResolved[],
): Promise<Map<string, StandingRow[]>> {
  const results = await Promise.all(
    groups.map(async (g) => {
      const standings = await fetchGroupStandings(kind, g.id, g.entries);
      return [g.id, standings] as const;
    }),
  );
  return new Map(results);
}
