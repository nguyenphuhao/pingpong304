import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoublesSchedule } from "../../../_components";
import { MOCK_DOUBLES_GROUPS, MOCK_DOUBLES_MATCHES } from "../../../_mock";

export default async function DoublesGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = MOCK_DOUBLES_GROUPS.find((g) => g.id === id);
  if (!group) notFound();

  const matches = MOCK_DOUBLES_MATCHES.filter((m) => m.groupId === id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/admin/doubles" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">Nội dung Đôi · vòng bảng</p>
        </div>
      </header>

      <DoublesSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries}
        matches={matches}
      />
    </main>
  );
}
