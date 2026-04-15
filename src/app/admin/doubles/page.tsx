import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import {
  MOCK_DOUBLES_GROUPS,
  MOCK_DOUBLES_KO,
  MOCK_DOUBLES_PLAYERS,
  MOCK_PAIRS,
} from "../_mock";

export default function DoublesAdminPage() {
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
        players={MOCK_DOUBLES_PLAYERS}
        pairs={MOCK_PAIRS}
        groups={MOCK_DOUBLES_GROUPS}
        knockout={MOCK_DOUBLES_KO}
      />
    </main>
  );
}
