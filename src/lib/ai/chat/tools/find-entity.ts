import { tool } from "ai";
import { z } from "zod";
import { fetchPairs } from "@/lib/db/pairs";
import { fetchTeams } from "@/lib/db/teams";
import { normalizeVi } from "@/lib/text/normalize";

type Hit = { type: "pair" | "team"; id: string; label: string; matchedOn: string };

/**
 * Nới lỏng hết mức: bỏ dấu tiếng Việt VÀ bỏ dấu câu.
 * "H'Lim" → "hlim", "Cường (lớn)" → "cuong lon", "Nghiệp / Mạnh" → "nghiep manh".
 * Nhờ vậy gõ liền không dấu vẫn ra, mà không phải sửa normalizeVi dùng chung.
 */
function loose(s: string): string {
  return normalizeVi(s)
    // Nháy nằm GIỮA chữ nên bỏ hẳn: "H'Lim" phải thành "hlim", không phải "h lim".
    .replace(/['’`]/g, "")
    // Dấu câu còn lại là ranh giới giữa các từ nên thay bằng khoảng trắng.
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tách "Nghiệp / Mạnh", "Mạnh - Nghiệp", "Nghiệp và Mạnh", "manh nghiep" thành từng tên. */
function splitNames(q: string): string[] {
  return q
    .split(/[/\-–—,&+]|\svà\s|\sva\s|\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Một lượt so khớp. `prep` quyết định so có dấu hay bỏ dấu.
 *
 * Bốn kiểu người dùng hay gõ, xét theo thứ tự:
 *   1. Nguyên nhãn cặp như hiện trên màn hình — "Nghiệp / Mạnh"
 *   2. Tên một VĐV — "Nghiệp"
 *   3. Hai tên nhưng đảo thứ tự — "Mạnh / Nghiệp"
 */
function search(
  query: string,
  pairs: Awaited<ReturnType<typeof fetchPairs>>,
  teams: Awaited<ReturnType<typeof fetchTeams>>,
  prep: (s: string) => string,
): Hit[] {
  const q = prep(query);
  if (!q) return [];
  const parts = splitNames(q);

  const pairHits: Hit[] = [];
  for (const p of pairs) {
    const n1 = prep(p.p1.name);
    const n2 = prep(p.p2.name);
    const label = `${p.p1.name} / ${p.p2.name}`;

    let matchedOn: string | null = null;
    if (prep(label).includes(q)) matchedOn = label;
    else if (n1.includes(q)) matchedOn = p.p1.name;
    else if (n2.includes(q)) matchedOn = p.p2.name;
    else if (
      parts.length >= 2 &&
      parts.every((t) => n1.includes(t) || n2.includes(t))
    ) {
      matchedOn = label;
    }

    if (matchedOn) {
      pairHits.push({ type: "pair", id: p.id, label, matchedOn });
    }
  }

  const teamHits: Hit[] = teams
    .filter((t) => prep(t.name).includes(q))
    .map((t) => ({ type: "team", id: t.id, label: t.name, matchedOn: t.name }));

  return [...pairHits, ...teamHits];
}

export const findEntityTool = tool({
  description:
    "Tìm cặp đôi hoặc đội theo tên VĐV hoặc nguyên nhãn cặp như hiện trên màn hình " +
    "(ví dụ 'Nghiệp / Mạnh'). Chấp nhận gõ không dấu và đảo thứ tự hai tên. " +
    "Trả về top 3 kết quả khớp nhất để AI chọn. " +
    // Đừng thêm câu kiểu "tool này CHỈ trả về danh tính, phải gọi tiếp...".
    // Đã thử: model đọc xong thì coi tool là vô dụng, bỏ luôn không gọi, quay ra
    // hỏi ngược người dùng họ tên đầy đủ. Nói tool LÀM ĐƯỢC GÌ, đừng nói nó thiếu gì.
    "Dùng ngay khi user nhắc tới tên người hoặc tên cặp, đừng hỏi lại họ tên đầy đủ.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Tên VĐV, tên cặp hoặc tên đội mà user nhắc đến"),
  }),
  execute: async ({ query }) => {
    const [pairs, teams] = await Promise.all([fetchPairs(), fetchTeams()]);

    // So có dấu trước. Bỏ dấu chỉ dùng khi lượt đầu không ra gì:
    // normalizeVi("Phương") và normalizeVi("Phượng") đều ra "phuong", mà đây là
    // hai người khác nhau CÙNG BẢNG A (docs/draw-result.md §3). Bỏ dấu ngay từ
    // đầu là gộp nhầm hai cặp — sai kết quả cho đúng chỗ nguy hiểm nhất giải.
    const exact = search(query, pairs, teams, (s) => s.trim().toLowerCase());
    const hits = exact.length > 0 ? exact : search(query, pairs, teams, loose);

    return { matches: hits.slice(0, 3) };
  },
});
