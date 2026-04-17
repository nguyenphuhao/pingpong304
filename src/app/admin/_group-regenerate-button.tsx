"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { regenerateMatches } from "./_match-actions";

export function GroupRegenerateButton({
  kind,
  groupId,
  groupName,
}: {
  kind: "doubles" | "teams";
  groupId: string;
  groupName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        const res = await regenerateMatches(kind, groupId);
        const { kept, deleted, added } = res.summary;
        toast.success(
          `${groupName}: giữ ${kept} / xóa ${deleted} / thêm ${added} trận`,
        );
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lỗi không xác định");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={isPending}>
            <RefreshCw className={isPending ? "animate-spin" : ""} />
            Tạo lại lịch
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đồng bộ lịch theo entries hiện tại?</DialogTitle>
          <DialogDescription>
            Sẽ giữ các trận có cặp/đội còn trong bảng, xóa cặp đã rời, thêm cặp
            mới. Trận đã đấu (sets/winner) được bảo toàn.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Hủy</Button>} />
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Đang đồng bộ..." : "Đồng bộ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
