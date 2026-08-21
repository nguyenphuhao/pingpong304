import { Skeleton } from "@/components/ui/skeleton";

/**
 * Khung xương cho vùng nội dung khi đổi bảng.
 *
 * Dựng đúng hình dạng và số lượng của nội dung thật (đầu bảng, danh sách cặp,
 * n thẻ trận) để lúc dữ liệu về không bị nhảy layout.
 */
export function GroupScheduleSkeleton({ matches = 10 }: { matches?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-4 w-40 rounded" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-4 w-52 rounded" />
      <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3">
        {Array.from({ length: matches }, (_, i) => (
          <Skeleton key={i} className="h-[9.5rem] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function StandingsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-28 rounded-2xl" />
      <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-[5.5rem] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
