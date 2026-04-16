import { describe, expect, test, vi } from "vitest";

// Mock next/headers BEFORE importing auth
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { requireAdmin, UnauthorizedError } from "./auth";

describe("requireAdmin", () => {
  test("throws UnauthorizedError when cookie missing", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("throws when cookie value is wrong", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: "wrong", name: "pp_admin" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test("resolves when cookie present with correct value", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: "ok", name: "pp_admin" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
    await expect(requireAdmin()).resolves.toBeUndefined();
  });
});
