import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import {
  MOCK_TEAM_GROUPS,
  MOCK_TEAM_KO,
  MOCK_TEAM_PLAYERS,
  MOCK_TEAMS,
  TEAM_FINAL_NOTE,
} from "../_mock";

export default function TeamsAdminPage() {
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
        players={MOCK_TEAM_PLAYERS}
        teams={MOCK_TEAMS}
        groups={MOCK_TEAM_GROUPS}
        knockout={MOCK_TEAM_KO}
        knockoutNote={TEAM_FINAL_NOTE}
      />
    </main>
  );
}
