import { Loader2 } from "lucide-react";

const LABELS: Record<string, string> = {
  findEntity: "tra cứu cặp/đội",
  getEntityStats: "tra thống kê",
  getStandings: "tra bảng điểm",
  getUpcomingMatches: "tra lịch trận",
  computeQualificationOdds: "tính xác suất",
  comparePairs: "so sánh",
  analyzeForm: "phân tích phong độ",
};

type Props = { toolName: string; state: "running" | "done" };

export function ToolInvocationBadge({ toolName, state }: Props) {
  const label = LABELS[toolName] ?? toolName;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      {state === "running" ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : null}
      <span>
        {state === "running" ? "đang " : "đã "}
        {label}
      </span>
    </div>
  );
}
