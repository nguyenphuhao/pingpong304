"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, Settings, Shield, Users } from "lucide-react";
import { SettingsSheet } from "./_SettingsSheet";

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (pathname.startsWith("/admin")) return null;

  const onHome = pathname === "/";
  const onDoubles = pathname === "/d" || pathname.startsWith("/d/");
  const onTeams = pathname === "/t" || pathname.startsWith("/t/");

  return (
    <>
      {/* Spacer so content isn't covered by the fixed nav */}
      <div aria-hidden className="h-20" />
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className="mx-auto grid max-w-md grid-cols-4"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <NavTab
            href="/"
            label="Trang chủ"
            active={onHome}
            icon={<Home className="size-5" />}
            activeClass="text-foreground"
            indicatorClass="bg-foreground"
          />
          <NavTab
            href="/t"
            label="Đồng đội"
            active={onTeams}
            icon={<Shield className="size-5" />}
            activeClass="text-violet-600 dark:text-violet-400"
            indicatorClass="bg-violet-500"
          />
          <NavTab
            href="/d"
            label="Đôi"
            active={onDoubles}
            icon={<Users className="size-5" />}
            activeClass="text-blue-600 dark:text-blue-400"
            indicatorClass="bg-blue-500"
          />
          <NavTab
            label="Cài đặt"
            active={settingsOpen}
            icon={<Settings className="size-5" />}
            activeClass="text-foreground"
            indicatorClass="bg-foreground"
            onClick={() => setSettingsOpen(true)}
          />
        </div>
      </nav>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

type NavTabProps = {
  label: string;
  active: boolean;
  icon: React.ReactNode;
  activeClass: string;
  indicatorClass: string;
} & ({ href: string; onClick?: undefined } | { href?: undefined; onClick: () => void });

function NavTab({
  href,
  label,
  active,
  icon,
  activeClass,
  indicatorClass,
  onClick,
}: NavTabProps) {
  const className = `relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
    active ? activeClass : "text-muted-foreground active:text-foreground"
  }`;

  const inner = (
    <>
      {active && (
        <span
          aria-hidden
          className={`absolute top-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full ${indicatorClass}`}
        />
      )}
      {icon}
      <span>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href!} className={className}>
      {inner}
    </Link>
  );
}
