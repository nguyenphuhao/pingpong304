"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FONT_SIZE_LEVELS,
  isOnboarded,
  markOnboarded,
  type FontSize,
} from "@/lib/preferences";
import { useFontSize } from "./_FontSizeProvider";

export function OnboardingDialog() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { size, setSize } = useFontSize();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isOnboarded(window.localStorage)) setOpen(true);
    setMounted(true);
  }, []);

  const finish = () => {
    markOnboarded(window.localStorage);
    setOpen(false);
  };

  // Never mount on /admin — keeps admin workflow uninterrupted.
  if (pathname.startsWith("/admin")) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) finish();
        else setOpen(true);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle>Chào mừng!</DialogTitle>
          <DialogDescription>
            Chọn giao diện và cỡ chữ phù hợp. Có thể đổi lại ở tab Cài đặt bất
            kỳ lúc nào.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-3">
          <p className="text-base">Lịch thi đấu · BXH · Kết quả</p>
        </div>

        <section className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Giao diện
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Pill
              active={mounted && theme !== "dark"}
              onClick={() => setTheme("light")}
              icon={<Sun className="size-4" />}
              label="Sáng"
            />
            <Pill
              active={mounted && theme === "dark"}
              onClick={() => setTheme("dark")}
              icon={<Moon className="size-4" />}
              label="Tối"
            />
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Cỡ chữ
          </div>
          <div className="grid grid-cols-4 gap-2">
            {FONT_SIZE_LEVELS.map((lvl, idx) => (
              <APill
                key={lvl}
                level={lvl}
                index={idx}
                active={size === lvl}
                onClick={() => setSize(lvl)}
              />
            ))}
          </div>
        </section>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-muted-foreground"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={finish}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Xong
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Pill({
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

function APill({
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
