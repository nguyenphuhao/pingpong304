"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FONT_SIZE_LEVELS, type FontSize } from "@/lib/preferences";
import { useFontSize } from "./_FontSizeProvider";

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { size, setSize } = useFontSize();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-6">
        <SheetHeader className="text-left">
          <SheetTitle>Cài đặt hiển thị</SheetTitle>
          <SheetDescription>
            Chọn giao diện và cỡ chữ phù hợp với bạn.
          </SheetDescription>
        </SheetHeader>

        <section className="mt-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Giao diện
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ThemePill
              active={mounted && theme !== "dark"}
              onClick={() => setTheme("light")}
              icon={<Sun className="size-4" />}
              label="Sáng"
            />
            <ThemePill
              active={mounted && theme === "dark"}
              onClick={() => setTheme("dark")}
              icon={<Moon className="size-4" />}
              label="Tối"
            />
          </div>
        </section>

        <section className="mt-4 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Cỡ chữ
          </div>
          <div className="grid grid-cols-4 gap-2">
            {FONT_SIZE_LEVELS.map((lvl, idx) => (
              <FontSizePill
                key={lvl}
                level={lvl}
                index={idx}
                active={size === lvl}
                onClick={() => setSize(lvl)}
              />
            ))}
          </div>
          <p className="pt-3 text-base text-foreground">
            Đây là ví dụ cỡ chữ hiện tại.
          </p>
        </section>
      </SheetContent>
    </Sheet>
  );
}

function ThemePill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const A_CLASSES = ["text-xs", "text-base", "text-xl", "text-2xl"] as const;

function FontSizePill({
  level,
  index,
  active,
  onClick,
}: {
  level: FontSize;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Cỡ chữ ${level}`}
      className={`flex h-12 items-center justify-center rounded-lg border font-semibold transition-colors ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground"
      } ${A_CLASSES[index]}`}
    >
      A
    </button>
  );
}
