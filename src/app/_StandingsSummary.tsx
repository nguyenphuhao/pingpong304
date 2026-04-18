"use client";

import { useState } from "react";
import { Loader2, Sparkles, Trophy } from "lucide-react";
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
              <div className="space-y-1">
                {rows.map((r) => (
                  <div
                    key={r.entryId}
                    className="rounded-lg bg-background/60 px-2.5 py-2 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          played && r.rank === 1
                            ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                            : played && r.rank === 2
                              ? "bg-gray-300/30 text-gray-500 dark:text-gray-400"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.rank}
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
              <ExplainButton
                rows={rows}
                kind={kind === "doubles" ? "doubles" : "team"}
                disabled={!played}
              />
            </div>
          );
        })}
      </SwipeCarousel>
    </section>
  );
}

// ── AI Explain Button ──

function inlineFmt(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let inList: "ul" | "ol" | null = null;

  const flush = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { flush(); continue; }

    const hMatch = /^(#{1,3}) (.+)/.exec(line);
    if (hMatch) { flush(); html.push(`<h${hMatch[1].length}>${inlineFmt(hMatch[2])}</h${hMatch[1].length}>`); continue; }

    const bulletMatch = /^[-*•] (.+)/.exec(line);
    if (bulletMatch) {
      if (inList !== "ul") { flush(); html.push("<ul>"); inList = "ul"; }
      html.push(`<li>${inlineFmt(bulletMatch[1])}</li>`);
      continue;
    }

    const numMatch = /^\d+[.)]\s*(.+)/.exec(line);
    if (numMatch) {
      if (inList !== "ol") { flush(); html.push("<ol>"); inList = "ol"; }
      html.push(`<li>${inlineFmt(numMatch[1])}</li>`);
      continue;
    }

    flush();
    html.push(`<p>${inlineFmt(line)}</p>`);
  }
  flush();
  return html.join("");
}

function ExplainButton({
  rows,
  kind,
  disabled = false,
}: {
  rows: StandingRow[];
  kind: "doubles" | "team";
  disabled?: boolean;
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const explain = async () => {
    if (disabled) {
      setExplanation("Chưa có kết quả thi đấu nào. Khi các trận đấu được cập nhật, AI sẽ phân tích bảng xếp hạng cho bạn.");
      setOpen(true);
      return;
    }
    if (explanation) { setOpen(true); return; }
    setLoading(true);
    setOpen(true);
    try {
      const apiRows = rows.map((r) => ({
        entry: r.entry,
        played: r.played,
        won: r.won,
        lost: r.lost,
        diff: r.diff,
        setsWon: r.setsWon,
        setsLost: r.setsLost,
        points: r.points,
        rank: r.rank,
      }));
      const res = await fetch("/api/ai/explain-standings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: apiRows, kind }),
      });
      const json = await res.json();
      if (json.data) {
        setExplanation(json.data);
      }
    } catch {
      setExplanation("Không thể kết nối AI. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={explain}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background/80"
      >
        <Sparkles className="size-3.5" />
        AI phân tích xếp hạng
      </button>
      {open && (
        <div className="mt-2 rounded-lg border bg-background p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Sparkles className="size-3.5 text-yellow-500" />
              Phân tích AI
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Đóng
            </button>
          </div>
          {loading && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang phân tích...
            </div>
          )}
          {explanation && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(explanation) }}
            />
          )}
        </div>
      )}
    </>
  );
}
