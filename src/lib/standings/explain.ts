import { computeDoublesStandings } from "./compute";
import { doublesMetric, findH2H, miniLeagueTable } from "./tiebreaker";
import type { EntryInfo, StandingRow } from "./types";
import type { MatchResolved } from "@/lib/schemas/match";

/** Tiêu chí đã dùng để tách một nhóm bằng số trận thắng. */
export type TieMethod = "h2h" | "mini" | "diff" | "setsWon" | "unresolved";

export type TieNote = {
  /** Số trận thắng chung của cả nhóm. */
  won: number;
  /** Mã các cặp trong nhóm, theo đúng thứ tự bảng xếp hạng. */
  entries: string[];
  method: TieMethod;
  /** Câu tiếng Việt đã có sẵn số liệu thật — tầng AI chỉ diễn đạt lại. */
  text: string;
};

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} và ${xs[xs.length - 1]}`;

/**
 * Vì sao mỗi nhóm bằng số trận thắng lại xếp theo thứ tự đó.
 *
 * Tồn tại vì tầng AI trước đây chỉ nhận bảng xếp hạng cuối cùng rồi tự suy ra lý
 * do — nó bịa "hiệu số cao hơn nên xếp trên" cho cặp có hiệu số THẤP hơn, và làm
 * sai cả phép so sánh số. Lý do phải tính bằng code; AI chỉ được diễn đạt lại.
 *
 * Dùng chung findH2H() và miniLeagueTable() với tầng xếp hạng, nên không thể
 * nói khác điều hệ thống thực sự làm.
 */
export function explainDoublesRanking(
  entries: EntryInfo[],
  matches: MatchResolved[],
): TieNote[] {
  const rows = computeDoublesStandings(entries, matches);
  const done = matches.filter(
    (m) => m.status === "done" || m.status === "forfeit",
  );

  // Nhóm theo số trận thắng, chỉ xét cặp đã đá — giống hệt tầng xếp hạng.
  const groups: StandingRow[][] = [];
  for (const row of rows.filter((r) => r.played > 0)) {
    const last = groups[groups.length - 1];
    if (last && last[0].won === row.won) last.push(row);
    else groups.push([row]);
  }

  const notes: TieNote[] = [];
  for (const g of groups) {
    if (g.length < 2) continue;
    notes.push(g.length === 2 ? explainPair(g, done) : explainMany(g, done));
  }
  return notes;
}

function explainPair(g: StandingRow[], done: MatchResolved[]): TieNote {
  const [first, second] = g;
  const base = {
    won: first.won,
    entries: [first.entryId, second.entryId],
  };

  const h2h = findH2H(first.entryId, second.entryId, done, doublesMetric);
  if (h2h) {
    const winner = h2h === first.entryId ? first : second;
    const loser = h2h === first.entryId ? second : first;
    const nghich =
      winner.diff < loser.diff
        ? ` Lưu ý: ${winner.entry} có hiệu số toàn bảng ${sign(winner.diff)}, THẤP hơn ${loser.entry} (${sign(loser.diff)}), nhưng đối đầu vẫn quyết định.`
        : "";
    return {
      ...base,
      method: "h2h",
      text:
        `${first.entry} và ${second.entry} cùng ${first.won} trận thắng. ` +
        `Phân định bằng ĐỐI ĐẦU TRỰC TIẾP: ${winner.entry} thắng trận gặp ${loser.entry} nên xếp trên.${nghich}`,
    };
  }

  if (first.diff !== second.diff) {
    return {
      ...base,
      method: "diff",
      text:
        `${first.entry} và ${second.entry} cùng ${first.won} trận thắng, chưa có kết quả trận đối đầu. ` +
        `Phân định bằng hiệu số ván toàn bảng: ${first.entry} ${sign(first.diff)} so với ${second.entry} ${sign(second.diff)}.`,
    };
  }

  if (first.setsWon !== second.setsWon) {
    return {
      ...base,
      method: "setsWon",
      text:
        `${first.entry} và ${second.entry} bằng nhau cả trận thắng lẫn hiệu số. ` +
        `Phân định bằng tổng ván thắng: ${first.setsWon} so với ${second.setsWon}.`,
    };
  }

  return {
    ...base,
    method: "unresolved",
    text:
      `${first.entry} và ${second.entry} bằng nhau ở mọi tiêu chí. ` +
      `Hệ thống để đồng hạng và không tự chọn — BTC quyết bằng bốc thăm.`,
  };
}

function explainMany(g: StandingRow[], done: MatchResolved[]): TieNote {
  const ids = g.map((r) => r.entryId);
  const idSet = new Set(ids);
  const among = done.filter(
    (m) => idSet.has(m.pairA.id) && idSet.has(m.pairB.id),
  );
  const mini = miniLeagueTable(ids, among, doublesMetric);

  const base = { won: g[0].won, entries: ids };
  const soLieu = g
    .map((r) => {
      const s = mini.get(r.entryId)!;
      return `${r.entry} (${s.won} thắng, hiệu số ${sign(s.diff)}, ${s.setsWon} ván thắng)`;
    })
    .join("; ");

  // Cả nhóm giống hệt nhau trong bảng con → hệ thống bỏ tay
  const first = mini.get(ids[0])!;
  const dongLoat = ids.every((id) => {
    const s = mini.get(id)!;
    return s.won === first.won && s.diff === first.diff && s.setsWon === first.setsWon;
  });

  if (dongLoat) {
    return {
      ...base,
      method: "unresolved",
      text:
        `${list(g.map((r) => r.entry))} cùng ${g[0].won} trận thắng và bằng nhau ở CẢ bảng con — ` +
        `${soLieu}. Hệ thống để đồng hạng và không tự chọn ai đi tiếp; BTC quyết bằng bốc thăm.`,
    };
  }

  return {
    ...base,
    method: "mini",
    text:
      `${list(g.map((r) => r.entry))} cùng ${g[0].won} trận thắng. Từ 3 cặp trở lên thì KHÔNG dùng đối đầu ` +
      `mà lập BẢNG CON, chỉ tính ${among.length} trận giữa họ với nhau. Kết quả bảng con: ${soLieu}. ` +
      `Thứ tự trên bảng xếp hạng lấy theo bảng con này, không phải theo hiệu số toàn bảng.`,
  };
}
