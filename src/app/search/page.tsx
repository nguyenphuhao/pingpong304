import Link from "next/link";
import { Search, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PublicHeader } from "../_public";
import { SearchInput } from "../_searchInput";
import { searchPlayers } from "@/lib/db/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const players = q ? await searchPlayers(q) : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <PublicHeader title="Tìm VĐV" backHref="/" />
      <SearchInput defaultValue={q} />

      {!q && (
        <Empty
          icon={<Search className="size-6 text-muted-foreground" />}
          title="Gõ tên để tìm"
          desc="Tìm theo tên VĐV (cả nội dung Đôi và Đồng đội)"
        />
      )}

      {q && players.length === 0 && (
        <Empty
          icon={<Search className="size-6 text-muted-foreground" />}
          title={`Không tìm thấy "${q}"`}
          desc="Thử lại với một phần tên khác"
        />
      )}

      {players.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            VĐV ({players.length})
          </h2>
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <Card key={`${p.kind}-${p.id}`} className="flex flex-row items-center gap-3 p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.kind === "doubles" ? "Nội dung Đôi" : "Nội dung Đồng đội"} · {p.club}
                  </div>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">{p.phone}</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto pt-6 text-center text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          ← Về trang chủ
        </Link>
      </footer>
    </main>
  );
}

function Empty({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}
