import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText, gateway } from "ai";
import { AI_MODEL } from "@/lib/ai/model";
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
  /**
   * Lý do phân định của TỪNG nhóm bằng điểm, đã tính sẵn bằng
   * explainDoublesRanking(). Model chỉ được diễn đạt lại, không được tự suy.
   */
  notes: z.array(z.string()).optional().default([]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rows, kind, notes } = RequestSchema.parse(body);

    const diffLabel = kind === "doubles" ? "hiệu số ván" : "hiệu số trận cá nhân";

    const standingsText = rows
      .map(
        (r) =>
          `  Hạng ${r.rank}: ${r.entry} — ${r.points} điểm, ${r.won}T/${r.lost}B, ${diffLabel}: ${r.diff > 0 ? "+" : ""}${r.diff}, ván thắng: ${r.setsWon}`,
      )
      .join("\n");

    // Nhóm bằng điểm là chỗ model hay bịa nhất: trước đây nó chỉ nhận bảng xếp
    // hạng cuối rồi tự suy, và đã nói "hiệu số cao hơn nên xếp trên" cho cặp có
    // hiệu số THẤP hơn. Nay lý do do code tính, model chỉ được thuật lại.
    const factsBlock =
      notes.length > 0
        ? `\nLÝ DO PHÂN ĐỊNH (đã tính sẵn bằng code — SỰ THẬT, phải dùng nguyên):\n` +
          notes.map((n) => `  - ${n}`).join("\n")
        : `\nLÝ DO PHÂN ĐỊNH: KHÔNG có dữ liệu. Nếu có nhóm bằng số trận thắng, chỉ được nói ` +
          `"hai/ba cặp bằng số trận thắng, hệ thống đã phân định theo điều lệ" — TUYỆT ĐỐI ` +
          `không đoán tiêu chí nào đã được dùng.`;

    const prompt = `Bạn là giải thuyết viên giải bóng bàn. Giải thích bảng xếp hạng sau bằng tiếng Việt, ngắn gọn, dễ hiểu.

Nội dung: ${kind === "doubles" ? "Đôi" : "Đồng đội"}

Bảng xếp hạng (thứ tự đã chốt, KHÔNG được sắp lại):
${standingsText}
${factsBlock}

Thứ tự tiêu chí theo điều lệ:
1. Số trận thắng — nhiều hơn xếp trên. ${diffLabel} KHÔNG tham gia ở bước này.
2. Bằng số trận thắng và ĐÚNG 2 cặp → đối đầu trực tiếp. Quyết định luôn, kể cả khi
   cặp thắng có ${diffLabel} thấp hơn.
3. Bằng số trận thắng và TỪ 3 CẶP trở lên → lập bảng con, chỉ tính các trận giữa họ,
   xét lần lượt: thắng bảng con → hiệu số bảng con → ván thắng bảng con.
4. Vẫn bằng nhau hoàn toàn → đồng hạng, BTC bốc thăm.

RÀNG BUỘC BẮT BUỘC:
- Chỉ được nêu lý do có trong phần LÝ DO PHÂN ĐỊNH ở trên. Không tự nghĩ ra tiêu chí khác.
- KHÔNG tự làm phép so sánh số. Mọi con số phải chép nguyên từ dữ liệu đã cho.
- KHÔNG bao giờ viết "hiệu số cao hơn nên xếp trên" trừ khi LÝ DO PHÂN ĐỊNH nói đúng như vậy.
- Nếu một cặp xếp trên dù ${diffLabel} thấp hơn, phải nói rõ vì sao — đây là chỗ người xem
  dễ tưởng hệ thống tính sai nhất.

Nhiệm vụ: giải thích ngắn gọn vì sao mỗi cặp ở vị trí đó. Dùng gạch đầu dòng, tối đa 220 từ.`;

    const result = await generateText({
      model: gateway(AI_MODEL),
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
