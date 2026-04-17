function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className ?? ""}`}
    />
  );
}

export function ContentHomeSkeleton({
  kind,
}: {
  kind: "doubles" | "teams";
}) {
  const titleColor =
    kind === "doubles"
      ? "text-blue-600 dark:text-blue-400"
      : "text-violet-600 dark:text-violet-400";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Bone className="size-5 rounded-full" />
          <Bone className="h-6 w-36" />
        </div>
        <Bone className="h-5 w-20 rounded-full" />
      </header>

      {/* Tournament name */}
      <div className="border-l-2 border-emerald-500/50 pl-3">
        <Bone className="mb-1 h-3 w-32" />
        <Bone className="h-4 w-56" />
      </div>

      {/* Live matches skeleton */}
      <section>
        <div className="mb-2 flex items-center gap-1.5">
          <Bone className="size-2 rounded-full" />
          <Bone className="h-4 w-16" />
        </div>
        <Bone className="h-28 w-full rounded-xl" />
      </section>

      {/* BXH skeleton */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Bone className="size-4" />
          <Bone className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Bone className="h-20 rounded-lg" />
          <Bone className="h-20 rounded-lg" />
        </div>
      </section>

      {/* Recent results skeleton */}
      <section>
        <div className="mb-2 flex items-center gap-1.5">
          <Bone className="h-4 w-32" />
        </div>
        <Bone className="h-28 w-full rounded-xl" />
      </section>

      <div className="border-t" />

      {/* Schedule skeleton */}
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-1.5">
          <Bone className="size-4" />
          <Bone className="h-5 w-28" />
        </div>
        <Bone className="h-4 w-16" />
      </div>

      {/* KO skeleton */}
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-1.5">
          <Bone className="size-4" />
          <Bone className="h-5 w-36" />
        </div>
        <Bone className="h-4 w-16" />
      </div>
    </main>
  );
}
