"use client";

import Link from "next/link";
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
  const prefix = kind === "doubles" ? "/d" : "/t";

  // chunk groups into pairs for 2-column pages
  const pages: GroupResolved[][] = [];
  for (let i = 0; i < groups.length; i += 2) {
    pages.push(groups.slice(i, i + 2));
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Trophy className="size-4 text-yellow-500" />
        <h2 className="text-sm font-semibold">Bảng xếp hạng</h2>
      </div>

      <SwipeCarousel dotColor="bg-blue-500">
        {pages.map((page, pi) => (
          <div key={pi} className="grid grid-cols-2 gap-2">
            {page.map((g) => {
              const rows = standings.get(g.id) ?? [];
              const top2 = rows.slice(0, 2);
              const c = groupColor(g.id);
              const played = rows.some((r) => r.played > 0);
              return (
                <div key={g.id} className="rounded-lg bg-card p-2.5">
                  <div className={`mb-1.5 text-[10px] font-semibold ${c.badge} inline-block rounded px-1.5 py-0.5`}>
                    {g.name.replace(/^Bảng\s*/i, "")}
                  </div>
                  {!played ? (
                    <div className="text-xs italic text-muted-foreground">
                      Chưa có kết quả
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {top2.map((r, ri) => (
                        <div
                          key={r.entry}
                          className={`flex items-center justify-between text-[11px] ${
                            ri > 0 ? "text-muted-foreground" : ""
                          }`}
                        >
                          <span className="truncate">
                            <span
                              className={
                                ri === 0
                                  ? "text-yellow-500"
                                  : "text-muted-foreground"
                              }
                            >
                              {ri + 1}.
                            </span>{" "}
                            {r.entry}
                          </span>
                          <span className="ml-1 shrink-0 font-semibold">
                            {r.points}đ
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </SwipeCarousel>

      <Link
        href={prefix}
        className="mt-1.5 block text-center text-[11px] text-blue-500"
      >
        Xem chi tiết từng bảng →
      </Link>
    </section>
  );
}
