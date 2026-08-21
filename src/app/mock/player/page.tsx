"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  Trophy,
  Sparkles,
  ChevronDown,
  Check,
  X,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type MatchSide = { label: string };
type Set = { a: number; b: number };
type Match = {
  id: string;
  stage: string;
  round: string;
  vs: string;
  won: boolean;
  sets: Set[];
  highlight?: boolean;
};

type PlayerMock = {
  id: string;
  name: string;
  pair: string;
  group: string;
  rank: number;
  matches: number;
  wins: number;
  losses: number;
  setDiff: number;
  winRate: number;
  bestMatch: Match;
  recap: string;
  timeline: Match[];
  archetype: "champ" | "mid" | "early";
};

const MOCKS: PlayerMock[] = [
  {
    id: "nva",
    name: "NGUYỄN VĂN A",
    pair: "A + B",
    group: "Bảng B",
    rank: 1,
    matches: 8,
    wins: 7,
    losses: 1,
    setDiff: 15,
    winRate: 88,
    recap:
      "Vào giải với tâm thế hạt giống, A không khiến BTC thất vọng: 5 trận vòng bảng toàn thắng, chỉ để thua 1 set. Ở knockout, A vượt qua trận bán kết 5 set nghẹt thở rồi giành chức vô địch.",
    bestMatch: {
      id: "m-best",
      stage: "Chung kết",
      round: "F",
      vs: "K + L",
      won: true,
      sets: [
        { a: 11, b: 9 },
        { a: 8, b: 11 },
        { a: 11, b: 7 },
        { a: 9, b: 11 },
        { a: 11, b: 8 },
      ],
      highlight: true,
    },
    timeline: [
      {
        id: "g1",
        stage: "Vòng bảng",
        round: "R1",
        vs: "P + Q",
        won: true,
        sets: [
          { a: 11, b: 6 },
          { a: 11, b: 9 },
          { a: 11, b: 4 },
        ],
      },
      {
        id: "g2",
        stage: "Vòng bảng",
        round: "R2",
        vs: "X + Y",
        won: true,
        sets: [
          { a: 11, b: 9 },
          { a: 8, b: 11 },
          { a: 11, b: 7 },
          { a: 11, b: 9 },
        ],
        highlight: true,
      },
      {
        id: "g3",
        stage: "Vòng bảng",
        round: "R3",
        vs: "M + N",
        won: true,
        sets: [
          { a: 11, b: 8 },
          { a: 11, b: 6 },
          { a: 11, b: 9 },
        ],
      },
      {
        id: "g4",
        stage: "Vòng bảng",
        round: "R4",
        vs: "R + S",
        won: true,
        sets: [
          { a: 11, b: 5 },
          { a: 11, b: 7 },
          { a: 11, b: 3 },
        ],
      },
      {
        id: "qf",
        stage: "Knockout",
        round: "QF",
        vs: "C + D",
        won: true,
        sets: [
          { a: 11, b: 9 },
          { a: 11, b: 7 },
          { a: 11, b: 8 },
        ],
      },
      {
        id: "sf",
        stage: "Knockout",
        round: "SF",
        vs: "E + F",
        won: true,
        sets: [
          { a: 9, b: 11 },
          { a: 11, b: 6 },
          { a: 8, b: 11 },
          { a: 11, b: 9 },
          { a: 11, b: 9 },
        ],
        highlight: true,
      },
      {
        id: "f",
        stage: "Knockout",
        round: "F",
        vs: "K + L",
        won: true,
        sets: [
          { a: 11, b: 9 },
          { a: 8, b: 11 },
          { a: 11, b: 7 },
          { a: 9, b: 11 },
          { a: 11, b: 8 },
        ],
        highlight: true,
      },
    ],
    archetype: "champ",
  },
  {
    id: "ttb",
    name: "TRẦN THỊ B",
    pair: "B + C",
    group: "Bảng A",
    rank: 2,
    matches: 6,
    wins: 4,
    losses: 2,
    setDiff: 5,
    winRate: 67,
    recap:
      "Khởi đầu chậm (thua set 1 ở trận mở màn), nhưng B đã comeback ấn tượng với 3 trận thắng liên tiếp, giành vé knockout. Vào tứ kết, B dừng bước trước hạt giống số 1 sau 4 set.",
    bestMatch: {
      id: "m-best",
      stage: "Vòng bảng",
      round: "R2",
      vs: "X + Y",
      won: true,
      sets: [
        { a: 9, b: 11 },
        { a: 11, b: 8 },
        { a: 7, b: 11 },
        { a: 11, b: 9 },
        { a: 11, b: 8 },
      ],
      highlight: true,
    },
    timeline: [
      {
        id: "g1",
        stage: "Vòng bảng",
        round: "R1",
        vs: "P + Q",
        won: false,
        sets: [
          { a: 5, b: 11 },
          { a: 11, b: 8 },
          { a: 6, b: 11 },
          { a: 8, b: 11 },
        ],
      },
      {
        id: "g2",
        stage: "Vòng bảng",
        round: "R2",
        vs: "X + Y",
        won: true,
        sets: [
          { a: 9, b: 11 },
          { a: 11, b: 8 },
          { a: 7, b: 11 },
          { a: 11, b: 9 },
          { a: 11, b: 8 },
        ],
        highlight: true,
      },
      {
        id: "g3",
        stage: "Vòng bảng",
        round: "R3",
        vs: "M + N",
        won: true,
        sets: [
          { a: 11, b: 6 },
          { a: 11, b: 9 },
          { a: 11, b: 8 },
        ],
      },
      {
        id: "g4",
        stage: "Vòng bảng",
        round: "R4",
        vs: "R + S",
        won: true,
        sets: [
          { a: 11, b: 9 },
          { a: 8, b: 11 },
          { a: 11, b: 7 },
          { a: 11, b: 9 },
        ],
      },
      {
        id: "g5",
        stage: "Vòng bảng",
        round: "R5",
        vs: "U + V",
        won: true,
        sets: [
          { a: 11, b: 5 },
          { a: 11, b: 8 },
          { a: 11, b: 6 },
        ],
      },
      {
        id: "qf",
        stage: "Knockout",
        round: "QF",
        vs: "K + L (HG1)",
        won: false,
        sets: [
          { a: 8, b: 11 },
          { a: 11, b: 9 },
          { a: 7, b: 11 },
          { a: 6, b: 11 },
        ],
      },
    ],
    archetype: "mid",
  },
  {
    id: "lvc",
    name: "LÊ VĂN C",
    pair: "C + D",
    group: "Bảng C",
    rank: 4,
    matches: 4,
    wins: 1,
    losses: 3,
    setDiff: -5,
    winRate: 25,
    recap:
      "Lần đầu tham dự, C gặp khó ở vòng bảng với 2 trận thua liên tiếp. Trận thắng duy nhất là màn ngược dòng đáng nhớ từ 0-2 lội ngược lên 3-2 — pha bóng cuối kéo dài 12 điểm.",
    bestMatch: {
      id: "m-best",
      stage: "Vòng bảng",
      round: "R2",
      vs: "R + S",
      won: true,
      sets: [
        { a: 7, b: 11 },
        { a: 9, b: 11 },
        { a: 11, b: 9 },
        { a: 11, b: 7 },
        { a: 14, b: 12 },
      ],
      highlight: true,
    },
    timeline: [
      {
        id: "g1",
        stage: "Vòng bảng",
        round: "R1",
        vs: "P + Q",
        won: false,
        sets: [
          { a: 5, b: 11 },
          { a: 7, b: 11 },
          { a: 6, b: 11 },
        ],
      },
      {
        id: "g2",
        stage: "Vòng bảng",
        round: "R2",
        vs: "R + S",
        won: true,
        sets: [
          { a: 7, b: 11 },
          { a: 9, b: 11 },
          { a: 11, b: 9 },
          { a: 11, b: 7 },
          { a: 14, b: 12 },
        ],
        highlight: true,
      },
      {
        id: "g3",
        stage: "Vòng bảng",
        round: "R3",
        vs: "X + Y",
        won: false,
        sets: [
          { a: 6, b: 11 },
          { a: 8, b: 11 },
          { a: 5, b: 11 },
        ],
      },
      {
        id: "g4",
        stage: "Vòng bảng",
        round: "R4",
        vs: "M + N",
        won: false,
        sets: [
          { a: 9, b: 11 },
          { a: 11, b: 8 },
          { a: 7, b: 11 },
          { a: 8, b: 11 },
        ],
      },
    ],
    archetype: "early",
  },
];

