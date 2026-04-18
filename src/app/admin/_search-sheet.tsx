// src/app/admin/_search-sheet.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchMatchIndexForKind } from "./_search-actions";
import {
  filterAndSortMatches,
  type MatchIndexItem,
  type MatchKind,
} from "./_search-filter";

const STATUS_LABEL: Record<MatchIndexItem["status"], string> = {
  live: "Đang đá",
  scheduled: "Sắp đá",
  done: "Đã xong",
  forfeit: "Bỏ cuộc",
};

const STATUS_CLASS: Record<MatchIndexItem["status"], string> = {
  live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  scheduled: "bg-muted text-foreground/80",
  done: "bg-muted text-muted-foreground",
  forfeit: "bg-muted text-muted-foreground",
};

export function SearchIconButton({ kind }: { kind: MatchKind }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Tìm trận"
            title="Tìm trận"
          />
        }
      >
        <Search className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 p-0">
        <AdminSearchSheet
          kind={kind}
          onPick={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdminSearchSheet({
  kind,
  onPick,
}: {
  kind: MatchKind;
  onPick: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MatchIndexItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cache = useRef<Map<MatchKind, MatchIndexItem[]>>(new Map());

  const load = (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = cache.current.get(kind);
      if (cached) {
        setItems(cached);
        setError(null);
        return;
      }
    }
    setError(null);
    setItems(null);
    startTransition(async () => {
      try {
        const data = await fetchMatchIndexForKind(kind);
        cache.current.set(kind, data);
        setItems(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
      }
    });
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const results = items ? filterAndSortMatches(items, query) : [];
  const emptyState = renderEmptyState({
    loading: isPending || items === null,
    error,
    itemsExists: items !== null && items.length > 0,
    resultsLen: results.length,
    query,
    onRetry: () => load(true),
  });

  return (
    <div className="flex max-h-[85vh] flex-col">
      <DialogHeader className="border-b p-3">
        <DialogTitle className="sr-only">Tìm trận</DialogTitle>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Gõ tên VĐV / cặp / đội…"
              className="h-10 pl-8 pr-8 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Xoá tìm kiếm"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => load(true)}
            disabled={isPending}
            aria-label="Tải lại"
            title="Tải lại"
          >
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RotateCcw />
            )}
          </Button>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto p-2">
        {emptyState}
        {!emptyState && (
          <ul className="flex flex-col gap-1">
            {results.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    router.push(
                      `/admin/${m.kind}/groups/${m.groupId}?match=${m.id}`,
                    );
                    onPick();
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {m.sideA} <span className="text-muted-foreground">vs</span> {m.sideB}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {m.groupName}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 ${STATUS_CLASS[m.status]}`}
                  >
                    {STATUS_LABEL[m.status]}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function renderEmptyState({
  loading,
  error,
  itemsExists,
  resultsLen,
  query,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  itemsExists: boolean;
  resultsLen: number;
  query: string;
  onRetry: () => void;
}): React.ReactNode | null {
  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tải…
      </p>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-sm">
        <p className="text-muted-foreground">{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      </div>
    );
  }
  if (!itemsExists) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có trận. Tạo bảng trước ở tab Bảng.
      </p>
    );
  }
  if (resultsLen === 0 && query.trim() === "") {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Chưa có trận đang đá. Gõ để tìm.
      </p>
    );
  }
  if (resultsLen === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Không tìm thấy trận nào.
      </p>
    );
  }
  return null;
}
