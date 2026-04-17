"use client";

type Props = {
  currentPage: string | null;
  onPick: (prompt: string) => void;
};

function getPrompts(currentPage: string | null): string[] {
  if (!currentPage) return defaultPrompts();
  if (currentPage.startsWith("/d/"))
    return [
      "Bảng điểm hiện tại của bảng này?",
      "Xác suất cặp đầu bảng vào vòng trong?",
      "Cặp nào đang có phong độ tốt nhất?",
      "Còn bao nhiêu trận chưa đánh?",
      "Giải thích luật tiebreaker",
    ];
  if (currentPage.startsWith("/t/"))
    return [
      "Đội nào dẫn đầu bảng?",
      "Xác suất đội đầu bảng vào vòng trong?",
      "Lịch trận tiếp theo của bảng?",
      "Đội nào đang có phong độ tốt nhất?",
      "Giải thích luật tiebreaker",
    ];
  return defaultPrompts();
}

function defaultPrompts(): string[] {
  return [
    "Giải này có thể lệ gì?",
    "Hôm nay có trận nào?",
    "Ai đang dẫn đầu các bảng?",
    "Cơ cấu vòng knockout thế nào?",
    "Nội dung đôi có bao nhiêu bảng?",
  ];
}

export function SuggestedPrompts({ currentPage, onPick }: Props) {
  const prompts = getPrompts(currentPage);
  return (
    <div className="px-4 pb-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Gợi ý câu hỏi
      </p>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="text-xs rounded-full border bg-background px-3 py-1.5 hover:bg-muted transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