function setsSummary(sets: Set[]) {
  let a = 0,
    b = 0;
  for (const s of sets) {
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return { a, b };
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 px-2 py-3">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((s) => s[0])
    .join("");
}

/* ----- OG preview card ----- */
function OgPreview({ p }: { p: PlayerMock }) {
  return (
    <div className="relative mx-auto aspect-[1200/630] w-full max-w-md overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-lg">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),_transparent_60%)]" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider opacity-90">
          🏓 CLB Bóng Bàn Bình Tân · 30/4/2026
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-bold backdrop-blur">
            {initialsOf(p.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold leading-tight">
              {p.name}
            </div>
            <div className="text-xs opacity-90">
              {p.group} · Hạng {p.rank}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {[
            { v: p.matches, l: "trận" },
            { v: `${p.wins}-${p.losses}`, l: "W-L" },
            { v: (p.setDiff >= 0 ? "+" : "") + p.setDiff, l: "sets" },
            { v: p.winRate + "%", l: "WR" },
          ].map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-md bg-white/15 px-1 py-1.5 backdrop-blur"
            >
              <div className="text-sm font-bold tabular-nums">{s.v}</div>
              <div className="text-[8px] uppercase tracking-wider opacity-90">
                {s.l}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto line-clamp-2 text-[11px] italic opacity-90">
          &ldquo;{p.recap.split(".")[0]}.&rdquo;
        </div>
      </div>
    </div>
  );
}

/* ----- Match row (expandable) ----- */
function MatchRow({ m }: { m: Match }) {
  const [open, setOpen] = useState(false);
  const s = setsSummary(m.sets);
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="flex w-full flex-col gap-1 rounded-md px-2 py-2 text-left transition hover:bg-muted/60"
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            m.won
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-red-500/15 text-red-700 dark:text-red-400"
          }`}
        >
          {m.won ? <Check className="size-3" /> : <X className="size-3" />}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase text-muted-foreground">
              {m.round}
            </span>
            <span className="truncate font-medium">vs. {m.vs}</span>
            {m.highlight && (
              <Star className="size-3 fill-amber-400 text-amber-400" />
            )}
          </div>
        </div>
        <div className="font-bold tabular-nums">
          {s.a}-{s.b}
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>
      {open && (
        <div className="ml-7 flex flex-wrap gap-1.5 pt-1">
          {m.sets.map((set, i) => (
            <div
              key={i}
              className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                set.a > set.b
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-500/15 text-red-700 dark:text-red-400"
              }`}
            >
              {set.a}-{set.b}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

