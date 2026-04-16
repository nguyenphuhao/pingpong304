import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import {
  MOCK_DOUBLES_GROUPS,
  MOCK_DOUBLES_KO,
  MOCK_PAIRS,
} from "../_mock";
import { supabaseServer } from "@/lib/supabase/server";
import type { Player } from "../_mock";

export const dynamic = "force-dynamic";

async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id, name, phone, gender, club")
    .order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? "",
    gender: r.gender,
    club: r.club ?? "",
  }));
}

export default async function DoublesAdminPage() {
  const players = await fetchPlayers();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/admin" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Nội dung Đôi</h1>
          <p className="text-sm text-muted-foreground">VĐV, cặp đôi và bảng đấu</p>
        </div>
      </header>

      <ContentWorkspace
        kind="doubles"
        players={players}
        pairs={MOCK_PAIRS}
        groups={MOCK_DOUBLES_GROUPS}
        knockout={MOCK_DOUBLES_KO}
      />
    </main>
  );
}
