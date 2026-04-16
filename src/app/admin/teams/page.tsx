import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import { MOCK_TEAM_GROUPS, MOCK_TEAM_KO, TEAM_FINAL_NOTE } from "../_mock";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchTeams } from "@/lib/db/teams";
import type { Player } from "../_mock";

export const dynamic = "force-dynamic";

async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabaseServer
    .from("team_players")
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

export default async function TeamsAdminPage() {
  const [players, teams] = await Promise.all([fetchPlayers(), fetchTeams()]);

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
          <h1 className="text-xl font-semibold">Nội dung Đồng đội</h1>
          <p className="text-sm text-muted-foreground">VĐV, đội và bảng đấu</p>
        </div>
      </header>

      <ContentWorkspace
        kind="teams"
        players={players}
        teams={teams}
        groups={MOCK_TEAM_GROUPS}
        knockout={MOCK_TEAM_KO}
        knockoutNote={TEAM_FINAL_NOTE}
      />
    </main>
  );
}
