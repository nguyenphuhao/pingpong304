export type Content = "doubles" | "teams";

export type Player = {
  id: string;
  name: string;
  phone: string;
  gender: "M" | "F";
  club: string;
};

export type Pair = { id: string; p1: string; p2: string };
export type Team = { id: string; name: string; members: string[] };
export type Group = { id: string; name: string; entries: string[] };

/* ============================================================
 * NỘI DUNG ĐÔI – data chính thức (18 cặp · 4 bảng)
 * ============================================================ */

// Thứ tự bốc thăm chính thức (STT 1–18). `group` đã được phân theo bảng A/B/C/D.
const PAIR_LIST = [
  { id: "p01", group: "gA", p1: "Minh Quân", p2: "Tân Sinh" },
  { id: "p02", group: "gC", p1: "Quang Vinh", p2: "Minh Tiên" },
  { id: "p03", group: "gB", p1: "Phú Hảo", p2: "Thanh Cảnh" },
  { id: "p04", group: "gA", p1: "Hoài Nam (nhỏ)", p2: "Phi Hùng" },
  { id: "p05", group: "gB", p1: "Đức Lợi", p2: "Bát Sỹ" },
  { id: "p06", group: "gD", p1: "Bá Sơn (Per)", p2: "Hồng Nam (lớn)" },
  { id: "p07", group: "gD", p1: "Mr.Giang", p2: "Minh Chung" },
  { id: "p08", group: "gB", p1: "Anh Cường (Anti)", p2: "Thanh Sơn (Star)" },
  { id: "p09", group: "gB", p1: "Thọ Dân", p2: "Văn Trọng" },
  { id: "p10", group: "gB", p1: "Minh Hoàng", p2: "Thanh Khoa (Per)" },
  { id: "p11", group: "gC", p1: "Ngọc Quang", p2: "Văn Liêu" },
  { id: "p12", group: "gA", p1: "Trọng Nga", p2: "Văn Bạch" },
  { id: "p13", group: "gA", p1: "Hoài Thiệu", p2: "Kim Quy" },
  { id: "p14", group: "gC", p1: "Văn Hưởng", p2: "Thành Nhân" },
  { id: "p15", group: "gC", p1: "Mr.Jon", p2: "Park Chio" },
  { id: "p16", group: "gD", p1: "Phú Cường", p2: "Nguyệt Oanh" },
  { id: "p17", group: "gD", p1: "Văn Dương (Per)", p2: "Ngọc Phương (Per)" },
  { id: "p18", group: "gD", p1: "Văn Hạnh (Per)", p2: "Hlim (Per)" },
];

const pairLabel = (p: { p1: string; p2: string }) => `${p.p1} – ${p.p2}`;

export const MOCK_PAIRS: Pair[] = PAIR_LIST.map(({ id, p1, p2 }) => ({ id, p1, p2 }));

function clubOfDoublesPlayer(name: string): string {
  if (name.endsWith("(Star)")) return "Starlight";
  if (name.endsWith("(Per)")) return "Peridot";
  return "CLB Bình Tân";
}

const FEMALE_PLAYERS = new Set(["Ngọc Phương (Per)", "Nguyệt Oanh"]);

export const MOCK_DOUBLES_PLAYERS: Player[] = (() => {
  const out: Player[] = [];
  let idx = 1;
  for (const pair of PAIR_LIST) {
    for (const name of [pair.p1, pair.p2]) {
      out.push({
        id: `d${String(idx).padStart(2, "0")}`,
        name,
        phone: "—",
        gender: FEMALE_PLAYERS.has(name) ? "F" : "M",
        club: clubOfDoublesPlayer(name),
      });
      idx += 1;
    }
  }
  return out;
})();

export const MOCK_DOUBLES_GROUPS: Group[] = (() => {
  const groups = [
    { id: "gA", name: "Bảng A" },
    { id: "gB", name: "Bảng B" },
    { id: "gC", name: "Bảng C" },
    { id: "gD", name: "Bảng D" },
  ];
  return groups.map((g) => ({
    ...g,
    entries: PAIR_LIST.filter((p) => p.group === g.id).map(pairLabel),
  }));
})();

