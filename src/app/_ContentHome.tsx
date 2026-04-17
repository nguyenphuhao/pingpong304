import { Medal, Shield, Swords, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GroupStageTabs } from "./_publicGroup";
import { PublicKnockoutSection } from "./_publicKnockout";
import type { GroupResolved } from "@/lib/schemas/group";
import type { DoublesKoResolved, TeamKoResolved } from "@/lib/schemas/knockout";

export function ContentHome({
  kind,
  groups,
  knockout,
}: {
  kind: "doubles" | "teams";
  groups: GroupResolved[];
  knockout: DoublesKoResolved[] | TeamKoResolved[];
}) {
  const isDoubles = kind === "doubles";

  const titleColor = isDoubles
    ? "text-blue-600 dark:text-blue-400"
    : "text-violet-600 dark:text-violet-400";
  const Icon = isDoubles ? Users : Shield;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Icon className={`size-5 ${titleColor}`} />
          <h1 className="text-xl font-semibold leading-tight">
            Nội dung {isDoubles ? "Đôi" : "Đồng đội"}
          </h1>
        </div>
        <Badge variant="secondary">Đang diễn ra</Badge>
      </header>

      {/* Tên giải */}
      <div className="border-l-2 border-emerald-500/50 pl-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          CLB Bóng Bàn Bình Tân
        </p>
        <p className="mt-0.5 text-sm leading-snug text-foreground/80">
          Giải Bóng Bàn Kỷ niệm 51 năm ngày thống nhất đất nước
        </p>
      </div>

      {/* KẾT QUẢ CHUNG CUỘC */}
      <FinalRanking knockout={knockout} />

      {/* VÒNG BẢNG */}
      <Section
        icon={<Trophy className={`size-4 ${titleColor}`} />}
        title="Vòng bảng"
        subtitle="Chọn bảng để xem"
      >
        <GroupStageTabs kind={kind} groups={groups} />
      </Section>

      {/* VÒNG LOẠI TRỰC TIẾP */}
      <Section
        icon={<Swords className="size-4 text-amber-500" />}
        title="Vòng loại trực tiếp"
        subtitle="Lịch & kết quả"
      >
        <PublicKnockoutSection
          kind={kind}
          matches={knockout}
        />
      </Section>

    </main>
  );
}

type KoMatch = DoublesKoResolved | TeamKoResolved;

function isDoublesKo(m: KoMatch): m is DoublesKoResolved {
  return "sets" in m;
}

const MEDAL = [
  { emoji: "🥇", label: "Nhất", bg: "bg-yellow-500/15 border-yellow-500/40", text: "text-yellow-700 dark:text-yellow-400" },
  { emoji: "🥈", label: "Nhì", bg: "bg-gray-200/60 border-gray-300/50 dark:bg-gray-700/30 dark:border-gray-600/30", text: "text-gray-700 dark:text-gray-300" },
  { emoji: "🥉", label: "Đồng hạng 3", bg: "bg-amber-600/10 border-amber-600/25", text: "text-amber-700 dark:text-amber-500" },
];

function FinalRanking({ knockout }: { knockout: KoMatch[] }) {
  const final = knockout.find((m) => m.round === "f");
  if (!final || (final.status !== "done" && final.status !== "forfeit")) return null;

  const winnerId = isDoublesKo(final) ? final.winner?.id : (final as TeamKoResolved).winner?.id;
  if (!winnerId) return null;

  const winnerName = isDoublesKo(final) ? final.winner?.label : (final as TeamKoResolved).winner?.name;
  const loserName = isDoublesKo(final)
    ? (final.entryA?.id === winnerId ? final.entryB?.label : final.entryA?.label)
    : ((final as TeamKoResolved).entryA?.id === winnerId
        ? (final as TeamKoResolved).entryB?.name
        : (final as TeamKoResolved).entryA?.name);

  const thirds = knockout
    .filter((m) => m.round === "sf")
    .map((m) => {
      const wId = isDoublesKo(m) ? m.winner?.id : (m as TeamKoResolved).winner?.id;
      if (!wId) return null;
      if (isDoublesKo(m)) {
        return m.entryA?.id === wId ? m.entryB?.label : m.entryA?.label;
      }
      const tm = m as TeamKoResolved;
      return tm.entryA?.id === wId ? tm.entryB?.name : tm.entryA?.name;
    })
    .filter(Boolean) as string[];

  if (!winnerName || !loserName) return null;

  const rows = [
    { ...MEDAL[0], name: winnerName },
    { ...MEDAL[1], name: loserName },
    ...thirds.map((name) => ({ ...MEDAL[2], name })),
  ];

  return (
    <section className="rounded-2xl border-2 border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 via-yellow-500/5 to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <Medal className="size-5 text-yellow-600" />
        <h2 className="text-base font-bold">Kết quả chung cuộc</h2>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${r.bg}`}>
            <span className="text-xl">{r.emoji}</span>
            <div className="min-w-0 flex-1">
              <span className={`text-xs font-semibold uppercase tracking-wide ${r.text}`}>{r.label}</span>
              <p className="text-sm font-medium">{r.name}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
      {children}
    </section>
  );
}
