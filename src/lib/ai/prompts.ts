type SingleMatchContext = {
  id: string;
  type: "doubles" | "team";
  bestOf: 3 | 5;
  sideA: string;
  sideB: string;
  subMatches?: Array<{
    label: string;
    kind: "singles" | "doubles";
    bestOf: 3 | 5;
  }>;
};

type BatchGroupContext = {
  type: "doubles" | "team";
  matches: Array<{
    id: string;
    sideA: string;
    sideB: string;
    bestOf: 3 | 5;
    hasResult: boolean;
    subMatches?: Array<{
      label: string;
      kind: "singles" | "doubles";
      bestOf: 3 | 5;
    }>;
  }>;
};

export function buildSinglePrompt(match: SingleMatchContext): string {
  const subMatchesSection = match.subMatches
    ? `\nCác trận con:\n${match.subMatches.map((s) => `- ${s.label} (${s.kind}, best of ${s.bestOf})`).join("\n")}`
    : "";

  return `Bạn là trợ lý nhập kết quả trận đấu bóng bàn.

Trận đang diễn ra (matchId: "${match.id}"):
- ${match.sideA} vs ${match.sideB}
- Loại: ${match.type === "doubles" ? "đôi" : "đồng đội"}
- Best of ${match.bestOf} sets${subMatchesSection}

Nhiệm vụ:
- Parse kết quả từ text hoặc hình ảnh người dùng gửi
- Điểm mỗi set là số nguyên 0-99
- Không đoán mò — nếu không đọc được rõ ràng hoặc không chắc chắn, từ chối`;
}

export function buildBatchPrompt(group: BatchGroupContext): string {
  const matchList = group.matches
    .map((m) => {
      const status = m.hasResult ? " (đã có kết quả)" : "";
      const subs = m.subMatches
        ? `\n    Trận con: ${m.subMatches.map((s) => `${s.label} (${s.kind}, bo${s.bestOf})`).join(", ")}`
        : "";
      return `  - matchId: "${m.id}" | ${m.sideA} vs ${m.sideB} | bo${m.bestOf}${status}${subs}`;
    })
    .join("\n");

  return `Bạn là trợ lý nhập kết quả bóng bàn.

Các trận trong bảng (${group.type === "doubles" ? "đôi" : "đồng đội"}):
${matchList}

Nhiệm vụ:
- Parse tất cả kết quả có trong input (text hoặc hình ảnh)
- Match tên đội/cặp với danh sách trên (chấp nhận viết tắt, tên gần đúng)
- Dùng matchId tương ứng cho mỗi trận parse được
- Trận nào không khớp tên → đưa vào "unmatched"
- Đánh dấu alreadyHasResult=true nếu trận đó đã có kết quả
- Không đoán mò — nếu không chắc chắn về trận nào, bỏ qua trận đó`;
}
