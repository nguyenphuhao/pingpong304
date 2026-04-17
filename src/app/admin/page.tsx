import Link from "next/link";
import { ChevronRight, ExternalLink, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "./actions";

export default function AdminHome() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Ban Tổ Chức</h1>
          <p className="text-sm text-muted-foreground">Chọn nội dung cần quản lý</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Trang công khai"
            title="Trang công khai"
            className="inline-flex size-9 items-center justify-center rounded-md border hover:bg-muted"
          >
            <ExternalLink className="size-4" />
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Đăng xuất
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <Link href="/admin/doubles">
          <Card className="flex flex-row items-center gap-3 border-blue-500/30 bg-blue-500/5 p-4 active:bg-blue-500/10">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Users className="size-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Nội dung Đôi</span>
                <Badge variant="secondary" className="text-sm">Đang diễn ra</Badge>
              </div>
              <p className="text-sm text-muted-foreground">6 VĐV · 3 cặp · 2 bảng</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Card>
        </Link>

        <Link href="/admin/teams">
          <Card className="flex flex-row items-center gap-3 border-violet-500/30 bg-violet-500/5 p-4 active:bg-violet-500/10">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <Shield className="size-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Nội dung Đồng đội</span>
                <Badge variant="outline" className="text-sm">Sắp diễn ra</Badge>
              </div>
              <p className="text-sm text-muted-foreground">6 VĐV · 2 đội · 1 bảng</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Card>
        </Link>
      </div>
    </main>
  );
}
