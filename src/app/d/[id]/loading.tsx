function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Bone className="size-8 rounded-full" />
        <div>
          <Bone className="mb-1 h-5 w-24" />
          <Bone className="h-3 w-40" />
        </div>
      </div>
      {/* Standings */}
      <Bone className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
      {/* Matches */}
      <Bone className="h-8 w-full rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Bone key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
