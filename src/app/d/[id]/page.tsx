import { notFound } from "next/navigation";
import { PublicHeader } from "../../_public";
import { DoublesSchedule } from "../../admin/_components";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";

export const dynamic = "force-dynamic";

export default async function PublicDoublesGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, matches] = await Promise.all([
    fetchDoublesGroupById(id),
    fetchDoublesMatchesByGroup(id),
  ]);
  if (!group) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <PublicHeader title={group.name} subtitle="Nội dung Đôi · vòng bảng" backHref="/d" />
      <DoublesSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries.map((e) => e.label)}
        matches={matches}
        readOnly
      />
    </main>
  );
}
