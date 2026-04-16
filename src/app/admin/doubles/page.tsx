import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import { MOCK_DOUBLES_KO } from "../_mock";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchPairs } from "@/lib/db/pairs";
import { fetchDoublesGroups } from "@/lib/db/groups";
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
  const [players, pairs, groups] = await Promise.all([
    fetchPlayers(),
    fetchPairs(),
    fetchDoublesGroups(),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8">
      <ContentWorkspace
        kind="doubles"
        headerSlot={
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
        }
        players={players}
        pairs={pairs}
        groups={groups}
        knockout={MOCK_DOUBLES_KO}
      />
    </main>
  );
}
