"use client";

import { Trophy } from "lucide-react";
import { SwipeCarousel } from "./_SwipeCarousel";
import { groupColor } from "./_groupColors";
import type { StandingRow } from "@/lib/db/standings";
import type { GroupResolved } from "@/lib/schemas/group";

export function StandingsSummary({
  kind,
  groups,
  standings,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  standings: Map<string, StandingRow[]>;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Trophy className="size-4 text-yellow-500" />
        <h2 className="text-base font-semibold">Bảng xếp hạng</h2>
      </div>

      <SwipeCarousel dotColor="bg-blue-500">
        {groups.map((g) => {
          const rows = standings.get(g.id) ?? [];
          const c = groupColor(g.id);
          const played = rows.some((r) => r.played > 0);
          return (
            <div key={g.id} className={`rounded-xl border p-3 ${c.border} ${c.bg}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`flex size-7 items-center justify-center rounded-md text-sm font-semibold ${c.badge}`}>
                  {g.name.replace(/^Bảng\s*/i, "")}
                </span>
                <span className="font-semibold">{g.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {g.entries.length} {kind === "doubles" ? "cặp" : "đội"}
                </span>
              </div>
              {!played ? (
                <div className="py-2 text-sm italic text-muted-foreground">
                  Chưa có kết quả
                </div>
              ) : (
                <div className="space-y-1">
                  {rows.map((r, ri) => (
                    <div
                      key={r.entry}
                      className="rounded-lg bg-background/60 px-2.5 py-2 text-sm"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            ri === 0
                              ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                              : ri === 1
                                ? "bg-gray-300/30 text-gray-500 dark:text-gray-400"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {ri + 1}
                        </span>
                        <span className="min-w-0 flex-1 leading-snug">{r.entry}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 pl-7 text-xs tabular-nums text-muted-foreground">
                        <span>{r.won}T {r.lost}B</span>
                        <span className={
                          r.diff > 0
                            ? "text-green-600 dark:text-green-400"
                            : r.diff < 0
                              ? "text-red-600 dark:text-red-400"
                              : ""
                        }>
                          HS {r.diff > 0 ? `+${r.diff}` : r.diff}
                        </span>
                        <span className="ml-auto font-semibold text-foreground">
                          {r.points}đ
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </SwipeCarousel>
    </section>
  );
}
