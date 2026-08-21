import { describe, expect, test } from "vitest";
import { LIVE_TABS, activeTabId, stepFontSize } from "./nav";

describe("LIVE_TABS", () => {
  test("ba tab theo đúng thứ tự người xem đi qua giải", () => {
    expect(LIVE_TABS.map((t) => t.id)).toEqual(["lich", "sodo", "bxh"]);
  });

  test("mỗi tab có nhãn chữ — không dùng icon trần", () => {
    for (const tab of LIVE_TABS) {
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });
});

describe("activeTabId", () => {
  test("gốc /live là tab vòng bảng", () => {
    expect(activeTabId("/live")).toBe("lich");
  });

  test("bỏ qua dấu gạch chéo cuối", () => {
    expect(activeTabId("/live/")).toBe("lich");
  });

  test("route con khớp tab của nó, không rơi về tab gốc", () => {
    expect(activeTabId("/live/so-do")).toBe("sodo");
    expect(activeTabId("/live/bxh")).toBe("bxh");
  });

  test("query hay đoạn con vẫn giữ đúng tab", () => {
    expect(activeTabId("/live/so-do/")).toBe("sodo");
  });

  test("route ngoài /live không khớp tab nào", () => {
    expect(activeTabId("/d")).toBeNull();
    expect(activeTabId("/")).toBeNull();
  });

  test("route chỉ trùng tiền tố chữ cái thì không khớp", () => {
    expect(activeTabId("/livestream")).toBeNull();
  });
});

describe("stepFontSize", () => {
  test("tăng một bậc", () => {
    expect(stepFontSize("base", 1)).toBe("lg");
  });

  test("giảm một bậc", () => {
    expect(stepFontSize("lg", -1)).toBe("base");
  });

  test("đã lớn nhất thì đứng yên", () => {
    expect(stepFontSize("xl", 1)).toBe("xl");
  });

  test("đã nhỏ nhất thì đứng yên", () => {
    expect(stepFontSize("sm", -1)).toBe("sm");
  });
});
