import { ContentHome } from "../_ContentHome";
import { fetchTeamGroups } from "@/lib/db/groups";
import { fetchTeamKo } from "@/lib/db/knockout";
import {
  fetchLiveTeams,
  fetchRecentTeams,
  fetchAllTeamMatchesByGroup,
} from "@/lib/db/matches";
import { fetchAllGroupStandings } from "@/lib/db/standings";

export const dynamic = "force-dynamic";

export default async function TeamsPublicPage() {
  const groups = await fetchTeamGroups();
  const groupIds = groups.map((g) => g.id);

  const [knockout, liveMatches, recentResults, standings, matchesByGroup] =
    await Promise.all([
      fetchTeamKo(),
      fetchLiveTeams(),
      fetchRecentTeams(10),
      fetchAllGroupStandings("teams", groups),
      fetchAllTeamMatchesByGroup(groupIds),
    ]);

  return (
    <ContentHome
      kind="teams"
      groups={groups}
      knockout={knockout}
      liveMatches={liveMatches}
      recentResults={recentResults}
      standings={standings}
      matchesByGroup={matchesByGroup}
    />
  );
}
