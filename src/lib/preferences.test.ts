import { describe, expect, test } from "vitest";
import {
  FONT_SIZE_LEVELS,
  FONT_SIZE_STORAGE_KEY,
  ONBOARDED_STORAGE_KEY,
  isOnboarded,
  markOnboarded,
  parseFontSize,
  readFontSize,
  writeFontSize,
} from "./preferences";

function makeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    _store: store,
  };
}

function makeDoc() {
  const attrs: Record<string, string> = {};
  return {
    documentElement: {
      getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
      setAttribute: (k: string, v: string) => {
        attrs[k] = v;
      },
    },
    _attrs: attrs,
  };
}

describe("parseFontSize", () => {
  test("accepts all 4 valid levels", () => {
    for (const level of FONT_SIZE_LEVELS) {
      expect(parseFontSize(level)).toBe(level);
    }
  });

  test("returns 'base' for invalid input", () => {
    expect(parseFontSize("huge")).toBe("base");
    expect(parseFontSize(null)).toBe("base");
    expect(parseFontSize(undefined)).toBe("base");
    expect(parseFontSize(17)).toBe("base");
    expect(parseFontSize("")).toBe("base");
  });
});

describe("readFontSize", () => {
  test("reads stored value and parses it", () => {
    const storage = makeStorage({ [FONT_SIZE_STORAGE_KEY]: "lg" });
    expect(readFontSize(storage)).toBe("lg");
  });

  test("returns 'base' when key missing", () => {
    expect(readFontSize(makeStorage())).toBe("base");
  });

  test("returns 'base' when storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(readFontSize(storage)).toBe("base");
  });
});

describe("writeFontSize", () => {
  test("sets DOM attribute and storage key", () => {
    const storage = makeStorage();
    const doc = makeDoc();
    writeFontSize(storage, doc, "xl");
    expect(doc._attrs["data-font-size"]).toBe("xl");
    expect(storage._store[FONT_SIZE_STORAGE_KEY]).toBe("xl");
  });

  test("still sets DOM attribute if storage throws", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    const doc = makeDoc();
    writeFontSize(storage, doc, "sm");
    expect(doc._attrs["data-font-size"]).toBe("sm");
  });
});

describe("onboarded flag", () => {
  test("isOnboarded returns false when flag missing", () => {
    expect(isOnboarded(makeStorage())).toBe(false);
  });

  test("isOnboarded returns true when flag is '1'", () => {
    const storage = makeStorage({ [ONBOARDED_STORAGE_KEY]: "1" });
    expect(isOnboarded(storage)).toBe(true);
  });

  test("isOnboarded returns false when storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(isOnboarded(storage)).toBe(false);
  });

  test("markOnboarded writes '1' to storage", () => {
    const storage = makeStorage();
    markOnboarded(storage);
    expect(storage._store[ONBOARDED_STORAGE_KEY]).toBe("1");
  });

  test("markOnboarded does not throw when storage throws", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    expect(() => markOnboarded(storage)).not.toThrow();
  });
});
