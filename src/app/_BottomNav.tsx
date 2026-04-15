"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Shield, Users } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/admin")) return null;

  const onHome = pathname === "/";
  const onDoubles = pathname === "/d" || pathname.startsWith("/d/");
  const onTeams = pathname === "/t" || pathname.startsWith("/t/");

  const homeHref = "/";
  const doublesHref = "/d";
  const teamsHref = "/t";

  return (
    <>
      {/* Spacer so content isn't covered by the fixed nav */}
      <div aria-hidden className="h-20" />
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className="mx-auto grid max-w-md grid-cols-3"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <NavTab
            href={homeHref}
            label="Trang chủ"
            active={onHome}
            icon={<Home className="size-5" />}
            activeClass="text-foreground"
            indicatorClass="bg-foreground"
          />
          <NavTab
            href={teamsHref}
            label="Đồng đội"
            active={onTeams}
            icon={<Shield className="size-5" />}
            activeClass="text-violet-600 dark:text-violet-400"
            indicatorClass="bg-violet-500"
          />
          <NavTab
            href={doublesHref}
            label="Đôi"
            active={onDoubles}
            icon={<Users className="size-5" />}
            activeClass="text-blue-600 dark:text-blue-400"
            indicatorClass="bg-blue-500"
          />
        </div>
      </nav>
    </>
  );
}

function NavTab({
  href,
  label,
  active,
  icon,
  activeClass,
  indicatorClass,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  activeClass: string;
  indicatorClass: string;
}) {
  return (
    <Link
      href={href}
      className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
        active ? activeClass : "text-muted-foreground active:text-foreground"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className={`absolute top-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full ${indicatorClass}`}
        />
      )}
      {icon}
      <span>{label}</span>
    </Link>
  );
}
