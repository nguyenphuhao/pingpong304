import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamSchedule } from "../../../_components";
import { MOCK_TEAM_GROUPS, MOCK_TEAM_MATCHES } from "../../../_mock";

export default async function TeamGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = MOCK_TEAM_GROUPS.find((g) => g.id === id);
  if (!group) notFound();

  const matches = MOCK_TEAM_MATCHES.filter((m) => m.groupId === id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/admin/teams" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">Nội dung Đồng đội · vòng bảng</p>
        </div>
      </header>

      <TeamSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries}
        matches={matches}
      />
    </main>
  );
}
