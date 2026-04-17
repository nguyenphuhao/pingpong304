import { groupColor } from "./_groupColors";
import type { SetScore } from "@/lib/schemas/match";

type MatchCardProps = {
  variant: "live" | "done";
  groupId: string;
  groupName: string;
  table: number | null;
  sideA: string;
  sideB: string;
  scoreA: number;
  scoreB: number;
  sets: SetScore[];
};

export function MatchCard({
  variant,
  groupId,
  groupName,
  table,
  sideA,
  sideB,
  scoreA,
  scoreB,
  sets,
}: MatchCardProps) {
  const isLive = variant === "live";
  const aWon = scoreA > scoreB;
  const bWon = scoreB > scoreA;
  const c = groupColor(groupId);

  return (
    <div
      className={`rounded-xl border p-3 ${
        isLive
          ? "border-green-500/25 bg-green-950"
          : "border-border bg-card"
      }`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        {isLive && (
          <span className="relative mr-1 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
        )}
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.badge}`}>
          {groupName.replace(/^Bảng\s*/i, "")}
        </span>
        {isLive ? (
          <span className="text-[10px] font-medium text-green-400">LIVE</span>
        ) : (
          <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
            Đã xong
          </span>
        )}
        {table != null && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            Bàn {table}
          </span>
        )}
      </div>

      {/* Names + Scores */}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div className={`truncate ${aWon ? "font-semibold" : ""}`}>{sideA}</div>
          <div className={`truncate ${bWon ? "font-semibold" : "text-muted-foreground"}`}>
            {sideB}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-lg font-bold tabular-nums leading-tight">
          <span className={aWon ? (isLive ? "text-green-400" : "") : "text-muted-foreground"}>
            {scoreA}
          </span>
          <span className={bWon ? (isLive ? "text-green-400" : "") : "text-muted-foreground"}>
            {scoreB}
          </span>
        </div>
      </div>

      {/* Set scores */}
      {sets.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sets.map((s, i) => (
            <span
              key={i}
              className={`inline-flex min-w-[36px] items-center justify-center rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                isLive ? "bg-green-900/50" : "bg-muted"
              }`}
            >
              {s.a}-{s.b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
