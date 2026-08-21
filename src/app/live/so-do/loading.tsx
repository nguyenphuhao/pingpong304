import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="-mx-3 h-96 rounded-none" />
      <Skeleton className="h-64 rounded-2xl" />
    </>
  );
}
