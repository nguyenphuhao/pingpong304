export type GroupColor = {
  /** Border tint on cards/headers */
  border: string;
  /** Soft background tint */
  bg: string;
  /** Strong solid badge (the rounded letter circle) */
  badge: string;
  /** Subtle alternating row bg */
  rowAlt: string;
};

const PALETTE: GroupColor[] = [
  // emerald (A)
  {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    badge: "bg-emerald-600 text-white",
    rowAlt: "bg-emerald-500/5",
  },
  // blue (B)
  {
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    badge: "bg-blue-600 text-white",
    rowAlt: "bg-blue-500/5",
  },
  // amber (C)
  {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    badge: "bg-amber-600 text-white",
    rowAlt: "bg-amber-500/5",
  },
  // rose (D)
  {
    border: "border-rose-500/40",
    bg: "bg-rose-500/10",
    badge: "bg-rose-600 text-white",
    rowAlt: "bg-rose-500/5",
  },
  // cyan (E)
  {
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    badge: "bg-cyan-600 text-white",
    rowAlt: "bg-cyan-500/5",
  },
  // fuchsia (F)
  {
    border: "border-fuchsia-500/40",
    bg: "bg-fuchsia-500/10",
    badge: "bg-fuchsia-600 text-white",
    rowAlt: "bg-fuchsia-500/5",
  },
  // sky
  {
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
    badge: "bg-sky-600 text-white",
    rowAlt: "bg-sky-500/5",
  },
  // lime
  {
    border: "border-lime-500/40",
    bg: "bg-lime-500/10",
    badge: "bg-lime-600 text-white",
    rowAlt: "bg-lime-500/5",
  },
];

/** Map a group id like "gA" / "gtA" → palette index. Falls back to alphabetical. */
export function groupColor(groupId: string): GroupColor {
  const last = groupId.slice(-1).toUpperCase();
  const idx = "ABCDEF".indexOf(last);
  return PALETTE[idx >= 0 ? idx : 0];
}

/** Color theo index của đội (0-based). */
export function teamColor(index: number): GroupColor {
  return PALETTE[index % PALETTE.length];
}
