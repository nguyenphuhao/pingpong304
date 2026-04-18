// src/app/admin/_search-sheet.tsx
"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
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
import { Card } from "@/components/ui/card";
import { fetchMatchIndexForKind } from "./_search-actions";
import {
  filterAndSortMatches,
  type MatchIndexItem,
  type MatchKind,
} from "./_search-filter";

const STATUS_LABEL: Record<MatchIndexItem["status"], string> = {
  live: "Đang đấu",
  scheduled: "Chưa đấu",
  done: "Đã xong",
  forfeit: "Bỏ cuộc",
};

const STATUS_CLASS: Record<MatchIndexItem["status"], string> = {
  live: "bg-red-500/15 text-red-600 dark:text-red-400 animate-pulse",
  scheduled: "bg-muted text-muted-foreground",
  done: "bg-green-500/15 text-green-700 dark:text-green-400",
  forfeit: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

export function SearchIconButton({ kind }: { kind: MatchKind }) {
  const [open, setOpen] = useState(false);
  const cache = useRef<Map<MatchKind, MatchIndexItem[]>>(new Map());
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
          cache={cache}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdminSearchSheet({
  kind,
  onPick,
  cache,
}: {
  kind: MatchKind;
  onPick: () => void;
  cache: React.MutableRefObject<Map<MatchKind, MatchIndexItem[]>>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MatchIndexItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
  const emptyReason = deriveEmptyReason({
    loading: isPending || items === null,
    error,
    itemsExists: items !== null && items.length > 0,
    resultsLen: results.length,
    query,
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
        {emptyReason === "loading" && (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải…
          </p>
        )}
        {emptyReason === "error" && (
          <div className="flex flex-col items-center gap-2 py-10 text-sm">
            <p className="text-muted-foreground">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => load(true)}>
              Thử lại
            </Button>
          </div>
        )}
        {emptyReason === "no-items" && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Chưa có trận. Tạo bảng trước ở tab Bảng.
          </p>
        )}
        {emptyReason === "no-live" && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Chưa có trận đang đấu. Gõ để tìm.
          </p>
        )}
        {emptyReason === "no-match" && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Không tìm thấy trận nào.
          </p>
        )}
        {emptyReason === null && (
          <ul className="flex flex-col gap-2">
            {results.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => {
                    router.push(
                      `/admin/${m.kind}/groups/${m.groupId}?match=${m.id}`,
                    );
                    onPick();
                  }}
                >
                  <Card className="p-3 transition-colors hover:bg-muted/40 active:bg-muted">
                    <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-muted-foreground">
                        {m.groupName}
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-sm font-medium ${STATUS_CLASS[m.status]}`}
                      >
                        {STATUS_LABEL[m.status]}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-sm">
                      <div className="truncate">{m.sideA}</div>
                      <div className="truncate">{m.sideB}</div>
                    </div>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}

      </div>
    </div>
  );
}

type EmptyReason = "loading" | "error" | "no-items" | "no-live" | "no-match" | null;

function deriveEmptyReason(args: {
  loading: boolean;
  error: string | null;
  itemsExists: boolean;
  resultsLen: number;
  query: string;
}): EmptyReason {
  if (args.loading) return "loading";
  if (args.error) return "error";
  if (!args.itemsExists) return "no-items";
  if (args.resultsLen === 0 && args.query.trim() === "") return "no-live";
  if (args.resultsLen === 0) return "no-match";
  return null;
}
