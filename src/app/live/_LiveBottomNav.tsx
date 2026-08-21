"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Trophy } from "lucide-react";
import { LIVE_TABS, activeTabId, type LiveTabId } from "@/lib/live/nav";

const ICON: Record<LiveTabId, React.ComponentType<{ className?: string }>> = {
  lich: CalendarDays,
  sodo: Trophy,
  bxh: BarChart3,
};

export function LiveBottomNav() {
  const active = activeTabId(usePathname() ?? "/");

  return (
    <>
      {/* Chừa chỗ để nội dung cuối trang không nằm dưới thanh cố định. */}
      <div aria-hidden className="h-[4.5rem]" />
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className="mx-auto grid max-w-md grid-cols-3"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {LIVE_TABS.map((tab) => {
            const Icon = ICON[tab.id];
            const isActive = tab.id === active;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                style={{ touchAction: "manipulation" }}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-muted-foreground active:text-foreground"
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 h-[3px] w-11 -translate-x-1/2 rounded-b-full bg-blue-600 dark:bg-blue-400"
                  />
                )}
                <Icon className="size-[1.6rem]" />
                <span className="text-[0.7rem] font-semibold whitespace-nowrap">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
