import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/ai/chat/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    streamText: vi.fn(),
    convertToModelMessages: vi.fn().mockResolvedValue([]),
  };
});

import { checkRateLimit } from "@/lib/ai/chat/rate-limit";
import { streamText } from "ai";

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when rate limit exceeded", async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({
      allowed: false,
      retryAfterSec: 3600,
    });
    const req = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4", "content-type": "application/json" },
      body: JSON.stringify({ messages: [], context: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("rejects empty messages with 400", async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({ allowed: true });
    const req = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: "not-array", context: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("invokes streamText with tools and system prompt", async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({ allowed: true });
    (streamText as ReturnType<typeof vi.fn>).mockReturnValue({
      toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
    });
    const req = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
        context: { currentPage: "/d/g1" },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(streamText).toHaveBeenCalled();
    const call = (streamText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.tools).toBeDefined();
    expect(Object.keys(call.tools)).toContain("computeQualificationOdds");
  });
});