export default function MockPlayerPage() {
  const [idx, setIdx] = useState(0);
  const p = MOCKS[idx];

  const stages = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of p.timeline) {
      if (!groups.has(m.stage)) groups.set(m.stage, []);
      groups.get(m.stage)!.push(m);
    }
    return Array.from(groups);
  }, [p]);

  const onShare = () => {
    navigator.clipboard.writeText(
      `https://bbbt.playnika.com/player/${p.id}`
    );
    toast.success("Đã copy link!", {
      description: "Dán vào Zalo/Facebook để chia sẻ thành tích.",
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      {/* Mockup toolbar */}
      <Card className="border-dashed bg-muted/30 p-3">
        <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3" /> Mockup — chọn archetype
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MOCKS.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setIdx(i)}
              className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                i === idx
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {m.archetype === "champ"
                ? "🏆 Vô địch"
                : m.archetype === "mid"
                ? "⚡ Trung bình"
                : "🌱 Loại sớm"}
            </button>
          ))}
        </div>
      </Card>

      {/* Back */}
      <Link
        href="/"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>

      {/* OG preview */}
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Share card preview (1200×630)
        </div>
        <OgPreview p={p} />
      </div>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-lg font-bold text-emerald-700 dark:text-emerald-400">
            {initialsOf(p.name)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{p.name}</h1>
            <div className="text-sm text-muted-foreground">Cặp: {p.pair}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {p.group}
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px]">
                Hạng {p.rank}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <Stat value={String(p.matches)} label="trận" />
          <Stat value={`${p.wins}-${p.losses}`} label="W-L" />
          <Stat
            value={(p.setDiff >= 0 ? "+" : "") + p.setDiff}
            label="sets"
          />
          <Stat value={p.winRate + "%"} label="WR" />
        </div>
      </Card>

      {/* AI Recap */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <Sparkles className="size-3.5" /> AI RECAP
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">{p.recap}</p>
      </Card>

      {/* Best match */}
      <Card className="border-amber-500/40 bg-amber-500/5 p-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Trophy className="size-3.5" /> TRẬN HAY NHẤT
        </div>
        <div className="text-sm font-semibold">vs. {p.bestMatch.vs}</div>
        <div className="text-xs text-muted-foreground">
          {p.bestMatch.stage} · {p.bestMatch.round}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.bestMatch.sets.map((s, i) => (
            <div
              key={i}
              className={`rounded-sm px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                s.a > s.b
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-500/15 text-red-700 dark:text-red-400"
              }`}
            >
              {s.a}-{s.b}
            </div>
          ))}
          <div className="ml-auto text-sm font-bold tabular-nums">
            {setsSummary(p.bestMatch.sets).a}-{setsSummary(p.bestMatch.sets).b}
          </div>
        </div>
      </Card>

      {/* Timeline */}
      <Card className="p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          📜 Hành trình
        </div>
        <div className="flex flex-col gap-3">
          {stages.map(([stage, matches]) => (
            <div key={stage}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stage}
              </div>
              <div className="flex flex-col">
                {matches.map((m) => (
                  <MatchRow key={m.id} m={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          Chạm vào trận để xem chi tiết từng set.
        </div>
      </Card>

      {/* Share */}
      <Button
        size="lg"
        className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
        onClick={onShare}
      >
        <Share2 className="size-4" /> Chia sẻ thành tích
      </Button>

      <div className="h-16" />
    </main>
  );
}
