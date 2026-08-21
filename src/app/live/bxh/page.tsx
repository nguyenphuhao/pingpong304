import { GroupPills } from "../_GroupPills";
import { StandingsCards } from "./_StandingsCards";
import { groupColor } from "../../_groupColors";
import { fetchDoublesGroups } from "@/lib/db/groups";
import { fetchAllDoublesMatchesByGroup } from "@/lib/db/matches";
import { fetchAllGroupStandings } from "@/lib/db/standings";
import { isGroupComplete, shortGroupName } from "@/lib/live/format";
import { resolveGroup } from "@/lib/live/groups";
import { GROUP_STAGE } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function LiveStandingsPage({
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
        Chưa chia bảng. Bảng xếp hạng hiện ra khi BTC bốc thăm xong.
      </p>
    );
  }

  const [standings, matchesByGroup] = await Promise.all([
    fetchAllGroupStandings("doubles", groups),
    fetchAllDoublesMatchesByGroup(groups.map((g) => g.id)),
  ]);

  const progress = new Map(
    groups.map((g) => {
      const ms = matchesByGroup.get(g.id) ?? [];
      const done = ms.filter(
        (m) => m.status === "done" || m.status === "forfeit",
      ).length;
      return [g.id, `${done}/${ms.length}`];
    }),
  );

  const matches = matchesByGroup.get(active.id) ?? [];
  const complete = isGroupComplete(matches);
  const played = matches.filter(
    (m) => m.status === "done" || m.status === "forfeit",
  ).length;

  const c = groupColor(active.id);

  return (
    <>
      <GroupPills
        groups={groups}
        activeId={active.id}
        progress={progress}
        basePath="/live/bxh"
      />

      <section className={`rounded-2xl border p-3 ${c.border} ${c.bg}`}>
        <div className="flex items-center gap-2.5">
          <span
            className={`flex size-10 items-center justify-center rounded-xl text-[1.25rem] font-bold ${c.badge}`}
          >
            {shortGroupName(active.name)}
          </span>
          <h1 className="text-[1.3rem] font-bold tracking-tight">
            {active.name} · Xếp hạng
          </h1>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip>
            {played}/{matches.length} trận đã đấu
          </Chip>
          <Chip>
            {complete
              ? `${GROUP_STAGE.advancePerGroup} cặp đầu vào tứ kết`
              : "Chưa chốt thứ hạng"}
          </Chip>
        </div>
      </section>

      <StandingsCards
        group={active}
        rows={standings.get(active.id) ?? []}
        complete={complete}
        remaining={matches.length - played}
      />
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border bg-background/70 px-2.5 py-1 text-[0.72rem] font-semibold text-foreground/80">
      {children}
    </span>
  );
}
