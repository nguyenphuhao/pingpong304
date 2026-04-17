import { ContentHome } from "../_ContentHome";
import { fetchTeamGroups } from "@/lib/db/groups";
import { fetchTeamKo } from "@/lib/db/knockout";

export const dynamic = "force-dynamic";

export default async function TeamsPublicPage() {
  const [groups, knockout] = await Promise.all([
    fetchTeamGroups(),
    fetchTeamKo(),
  ]);
  return <ContentHome kind="teams" groups={groups} knockout={knockout} />;
}
