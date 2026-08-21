import { Skeleton } from "@/components/ui/skeleton";

/** Giữ chỗ đúng hình dạng trang thật để nội dung không nhảy khi tải xong. */
export default function Loading() {
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </>
  );
}
