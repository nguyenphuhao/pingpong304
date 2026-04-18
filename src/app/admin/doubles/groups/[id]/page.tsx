import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoublesSchedule } from "../../../_components";
import { GroupRegenerateButton } from "../../../_group-regenerate-button";
import { SearchIconButton } from "../../../_search-sheet";
import { fetchDoublesGroupById } from "@/lib/db/groups";
import { fetchDoublesMatchesByGroup } from "@/lib/db/matches";

export const dynamic = "force-dynamic";

export default async function DoublesGroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ match?: string }>;
}) {
  const [{ id }, { match: autoOpenMatchId }] = await Promise.all([
    params,
    searchParams,
  ]);
  const [group, matches] = await Promise.all([
    fetchDoublesGroupById(id),
    fetchDoublesMatchesByGroup(id),
  ]);
  if (!group) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="sticky top-0 z-20 -mx-4 -mt-4 flex items-center gap-2 bg-background px-4 pb-3 pt-4">
        <Button
          nativeButton={false}
          render={<Link href="/admin/doubles?tab=groups" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">Nội dung Đôi · vòng bảng</p>
        </div>
        <SearchIconButton kind="doubles" />
        <GroupRegenerateButton
          kind="doubles"
          groupId={group.id}
          groupName={group.name}
        />
      </header>

      <DoublesSchedule
        groupId={group.id}
        groupName={group.name}
        entries={group.entries}
        matches={matches}
        autoOpenMatchId={autoOpenMatchId}
      />
    </main>
  );
}
