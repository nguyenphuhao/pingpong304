import { describe, expect, test } from "vitest";
import { err, ok } from "./response";

describe("response helpers", () => {
  test("ok() returns { data, error: null } with status 200 by default", async () => {
    const res = ok({ id: "d01" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { id: "d01" }, error: null });
  });

  test("ok() accepts custom status", async () => {
    const res = ok({ id: "d37" }, 201);
    expect(res.status).toBe(201);
  });

  test("err() returns { data: null, error: message } with status 500 by default", async () => {
    const res = err("boom");
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ data: null, error: "boom" });
  });

  test("err() accepts custom status", async () => {
    const res = err("not found", 404);
    expect(res.status).toBe(404);
  });
});
