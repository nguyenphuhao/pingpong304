import { notFound } from "next/navigation";
import { PublicHeader } from "../../_public";
import { GroupStageTabs } from "../../_publicGroup";
import { fetchTeamGroupById } from "@/lib/db/groups";
import { fetchTeamMatchesByGroup } from "@/lib/db/matches";
import { fetchGroupStandings } from "@/lib/db/standings";

export const dynamic = "force-dynamic";

export default async function PublicTeamGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await fetchTeamGroupById(id);
  if (!group) notFound();

  const [matches, standings] = await Promise.all([
    fetchTeamMatchesByGroup(id),
    fetchGroupStandings("teams", id, group.entries),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <PublicHeader title={group.name} subtitle="Nội dung Đồng đội · vòng bảng" backHref="/t" />
      <GroupStageTabs
        kind="teams"
        groups={[group]}
        standings={new Map([[group.id, standings]])}
        matchesByGroup={new Map([[group.id, matches]])}
      />
    </main>
  );
}
