import Link from "next/link";
import {
  Award,
  CalendarDays,
  Clock,
  Flag,
  KeyRound,
  MapPin,
  Medal,
  Shield,
  Ticket,
  Users,
  Users2,
} from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      {/* HERO */}
      <Card className="border-emerald-500/40 bg-emerald-500/10 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              CLB Bóng Bàn Bình Tân
            </p>
            <h1 className="mt-2 text-base font-medium text-muted-foreground">
              Giải bóng bàn chào mừng
            </h1>
            <p className="mt-1 text-xl font-semibold leading-snug text-emerald-700 dark:text-emerald-400">
              Kỷ niệm 51 năm ngày thống nhất đất nước
            </p>
            <p className="mt-2 text-sm text-muted-foreground">30/4/1975 – 30/4/2026</p>
          </div>
          <Link
            href="/admin/login"
            aria-label="Ban Tổ Chức"
            title="Ban Tổ Chức"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <KeyRound className="size-4" />
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <HeroInfoRow
            icon={<CalendarDays className="size-4 text-emerald-700 dark:text-emerald-400" />}
            label="Ngày"
            value="Chủ nhật · 19/04/2026"
          />
          <HeroInfoRow
            icon={<Clock className="size-4 text-emerald-700 dark:text-emerald-400" />}
            label="Giờ"
            value="Điểm danh 7:00 sáng"
          />
          <HeroInfoRow
            icon={<MapPin className="size-4 text-emerald-700 dark:text-emerald-400" />}
            label="Địa điểm"
            value={
              <>
                TT CUDV Công Phường An Lạc
                <br />
                <span className="text-muted-foreground">565 Kinh Dương Vương</span>
              </>
            }
          />
        </div>
      </Card>

      {/* THÔNG BÁO BTC */}
      <Card className="border-amber-500/40 bg-amber-500/10 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <Flag className="size-4" />
          Thông báo từ BTC
        </div>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• VĐV tập trung điểm danh từ <span className="font-medium text-foreground">7h00 – 7h30</span></li>
          <li>• Khai mạc & thi đấu lúc <span className="font-medium text-foreground">7h35</span></li>
          <li>• Đồng đội: vòng bảng & BK đánh <span className="font-medium text-foreground">3 lượt</span> (Đơn – Đôi – Đơn), mỗi trận <span className="font-medium text-foreground">3 ván</span></li>
          <li>• Chung kết: 3 hoặc 5 lượt tuỳ thời gian thực tế</li>
        </ul>
      </Card>

      {/* LỊCH SỰ KIỆN */}
      <Section
        icon={<Clock className="size-4 text-emerald-600 dark:text-emerald-400" />}
        title="Lịch sự kiện"
        subtitle="19/04/2026"
      >
        <div className="flex flex-col gap-2">
          <ScheduleRow time="07:00" label="Tập trung · Điểm danh" icon={<Clock className="size-4 text-muted-foreground" />} />
          <ScheduleRow time="07:35" label="Khai mạc & Thi đấu" icon={<Flag className="size-4 text-red-600 dark:text-red-400" />} />
          <ScheduleRow time="08:00" label="Nội dung Đồng đội" icon={<Shield className="size-4 text-violet-600 dark:text-violet-400" />} />
          <ScheduleRow time="13:30" label="Nội dung Đôi" icon={<Users className="size-4 text-blue-600 dark:text-blue-400" />} />
        </div>
      </Section>

      {/* QUY MÔ */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Shield className="size-5 text-violet-600 dark:text-violet-400" />}
          label="Đồng đội"
          value="8 đội"
          sub="2 bảng · A/B"
          color="border-violet-500/30 bg-violet-500/5"
          iconBg="bg-violet-500/15"
        />
        <StatCard
          icon={<Users className="size-5 text-blue-600 dark:text-blue-400" />}
          label="Đôi"
          value="18 cặp"
          sub="4 bảng · A/B/C/D"
          color="border-blue-500/30 bg-blue-500/5"
          iconBg="bg-blue-500/15"
        />
      </div>

      {/* GIẢI THƯỞNG */}
      <Section
        icon={<Award className="size-4 text-yellow-500" />}
        title="Giải thưởng"
        subtitle="Mỗi nội dung"
      >
        <div className="flex flex-col gap-2">
          <PrizeRow
            place="Giải Nhất"
            money="1.500.000đ"
            extras="HCV + Cờ lưu niệm"
            tone="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
          />
          <PrizeRow
            place="Giải Nhì"
            money="1.000.000đ"
            extras="HCB + Cờ lưu niệm"
            tone="bg-slate-400/25 text-slate-600 dark:text-slate-300"
          />
          <PrizeRow
            place="Giải Ba"
            money="500.000đ"
            extras="HCĐ + Cờ lưu niệm"
            tone="bg-amber-700/20 text-amber-700 dark:text-amber-500"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          * Trị giá thưởng có thể tăng tuỳ tổng số đội và nhà tài trợ.
        </p>
      </Section>

      {/* THỂ THỨC NGẮN */}
      <Section
        icon={<Users2 className="size-4 text-muted-foreground" />}
        title="Thể thức thi đấu"
        subtitle="Vắn tắt"
      >
        <div className="flex flex-col gap-3 text-sm">
          <Card className="border-violet-500/30 bg-violet-500/5 p-5">
            <div className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Shield className="size-4 text-violet-600 dark:text-violet-400" />
              Đồng đội
            </div>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Mỗi đội <span className="text-foreground">3 VĐV</span></li>
              <li>• Vòng bảng & BK: <span className="text-foreground">3 lượt</span> (Đơn – Đôi – Đơn), mỗi trận <span className="text-foreground">3 ván</span></li>
              <li>• Chung kết: <span className="text-foreground">3 hoặc 5 lượt</span> tuỳ tình hình</li>
              <li>• Vòng bảng → Bán kết → Chung kết</li>
            </ul>
          </Card>
          <Card className="border-blue-500/30 bg-blue-500/5 p-5">
            <div className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Users className="size-4 text-blue-600 dark:text-blue-400" />
              Đôi
            </div>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Bốc thăm ghép cặp ngẫu nhiên</li>
              <li>• Mỗi cặp có <span className="text-foreground">1 VĐV trình cao</span> + <span className="text-foreground">1 VĐV trình thấp</span></li>
              <li>• Mỗi trận thắng <span className="text-foreground">3/5 ván</span></li>
              <li>• Vòng bảng → Tứ kết → Bán kết → Chung kết</li>
            </ul>
          </Card>
        </div>
      </Section>

      {/* LỆ PHÍ + BTC */}
      <Section
        icon={<Ticket className="size-4 text-muted-foreground" />}
        title="Thông tin chung"
        subtitle="Lệ phí · BTC"
      >
        <Card className="flex flex-col gap-3 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Lệ phí tham dự</span>
            <span className="font-semibold">200.000đ <span className="font-normal text-muted-foreground">/ VĐV / nội dung</span></span>
          </div>
          <div className="border-t pt-3">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Medal className="size-4 text-muted-foreground" />
              Ban tổ chức
            </div>
            <ul className="space-y-1 text-muted-foreground">
              <li>· Ông <span className="text-foreground">Trần Đức Lợi</span> — Trưởng ban (Chủ nhiệm CLB)</li>
              <li>· Ông <span className="text-foreground">Nguyễn Kim Quy</span> — Phó ban</li>
              <li>· Ông <span className="text-foreground">Lê Phú Cường</span> — Phó ban</li>
              <li>· Ông <span className="text-foreground">Phú Hảo</span> — Thư ký</li>
            </ul>
          </div>
        </Card>
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
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function ScheduleRow({
  time,
  label,
  icon,
}: {
  time: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-row items-center gap-3 p-3">
      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted">
        <span className="text-base font-semibold leading-none">{time}</span>
      </div>
      <div className="flex flex-1 items-center gap-2 font-medium">
        {icon}
        {label}
      </div>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  iconBg: string;
}) {
  return (
    <Card className={`flex flex-col gap-3 p-5 ${color}`}>
      <div className={`flex size-10 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </Card>
  );
}

function PrizeRow({
  place,
  money,
  extras,
  tone,
}: {
  place: string;
  money: string;
  extras: string;
  tone: string;
}) {
  return (
    <Card className="flex flex-row items-center gap-3 p-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Medal className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{place}</div>
        <div className="text-xs text-muted-foreground">{extras}</div>
      </div>
      <div className="shrink-0 font-semibold tabular-nums">{money}</div>
    </Card>
  );
}

function HeroInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium leading-snug">{value}</div>
      </div>
    </div>
  );
}
