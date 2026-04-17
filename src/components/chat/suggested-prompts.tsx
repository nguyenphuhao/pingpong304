"use client";

type Props = {
  currentPage: string | null;
  onPick: (prompt: string) => void;
};

function getPrompts(currentPage: string | null): string[] {
  if (!currentPage) return defaultPrompts();
  if (currentPage.startsWith("/d/"))
    return [
      "Xác suất cặp đầu bảng vào vòng trong?",
      "Bảng điểm hiện tại của bảng này?",
      "Cặp nào đang có phong độ tốt nhất?",
    ];
  if (currentPage.startsWith("/t/"))
    return [
      "Đội nào dẫn đầu bảng?",
      "Xác suất đội đầu bảng vào vòng trong?",
      "Lịch trận tiếp theo của bảng?",
    ];
  return defaultPrompts();
}

function defaultPrompts(): string[] {
  return [
    "Giải này có thể lệ gì đặc biệt?",
    "Hôm nay có trận nào?",
    "Ai đang dẫn đầu các bảng?",
  ];
}

export function SuggestedPrompts({ currentPage, onPick }: Props) {
  const prompts = getPrompts(currentPage);
  return (
    <div className="px-4 pb-2 flex flex-wrap gap-2">
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          className="text-xs rounded-full border bg-background px-3 py-1.5 hover:bg-muted"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
