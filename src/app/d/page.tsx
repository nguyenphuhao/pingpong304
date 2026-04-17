import { ContentHome } from "../_ContentHome";
import { fetchDoublesGroups } from "@/lib/db/groups";
import { fetchDoublesKo } from "@/lib/db/knockout";

export const dynamic = "force-dynamic";

export default async function DoublesPublicPage() {
  const [groups, knockout] = await Promise.all([
    fetchDoublesGroups(),
    fetchDoublesKo(),
  ]);
  return <ContentHome kind="doubles" groups={groups} knockout={knockout} />;
}