/* ============================================================
 * NỘI DUNG ĐỒNG ĐỘI – data chính thức (8 đội · 2 bảng · 3 VĐV/đội)
 * ============================================================ */

const TEAM_LIST = [
  // Bảng A
  { id: "tA1", group: "gtA", name: "Bình Tân 1", members: ["Quốc", "Quy", "Liêu"] },
  { id: "tA2", group: "gtA", name: "Bình Tân 2", members: ["Hảo", "Hưởng", "Vinh"] },
  { id: "tA3", group: "gtA", name: "Peridot 2", members: ["Phương", "Quân", "Dương"] },
  { id: "tA4", group: "gtA", name: "Mizuki 2", members: ["Sáng", "Sơn", "Thông"] },
  // Bảng B
  { id: "tB1", group: "gtB", name: "Peridot 1", members: ["Mỹ", "Minh", "Lưu"] },
  { id: "tB2", group: "gtB", name: "Bình Tân 3", members: ["Quân", "Phương", "Cường"] },
  { id: "tB3", group: "gtB", name: "Mizuki 1", members: ["Nghiệp", "Kiên", "Hòa"] },
  { id: "tB4", group: "gtB", name: "City Gates", members: ["Điền", "Đạt", "Trung"] },
];

export const MOCK_TEAMS: Team[] = TEAM_LIST.map(({ id, name, members }) => ({
  id,
  name,
  members,
}));

function clubFromTeamName(teamName: string): string {
  const base = teamName.replace(/\s+\d+$/, "");
  return base === "Bình Tân" ? "CLB Bình Tân" : base;
}

export const MOCK_TEAM_PLAYERS: Player[] = (() => {
  const out: Player[] = [];
  let idx = 1;
  for (const team of TEAM_LIST) {
    for (const name of team.members) {
      out.push({
        id: `t${String(idx).padStart(2, "0")}`,
        name,
        phone: "—",
        gender: "M",
        club: clubFromTeamName(team.name),
      });
      idx += 1;
    }
  }
  return out;
})();

export const MOCK_TEAM_GROUPS: Group[] = (() => {
  const groups = [
    { id: "gtA", name: "Bảng A" },
    { id: "gtB", name: "Bảng B" },
  ];
  return groups.map((g) => ({
    ...g,
    entries: TEAM_LIST.filter((t) => t.group === g.id).map((t) => t.name),
  }));
})();

/* ============================================================
 * Matches
 * ============================================================ */

export type SetScore = { a: number; b: number };
export type MatchStatus = "scheduled" | "done";

export type DoublesMatch = {
  id: string;
  groupId: string;
  pairA: string;
  pairB: string;
  table?: number;
  bestOf: 3 | 5;
  sets: SetScore[];
  status: MatchStatus;
};

export type IndividualMatch = {
  id: string;
  label: string;
  playerA: string;
  playerB: string;
  bestOf: 3 | 5;
  sets: SetScore[];
};

/** Template 3 lượt cố định cho mỗi trận đồng đội: Đôi B+C vs Y+Z, Đơn A vs X, Đơn C vs Z. */
export type TeamSlot = "A" | "B" | "C";
export type OppSlot = "X" | "Y" | "Z";

export type TeamLineup =
  | { kind: "single"; label: string; slot: TeamSlot; oppSlot: OppSlot }
  | { kind: "doubles"; label: string; slots: [TeamSlot, TeamSlot]; oppSlots: [OppSlot, OppSlot] };

export const TEAM_MATCH_TEMPLATE: TeamLineup[] = [
  { kind: "doubles", label: "Đôi", slots: ["B", "C"], oppSlots: ["Y", "Z"] },
  { kind: "single", label: "Đơn 1", slot: "A", oppSlot: "X" },
  { kind: "single", label: "Đơn 2", slot: "C", oppSlot: "Z" },
];

export type KnockoutRound = "qf" | "sf" | "f";

