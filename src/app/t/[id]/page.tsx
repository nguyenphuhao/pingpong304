import { notFound } from "next/navigation";
import { PublicHeader } from "../../_public";
import { TeamSchedule } from "../../admin/_components";
import { fetchTeamGroupById } from "@/lib/db/groups";
import { fetchTeamMatchesByGroup } from "@/lib/db/matches";
import { fetchTeams } from "@/lib/db/teams";

export const dynamic = "force-dynamic";

export default async function PublicTeamGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, matches, allTeams] = await Promise.all([
    fetchTeamGroupById(id),
    fetchTeamMatchesByGroup(id),
    fetchTeams(),
  ]);
  if (!group) notFound();
  const teamPlayersByTeamId: Record<string, Array<{ id: string; name: string }>> = {};
  for (const t of allTeams) teamPlayersByTeamId[t.id] = t.members;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <PublicHeader title={group.name} subtitle="Nội dung Đồng đội · vòng bảng" backHref="/t" />
      <TeamSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries}
        matches={matches}
        teamPlayersByTeamId={teamPlayersByTeamId}
        readOnly
      />
    </main>
  );
}
