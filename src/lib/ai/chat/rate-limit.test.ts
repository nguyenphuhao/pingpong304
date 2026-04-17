import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetRateLimitForTests } from "./rate-limit";

describe("checkRateLimit — in-memory LRU", () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it("allows first request", () => {
    expect(checkRateLimit("ip-1").allowed).toBe(true);
  });

  it("blocks after exceeding 20 in window", () => {
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit("ip-1").allowed).toBe(true);
    }
    const result = checkRateLimit("ip-1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates across IPs", () => {
    for (let i = 0; i < 20; i++) checkRateLimit("ip-1");
    expect(checkRateLimit("ip-2").allowed).toBe(true);
  });
});
