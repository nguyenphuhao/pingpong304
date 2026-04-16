import { notFound } from "next/navigation";
import { PublicHeader } from "../../_public";
import { DoublesSchedule } from "../../admin/_components";
import { MOCK_DOUBLES_MATCHES } from "../../admin/_mock";
import { fetchDoublesGroupById } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export default async function PublicDoublesGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await fetchDoublesGroupById(id);
  if (!group) notFound();
  const matches = MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === id);

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
