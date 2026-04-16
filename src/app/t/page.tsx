import { ContentHome } from "../_ContentHome";
import { fetchTeamGroups } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function TeamsPublicPage() {
  const groups = await fetchTeamGroups();
  return <ContentHome kind="teams" groups={groups} />;
}
