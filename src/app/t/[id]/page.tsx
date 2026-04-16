import { notFound } from "next/navigation";
import { PublicHeader } from "../../_public";
import { TeamSchedule } from "../../admin/_components";
import { MOCK_TEAM_MATCHES } from "../../admin/_mock";
import { fetchTeamGroupById } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function PublicTeamGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await fetchTeamGroupById(id);
  if (!group) notFound();
  const matches = MOCK_TEAM_MATCHES.filter((m) => m.groupId === id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <PublicHeader title={group.name} subtitle="Nội dung Đồng đội · vòng bảng" backHref="/t" />
      <TeamSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries.map((e) => e.label)}
        matches={matches}
        readOnly
      />
    </main>
  );
}
