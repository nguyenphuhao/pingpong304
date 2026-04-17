import { notFound } from "next/navigation";
import { PublicHeader } from "../../_public";
import { GroupStageTabs } from "../../_publicGroup";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";
import { fetchGroupStandings } from "@/lib/db/standings";

export const dynamic = "force-dynamic";

export default async function PublicDoublesGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await fetchDoublesGroupById(id);
  if (!group) notFound();

  const entries = group.entries.map((e) => e.label);
  const [matches, standings] = await Promise.all([
    fetchDoublesMatchesByGroup(id),
    fetchGroupStandings("doubles", id, entries),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <PublicHeader title={group.name} subtitle="Nội dung Đôi · vòng bảng" backHref="/d" />
      <GroupStageTabs
        kind="doubles"
        groups={[group]}
        standings={new Map([[group.id, standings]])}
        matchesByGroup={new Map([[group.id, matches]])}
      />
    </main>
  );
}
