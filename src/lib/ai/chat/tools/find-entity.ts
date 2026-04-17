import { tool } from "ai";
import { z } from "zod";
import { fetchPairs } from "@/lib/db/pairs";
import { fetchTeams } from "@/lib/db/teams";

export const findEntityTool = tool({
  description:
    "Tìm cặp đôi hoặc đội dựa trên tên VĐV hoặc tên đội. Trả về top 3 kết quả khớp nhất để AI chọn.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Tên VĐV hoặc đội mà user nhắc đến"),
  }),
  execute: async ({ query }) => {
    const q = query.trim().toLowerCase();
    const [pairs, teams] = await Promise.all([fetchPairs(), fetchTeams()]);

    const pairMatches = pairs
      .filter(
        (p) =>
          p.p1.name.toLowerCase().includes(q) ||
          p.p2.name.toLowerCase().includes(q),
      )
      .map((p) => ({
        type: "pair" as const,
        id: p.id,
        label: `${p.p1.name} – ${p.p2.name}`,
        matchedOn: p.p1.name.toLowerCase().includes(q) ? p.p1.name : p.p2.name,
      }));

    const teamMatches = teams
      .filter((t) => t.name.toLowerCase().includes(q))
      .map((t) => ({
        type: "team" as const,
        id: t.id,
        label: t.name,
        matchedOn: t.name,
      }));

    return { matches: [...pairMatches, ...teamMatches].slice(0, 3) };
  },
});
