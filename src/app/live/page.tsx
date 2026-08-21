import { GroupSwitcher } from "./_GroupSwitcher";
import { GroupSchedule } from "./_GroupSchedule";
import { GroupScheduleSkeleton } from "./_Skeletons";
import { fetchDoublesGroups } from "@/lib/db/groups";
import { fetchAllDoublesMatchesByGroup } from "@/lib/db/matches";
import { resolveGroup } from "@/lib/live/groups";

export const dynamic = "force-dynamic";

export default async function LiveGroupStagePage({
  searchParams,
}: {
  searchParams: Promise<{ bang?: string }>;
}) {
  const [{ bang }, groups] = await Promise.all([
    searchParams,
    fetchDoublesGroups(),
  ]);

  const active = resolveGroup(groups, bang);
  if (!active) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
        Chưa chia bảng. Lịch thi đấu sẽ hiện ở đây khi BTC bốc thăm xong.
      </p>
    );
  }

  const matchesByGroup = await fetchAllDoublesMatchesByGroup(
    groups.map((g) => g.id),
  );

  // Tiến độ của cả bốn bảng để hiện ngay trên pill — thấy bảng nào tới đâu mà
  // không phải bấm vào từng bảng.
  const progress = new Map(
    groups.map((g) => {
      const ms = matchesByGroup.get(g.id) ?? [];
      const done = ms.filter(
        (m) => m.status === "done" || m.status === "forfeit",
      ).length;
      return [g.id, `${done}/${ms.length}`];
    }),
  );

  return (
    <>
      <GroupSwitcher
        groups={groups}
        activeId={active.id}
        progress={progress}
        basePath="/live"
        skeleton={
          <GroupScheduleSkeleton
            matches={matchesByGroup.get(active.id)?.length ?? 10}
          />
        }
      >
        <GroupSchedule group={active} matches={matchesByGroup.get(active.id) ?? []} />
      </GroupSwitcher>
    </>
  );
}
