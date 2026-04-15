"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  return (
    <form
      action={(formData) => {
        const value = String(formData.get("q") ?? "").trim();
        if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm VĐV (vd: Văn An...)"
        className="h-10 pl-9 text-base"
      />
    </form>
  );
}
