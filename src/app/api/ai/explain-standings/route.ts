import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText, gateway } from "ai";
// Auth removed — this endpoint is safe for public use (read-only AI analysis)

const StandingRowSchema = z.object({
  entry: z.string(),
  played: z.number(),
  won: z.number(),
  lost: z.number(),
  diff: z.number(),
  setsWon: z.number(),
  setsLost: z.number(),
  points: z.number(),
  rank: z.number(),
});

const RequestSchema = z.object({
  rows: z.array(StandingRowSchema).min(1),
  kind: z.enum(["doubles", "team"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rows, kind } = RequestSchema.parse(body);

    const diffLabel = kind === "doubles" ? "hiệu số ván" : "hiệu số trận cá nhân";

    const standingsText = rows
      .map(
        (r) =>
          `  Hạng ${r.rank}: ${r.entry} — ${r.points} điểm, ${r.won}T/${r.lost}B, ${diffLabel}: ${r.diff > 0 ? "+" : ""}${r.diff}, ván thắng: ${r.setsWon}`,
      )
      .join("\n");

    const prompt = `Bạn là giải thuyết viên giải bóng bàn. Giải thích bảng xếp hạng sau bằng tiếng Việt, ngắn gọn, dễ hiểu.

Nội dung: ${kind === "doubles" ? "Đôi" : "Đồng đội"}

Bảng xếp hạng:
${standingsText}

Quy tắc xếp hạng (theo thứ tự ưu tiên):
1. Số trận thắng (nhiều hơn = xếp trên)
2. Nếu bằng trận thắng → đối đầu trực tiếp (ai thắng trận giữa 2 người xếp trên)
3. Nếu vẫn bằng → ${diffLabel} (cao hơn = xếp trên)
4. Nếu vẫn bằng → tổng số ván thắng (nhiều hơn = xếp trên)
5. Nếu 3+ đội bằng điểm → tính mini-league chỉ giữa các đội bằng điểm rồi áp dụng lại quy tắc trên

Nhiệm vụ:
- Giải thích TẠI SAO mỗi đội/cặp xếp ở vị trí đó
- Đặc biệt chú ý giải thích khi có bằng điểm — dùng tiêu chí nào để phân biệt?
- Nếu không có bằng điểm, chỉ cần nói ngắn gọn
- Viết tự nhiên, dùng bullet points, tối đa 200 từ`;

    const result = await generateText({
      model: gateway("anthropic/claude-haiku-4.5"),
      prompt,
      temperature: 0,
      providerOptions: {
        gateway: { tags: ["feature:standings-explain"] },
      },
    });

    return NextResponse.json({ data: result.text, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { data: null, error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    console.error("[ai/explain-standings]", err);
    return NextResponse.json(
      { data: null, error: "AI không xử lý được" },
      { status: 500 },
    );
  }
}
