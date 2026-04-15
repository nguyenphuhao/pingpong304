import {
  ROUND_LABEL,
  TEAM_MATCH_TEMPLATE,
  type KnockoutMatch,
  type SetScore,
} from "./admin/_mock";

const ROUND_ORDER: Array<KnockoutMatch["round"]> = ["qf", "sf", "f"];

const ROUND_STYLE: Record<
  KnockoutMatch["round"],
  { chip: string; border: string; bg: string; accent: string }
> = {
  qf: {
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    border: "border-sky-500/30",
    bg: "bg-sky-500/5",
    accent: "border-l-sky-500",
  },
  sf: {
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    accent: "border-l-amber-500",
  },
  f: {
    chip: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/10",
    accent: "border-l-yellow-500",
  },
};

function setsSummary(sets: SetScore[]) {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.a > s.b) a += 1;
    else if (s.b > s.a) b += 1;
  }
  return { a, b };
}

export function PublicKnockoutSection({
  kind,
  matches,
  note,
}: {
  kind: "doubles" | "teams";
  matches: KnockoutMatch[];
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {ROUND_ORDER.map((round) => {
        const list = matches.filter((m) => m.round === round);
        if (list.length === 0) return null;
        const s = ROUND_STYLE[round];
        return (
          <div key={round} className={`rounded-xl border p-3 ${s.border} ${s.bg}`}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${s.chip}`}>
                {ROUND_LABEL[round]}
              </span>
              <span className="text-sm text-muted-foreground">{list.length} trận</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((m, i) => (
                <PublicKOCard key={m.id} match={m} index={i + 1} kind={kind} />
              ))}
            </div>
          </div>
        );
      })}
      {note && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ {note}
        </p>
      )}
    </div>
  );
}

function PublicKOCard({
  match,
  index,
  kind,
}: {
  match: KnockoutMatch;
  index: number;
  kind: "doubles" | "teams";
}) {
  const isTeam = kind === "teams";
  const accent = ROUND_STYLE[match.round].accent;
  const nameA = match.entryA ?? match.labelA;
  const nameB = match.entryB ?? match.labelB;
  const placeholderA = !match.entryA;
  const placeholderB = !match.entryB;
  const done = match.status === "done";

  let scoreA = 0;
  let scoreB = 0;
  if (isTeam && match.individual) {
    for (const im of match.individual) {
      const { a, b } = setsSummary(im.sets);
      if (im.sets.length > 0) {
        if (a > b) scoreA += 1;
        else if (b > a) scoreB += 1;
      }
    }
  } else {
    const s = setsSummary(match.sets);
    scoreA = s.a;
    scoreB = s.b;
  }
  const aWon = done && scoreA > scoreB;
  const bWon = done && scoreB > scoreA;

  return (
    <div className={`rounded-lg border-l-4 border bg-card p-3 ${accent}`}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {ROUND_LABEL[match.round]} {index}
          </span>
          {match.table != null && <span>· Bàn {match.table}</span>}
          <span>· thắng {Math.ceil(match.bestOf / 2)}/{match.bestOf} ván</span>
        </div>
        {done ? (
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
            Đã xong
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Chưa đấu
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
          <div
            className={`truncate ${aWon ? "font-semibold" : ""} ${placeholderA ? "italic text-muted-foreground" : ""}`}
          >
            {nameA}
          </div>
          <div
            className={`truncate ${bWon ? "font-semibold" : ""} ${placeholderB ? "italic text-muted-foreground" : ""}`}
          >
            {nameB}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end text-xl font-semibold tabular-nums leading-tight">
          <span className={aWon ? "" : "text-muted-foreground"}>
            {done || scoreA + scoreB > 0 ? scoreA : "–"}
          </span>
          <span className={bWon ? "" : "text-muted-foreground"}>
            {done || scoreA + scoreB > 0 ? scoreB : "–"}
          </span>
        </div>
      </div>

      {isTeam && match.individual && (
        <ul className="mt-2 space-y-1.5 border-t pt-2">
          {match.individual.map((im, i) => {
            const lineup = TEAM_MATCH_TEMPLATE[i];
            const { a, b } = setsSummary(im.sets);
            const hasResult = im.sets.length > 0;
            const aWonSub = hasResult && a > b;
            const bWonSub = hasResult && b > a;
            const slotHint =
              lineup.kind === "single"
                ? `${lineup.slot} vs ${lineup.oppSlot}`
                : `${lineup.slots.join("+")} vs ${lineup.oppSlots.join("+")}`;
            return (
              <li key={im.id} className="rounded-md bg-muted/40 p-2">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{im.label}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{slotHint}</span>
                  </span>
                  <span>thắng {Math.ceil(im.bestOf / 2)}/{im.bestOf} ván</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className={`truncate ${aWonSub ? "font-semibold" : "text-muted-foreground"}`}>
                      {im.playerA === "—" ? <span className="italic">Chưa gán</span> : im.playerA}
                    </div>
                    <div className={`truncate ${bWonSub ? "font-semibold" : "text-muted-foreground"}`}>
                      {im.playerB === "—" ? <span className="italic">Chưa gán</span> : im.playerB}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end text-base font-semibold tabular-nums leading-tight">
                    <span className={aWonSub ? "" : "text-muted-foreground"}>{hasResult ? a : "–"}</span>
                    <span className={bWonSub ? "" : "text-muted-foreground"}>{hasResult ? b : "–"}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
