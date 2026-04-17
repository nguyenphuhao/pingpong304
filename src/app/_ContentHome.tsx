import { Shield, Swords, Trophy, Users } from "lucide-react";
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
