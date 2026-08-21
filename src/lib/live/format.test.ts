import { describe, expect, test } from "vitest";
import {
  formatSets,
  matchTimeAt,
  diffLabel,
  shortGroupName,
  statusLabel,
  isGroupComplete,
  advancesToKo,
  timeLabel,
} from "./format";
import type { SetScore } from "@/lib/schemas/match";

const s = (a: number, b: number): SetScore => ({ a, b });

describe("formatSets", () => {
  test("nối các ván bằng dấu chấm giữa", () => {
    expect(formatSets([s(11, 8), s(11, 6)])).toBe("11–8 · 11–6");
  });

  test("trận chưa đá trả về chuỗi rỗng", () => {
    expect(formatSets([])).toBe("");
  });
});

describe("matchTimeAt", () => {
  test("trận đầu đúng giờ khởi tranh", () => {
    expect(matchTimeAt("13:00", 15, 0)).toBe("13:00");
  });

  test("trận thứ 10 của bảng là 15:15", () => {
    expect(matchTimeAt("13:00", 15, 9)).toBe("15:15");
  });

  test("cộng qua mốc giờ tròn", () => {
    expect(matchTimeAt("13:00", 15, 4)).toBe("14:00");
  });

  test("giữ hai chữ số cho phút", () => {
    expect(matchTimeAt("09:00", 15, 1)).toBe("09:15");
  });
});

describe("diffLabel", () => {
  test("hiệu số dương có dấu cộng", () => {
    expect(diffLabel(7)).toBe("+7");
  });

  test("hiệu số âm giữ dấu trừ", () => {
    expect(diffLabel(-3)).toBe("-3");
  });

  test("bằng không không mang dấu", () => {
    expect(diffLabel(0)).toBe("0");
  });
});

describe("shortGroupName", () => {
  test("bỏ tiền tố 'Bảng'", () => {
    expect(shortGroupName("Bảng A")).toBe("A");
  });

  test("tên vốn đã ngắn thì giữ nguyên", () => {
    expect(shortGroupName("A")).toBe("A");
  });
});

describe("statusLabel", () => {
  test("từng trạng thái có nhãn tiếng Việt riêng", () => {
    expect(statusLabel("scheduled")).toBe("Chưa đấu");
    expect(statusLabel("live")).toBe("Đang đấu");
    expect(statusLabel("done")).toBe("Xong");
    expect(statusLabel("forfeit")).toBe("Bỏ cuộc");
  });
});

describe("isGroupComplete", () => {
  test("còn trận chưa đấu thì bảng chưa xong", () => {
    expect(isGroupComplete([{ status: "done" }, { status: "scheduled" }])).toBe(false);
  });

  test("trận đang đấu cũng tính là chưa xong", () => {
    expect(isGroupComplete([{ status: "done" }, { status: "live" }])).toBe(false);
  });

  test("bỏ cuộc vẫn tính là đã phân định", () => {
    expect(isGroupComplete([{ status: "done" }, { status: "forfeit" }])).toBe(true);
  });

  test("bảng chưa có trận nào thì chưa xong", () => {
    expect(isGroupComplete([])).toBe(false);
  });
});

describe("advancesToKo", () => {
  test("hạng trong suất đi tiếp, bảng đã xong", () => {
    expect(advancesToKo(2, true, 2)).toBe(true);
  });

  test("hạng ngoài suất đi tiếp", () => {
    expect(advancesToKo(3, true, 2)).toBe(false);
  });

  test("bảng chưa xong thì chưa ai chắc suất", () => {
    expect(advancesToKo(1, false, 2)).toBe(false);
  });
});

describe("timeLabel", () => {
  test("quy về giờ Việt Nam, không theo múi giờ máy chạy", () => {
    // 06:05 UTC = 13:05 tại TP.HCM (UTC+7) — đúng giờ khởi tranh.
    expect(timeLabel(new Date("2026-08-22T06:05:00Z"))).toBe("13:05");
  });

  test("giữ hai chữ số cho giờ", () => {
    expect(timeLabel(new Date("2026-08-22T02:30:00Z"))).toBe("09:30");
  });

  test("qua nửa đêm giờ Việt Nam", () => {
    expect(timeLabel(new Date("2026-08-21T17:20:00Z"))).toBe("00:20");
  });
});
