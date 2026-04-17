import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamSchedule } from "../../../_components";
import { GroupRegenerateButton } from "../../../_group-regenerate-button";
import { fetchTeamGroupById } from "@/lib/db/groups";
import { fetchTeamMatchesByGroup } from "@/lib/db/matches";
import { fetchTeams } from "@/lib/db/teams";

export const dynamic = "force-dynamic";

export default async function TeamGroupDetailPage({
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
      <header className="sticky top-0 z-20 -mx-4 -mt-4 flex items-center gap-2 bg-background px-4 pb-3 pt-4">
        <Button
          nativeButton={false}
          render={<Link href="/admin/teams?tab=groups" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">Nội dung Đồng đội · vòng bảng</p>
        </div>
        <GroupRegenerateButton
          kind="teams"
          groupId={group.id}
          groupName={group.name}
        />
      </header>

      <TeamSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries.map((e) => e.label)}
        matches={matches}
        teamPlayersByTeamId={teamPlayersByTeamId}
      />
    </main>
  );
}
