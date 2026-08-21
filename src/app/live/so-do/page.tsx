import { Bracket } from "./_Bracket";
import { FinalRanking } from "./_FinalRanking";
import { fetchDoublesKo } from "@/lib/db/knockout";

export const dynamic = "force-dynamic";

export default async function LiveKnockoutPage() {
  const matches = await fetchDoublesKo();

  return (
    <>
      <section className="rounded-2xl border bg-card p-3">
        <h1 className="text-[1.3rem] font-bold tracking-tight">
          Vòng loại trực tiếp
        </h1>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip strong>BO5 — thắng 3 ván</Chip>
          <Chip>Bắt chéo A↔C · B↔D</Chip>
          <Chip>Thua 1 trận là bị loại</Chip>
        </div>
      </section>

      <SectionLabel>Sơ đồ nhánh đấu</SectionLabel>
      <Bracket matches={matches} />

      <SectionLabel>Thứ hạng chung cuộc</SectionLabel>
      <FinalRanking matches={matches} />
    </>
  );
}

function Chip({
  children,
  strong,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold ${
        strong
          ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400"
          : "bg-background/70 text-foreground/80"
      }`}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