export const ROUND_LABEL: Record<KnockoutRound, string> = {
  qf: "Tứ kết",
  sf: "Bán kết",
  f: "Chung kết",
};

export type KnockoutMatch = {
  id: string;
  round: KnockoutRound;
  bestOf: 3 | 5;
  table?: number;
  /** Placeholder name shown khi chưa biết người vào (vd "Nhất bảng A"). */
  labelA: string;
  labelB: string;
  /** Tên thật khi đã xác định. */
  entryA?: string;
  entryB?: string;
  sets: SetScore[];
  status: MatchStatus;
  /** Đồng đội: 3 lượt cá nhân (đơn 1 / đơn 2 / đôi). Đôi: bỏ qua. */
  individual?: IndividualMatch[];
};

export type TeamMatch = {
  id: string;
  groupId: string;
  teamA: string;
  teamB: string;
  table?: number;
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  individual: IndividualMatch[];
};

/** Sắp xen kẽ để cùng 1 cặp/đội không đấu 2 trận liên tiếp (greedy). */
function reorderRoundRobin<T extends { a: string; b: string }>(matches: T[]): T[] {
  const remaining = [...matches];
  const out: T[] = [];
  let prev: T | null = null;
  while (remaining.length > 0) {
    const p = prev;
    let idx: number = p
      ? remaining.findIndex(
          (m) => m.a !== p.a && m.a !== p.b && m.b !== p.a && m.b !== p.b
        )
      : 0;
    if (idx === -1) idx = 0;
    const picked: T = remaining.splice(idx, 1)[0];
    out.push(picked);
    prev = picked;
  }
  return out;
}

/** Round-robin: mỗi cặp trong bảng gặp nhau 1 lần. Tất cả thắng 2/3 ván, status scheduled. */
export const MOCK_DOUBLES_MATCHES: DoublesMatch[] = (() => {
  const out: DoublesMatch[] = [];
  let n = 0;
  for (const group of MOCK_DOUBLES_GROUPS) {
    const pairs = PAIR_LIST.filter((p) => p.group === group.id);
    const pairings: Array<{ a: string; b: string }> = [];
    for (let i = 0; i < pairs.length; i += 1) {
      for (let j = i + 1; j < pairs.length; j += 1) {
        pairings.push({ a: pairLabel(pairs[i]), b: pairLabel(pairs[j]) });
      }
    }
    for (const m of reorderRoundRobin(pairings)) {
      n += 1;
      out.push({
        id: `dm${String(n).padStart(2, "0")}`,
        groupId: group.id,
        pairA: m.a,
        pairB: m.b,
        bestOf: 3,
        sets: [],
        status: "scheduled",
      });
    }
  }
  return out;
})();

/** Vòng tròn: trong mỗi bảng các đội gặp nhau 1 lần.
 *  Mỗi trận đồng đội gồm 3 lượt: 2 đơn + 1 đôi, mỗi lượt thắng 2/3 ván.
 *  Sắp xen kẽ để 1 đội không đấu 2 trận liên tiếp. */
export const MOCK_TEAM_MATCHES: TeamMatch[] = (() => {
  const out: TeamMatch[] = [];
  let n = 0;
  type T = (typeof TEAM_LIST)[number];
  for (const group of MOCK_TEAM_GROUPS) {
    const teams = TEAM_LIST.filter((t) => t.group === group.id);
    const pairings: Array<{ a: string; b: string; A: T; B: T }> = [];
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        pairings.push({
          a: teams[i].name,
          b: teams[j].name,
          A: teams[i],
          B: teams[j],
        });
      }
    }
    for (const m of reorderRoundRobin(pairings)) {
      n += 1;
      const A = m.A;
      const B = m.B;
      out.push({
          id: `tmm${String(n).padStart(2, "0")}`,
          groupId: group.id,
          teamA: A.name,
          teamB: B.name,
          scoreA: 0,
          scoreB: 0,
          status: "scheduled",
          individual: [
            { id: `${A.id}-${B.id}-d`,  label: "Đôi",   playerA: "—", playerB: "—", bestOf: 3, sets: [] },
            { id: `${A.id}-${B.id}-s1`, label: "Đơn 1", playerA: "—", playerB: "—", bestOf: 3, sets: [] },
            { id: `${A.id}-${B.id}-s2`, label: "Đơn 2", playerA: "—", playerB: "—", bestOf: 3, sets: [] },
          ],
      });
    }
  }
  return out;
})();

