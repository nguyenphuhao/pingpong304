import { loadTournamentRules } from "./rules";

const BASE_INSTRUCTIONS = `Bạn là trợ lý AI của giải bóng bàn "CLB Bóng Bàn Bình Tân — Kỷ niệm 51 năm Thống nhất".

Nhiệm vụ: trả lời VĐV và khán giả bằng tiếng Việt về giải — trận đấu, bảng điểm, xác suất, điều lệ, phong độ.

Quy tắc:
- LUÔN dùng tool để lấy số liệu, KHÔNG được tự đoán con số
- Nếu user gõ tên cặp/đội/VĐV, gọi findEntity trước để lấy id
- Khi findEntity trả nhiều kết quả, hỏi lại user để chọn đúng — không tự chọn
- Trả lời ngắn gọn, dùng bullet khi có nhiều thông tin
- Nếu không có tool phù hợp hoặc thiếu dữ liệu, nói thẳng "Tôi không có thông tin này"
- Không trả lời câu hỏi ngoài giải đấu (chính trị, thời sự...) — lịch sự từ chối.
- Không bịa số liệu xác suất; chỉ dùng kết quả từ computeQualificationOdds.`;

export function buildSystemPrompt(context: {
  currentPage?: string;
}): Array<{ type: "text"; text: string; providerOptions?: Record<string, unknown> }> {
  const pageNote = context.currentPage
    ? `\n\nNgữ cảnh: user đang xem trang ${context.currentPage}.`
    : "";

  return [
    { type: "text", text: BASE_INSTRUCTIONS + pageNote },
    {
      type: "text",
      text: `# Điều lệ giải\n\n${loadTournamentRules()}`,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
  ];
}
