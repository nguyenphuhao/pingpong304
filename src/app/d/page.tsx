import { ContentHome } from "../_ContentHome";
import { fetchDoublesGroups } from "@/lib/db/groups";
import { fetchDoublesKo } from "@/lib/db/knockout";
import {
  fetchLiveDoubles,
  fetchRecentDoubles,
  fetchAllDoublesMatchesByGroup,
} from "@/lib/db/matches";
import { fetchAllGroupStandings } from "@/lib/db/standings";

export const dynamic = "force-dynamic";

export default async function DoublesPublicPage() {
  const groups = await fetchDoublesGroups();
  const groupIds = groups.map((g) => g.id);

  const [knockout, liveMatches, recentResults, standings, matchesByGroup] =
    await Promise.all([
      fetchDoublesKo(),
      fetchLiveDoubles(),
      fetchRecentDoubles(10),
      fetchAllGroupStandings("doubles", groups),
      fetchAllDoublesMatchesByGroup(groupIds),
    ]);

  return (
    <ContentHome
      kind="doubles"
      groups={groups}
      knockout={knockout}
      liveMatches={liveMatches}
      recentResults={recentResults}
      standings={standings}
      matchesByGroup={matchesByGroup}
    />
  );
}