/* ============================================================
 * VÒNG LOẠI TRỰC TIẾP
 * ============================================================ */

/** Đôi: 8 cặp (Nhất + Nhì 4 bảng) → tứ kết → bán kết → chung kết. Tất cả thắng 3/5 ván. */
export const MOCK_DOUBLES_KO: KnockoutMatch[] = [
  {
    id: "dko-qf1",
    round: "qf",
    bestOf: 5,
    labelA: "Nhất bảng A",
    labelB: "Nhì bảng C",
    sets: [],
    status: "scheduled",
  },
  {
    id: "dko-qf2",
    round: "qf",
    bestOf: 5,
    labelA: "Nhất bảng C",
    labelB: "Nhì bảng A",
    sets: [],
    status: "scheduled",
  },
  {
    id: "dko-qf3",
    round: "qf",
    bestOf: 5,
    labelA: "Nhất bảng B",
    labelB: "Nhì bảng D",
    sets: [],
    status: "scheduled",
  },
  {
    id: "dko-qf4",
    round: "qf",
    bestOf: 5,
    labelA: "Nhất bảng D",
    labelB: "Nhì bảng B",
    sets: [],
    status: "scheduled",
  },
  {
    id: "dko-sf1",
    round: "sf",
    bestOf: 5,
    labelA: "Thắng Tứ kết 1",
    labelB: "Thắng Tứ kết 2",
    sets: [],
    status: "scheduled",
  },
  {
    id: "dko-sf2",
    round: "sf",
    bestOf: 5,
    labelA: "Thắng Tứ kết 3",
    labelB: "Thắng Tứ kết 4",
    sets: [],
    status: "scheduled",
  },
  {
    id: "dko-f",
    round: "f",
    bestOf: 5,
    labelA: "Thắng Bán kết 1",
    labelB: "Thắng Bán kết 2",
    sets: [],
    status: "scheduled",
  },
];

/** Đồng đội: 4 đội (Nhất + Nhì 2 bảng) → bán kết → chung kết.
 *  Bán kết: thắng 2/3 ván. Chung kết: dự kiến 3/5 ván — đang chờ BTC xác nhận. */
export const TEAM_FINAL_NOTE =
  "Chung kết dự kiến thắng 3/5 ván — đang chờ BTC xác nhận.";

const TEAM_KO_LINEUP = (id: string): IndividualMatch[] => [
  { id: `${id}-d`,  label: "Đôi",   playerA: "—", playerB: "—", bestOf: 3, sets: [] },
  { id: `${id}-s1`, label: "Đơn 1", playerA: "—", playerB: "—", bestOf: 3, sets: [] },
  { id: `${id}-s2`, label: "Đơn 2", playerA: "—", playerB: "—", bestOf: 3, sets: [] },
];

export const MOCK_TEAM_KO: KnockoutMatch[] = [
  {
    id: "tko-sf1",
    round: "sf",
    bestOf: 3,
    labelA: "Nhất bảng A",
    labelB: "Nhì bảng B",
    sets: [],
    status: "scheduled",
    individual: TEAM_KO_LINEUP("tko-sf1"),
  },
  {
    id: "tko-sf2",
    round: "sf",
    bestOf: 3,
    labelA: "Nhất bảng B",
    labelB: "Nhì bảng A",
    sets: [],
    status: "scheduled",
    individual: TEAM_KO_LINEUP("tko-sf2"),
  },
  {
    id: "tko-f",
    round: "f",
    bestOf: 5,
    labelA: "Thắng Bán kết 1",
    labelB: "Thắng Bán kết 2",
    sets: [],
    status: "scheduled",
    individual: TEAM_KO_LINEUP("tko-f"),
  },
];
