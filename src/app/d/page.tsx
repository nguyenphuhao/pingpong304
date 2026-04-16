import { ContentHome } from "../_ContentHome";
import { fetchDoublesGroups } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function DoublesPublicPage() {
  const groups = await fetchDoublesGroups();
  return <ContentHome kind="doubles" groups={groups} />;
}
