"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { timeLabel } from "@/lib/live/format";

const INTERVAL_MS = 30_000;

/**
 * Tự kéo lại dữ liệu mỗi 30 giây và cho biết lần cập nhật gần nhất.
 *
 * Mốc giờ chỉ dựng sau khi mount: render trên server rồi render lại trên client
 * cho hai giờ khác nhau và gây lệch hydrate. Lần dựng đầu đẩy qua setTimeout(0)
 * để không gọi setState đồng bộ ngay trong thân effect.
 *
 * Tab đang ẩn thì bỏ lượt — khỏi tốn pin và request khi máy nằm trong túi.
 */
export function AutoRefresh() {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
    setUpdatedAt(timeLabel(new Date()));
  }, [router]);

  useEffect(() => {
    const first = setTimeout(() => setUpdatedAt(timeLabel(new Date())), 0);
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setUpdatedAt(timeLabel(new Date()));
    }, INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [router]);

  return (
    <button
      type="button"
      onClick={refresh}
      style={{ touchAction: "manipulation" }}
      className="mx-auto flex min-h-11 items-center justify-center gap-2 px-3 text-[0.8rem] font-medium text-muted-foreground active:text-foreground"
    >
      <RefreshCw className="size-[1em]" aria-hidden />
      {updatedAt ? `Cập nhật lúc ${updatedAt} · chạm để tải lại` : "Đang tải…"}
    </button>
  );
}
