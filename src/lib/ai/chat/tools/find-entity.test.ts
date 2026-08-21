import { describe, it, expect, vi, beforeEach } from "vitest";
import { findEntityTool } from "./find-entity";

vi.mock("@/lib/db/pairs", () => ({
  fetchPairs: vi.fn(),
}));
vi.mock("@/lib/db/teams", () => ({
  fetchTeams: vi.fn(),
}));

import { fetchPairs } from "@/lib/db/pairs";
import { fetchTeams } from "@/lib/db/teams";

type FindEntityResult = {
  matches: Array<{ type: string; id: string; label: string; matchedOn: string }>;
};

describe("findEntityTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches pair by player name (substring, case-insensitive)", async () => {
    (fetchPairs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", p1: { id: "x", name: "Nguyễn Văn A" }, p2: { id: "y", name: "Trần B" } },
    ]);
    (fetchTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await findEntityTool.execute!({ query: "Văn A" }, { toolCallId: "t", messages: [] });
    if (result && typeof result === "object" && !(Symbol.asyncIterator in result)) {
      expect((result as FindEntityResult).matches.length).toBeGreaterThan(0);
      expect((result as FindEntityResult).matches[0].type).toBe("pair");
    }
  });

  it("returns empty matches when nothing found", async () => {
    (fetchPairs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await findEntityTool.execute!({ query: "xyz" }, { toolCallId: "t", messages: [] });
    if (result && typeof result === "object" && !(Symbol.asyncIterator in result)) {
      expect((result as FindEntityResult).matches.length).toBe(0);
    }
  });
});

// ── Cách VĐV thật sẽ hỏi ──
// Nhãn cặp hiện khắp app là "Nghiệp / Mạnh", nên người ta chép nguyên cụm đó vào
// khung chat. Gõ trên điện thoại thì hay bỏ dấu.

describe("findEntityTool — tìm theo tên cặp", () => {
  const PAIRS = [
    { id: "A1", p1: { id: "VD01", name: "Nghiệp" }, p2: { id: "VD02", name: "Mạnh" } },
    { id: "A3", p1: { id: "VD05", name: "H'Lim" }, p2: { id: "VD06", name: "Phương" } },
    { id: "A4", p1: { id: "VD07", name: "Dũng" }, p2: { id: "VD08", name: "Phượng" } },
  ];

  async function find(query: string) {
    (fetchPairs as ReturnType<typeof vi.fn>).mockResolvedValue(PAIRS);
    (fetchTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const r = await findEntityTool.execute!({ query }, { toolCallId: "t", messages: [] });
    return (r as FindEntityResult).matches;
  }

  it("tìm bằng nguyên nhãn cặp như hiện trên màn hình", async () => {
    const m = await find("Nghiệp / Mạnh");
    expect(m.map((x) => x.id)).toEqual(["A1"]);
  });

  it("tìm được khi đảo thứ tự hai tên", async () => {
    const m = await find("Mạnh / Nghiệp");
    expect(m.map((x) => x.id)).toEqual(["A1"]);
  });

  it("tìm được khi gõ không dấu", async () => {
    const m = await find("nghiep manh");
    expect(m.map((x) => x.id)).toEqual(["A1"]);
  });

  it("một tên không dấu vẫn ra đúng cặp", async () => {
    const m = await find("hlim");
    expect(m.map((x) => x.id)).toEqual(["A3"]);
  });

  it("phân biệt được Phương và Phượng — hai người khác nhau cùng bảng A", async () => {
    expect((await find("Phương")).map((x) => x.id)).toEqual(["A3"]);
    expect((await find("Phượng")).map((x) => x.id)).toEqual(["A4"]);
  });

  it("không khớp bừa với tên chẳng liên quan", async () => {
    expect(await find("Messi")).toEqual([]);
  });
});
