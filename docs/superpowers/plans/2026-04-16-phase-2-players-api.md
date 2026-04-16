# Phase 2: Players API + Admin UI Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Players CRUD API + admin UI swap for both Doubles and Teams content, replacing `_mock.ts` players with Supabase-backed data. Other sections (Pairs, Teams, Groups, Matches, KO) still read from mock.

**Architecture:** RSC reads players directly from `supabaseServer`. Client UI writes through Route Handlers at `/api/{doubles,teams}/players/*`. Auth via `requireAdmin()` helper. Validation via shared zod schema. UX: skeleton during initial load, `useOptimistic` + sonner toasts during mutations. Unit tests with mocked Supabase client, colocated.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Supabase JS v2, Zod 3, Vitest 2, Sonner 2.

**Spec reference:** `docs/superpowers/specs/2026-04-16-phase-2-players-api-design.md`

**Branch:** `feat/supabase-phase-2` (already checked out)

**Checkpoint-driven execution:** 4 checkpoints (A, B, C, D). STOP at each gate and wait for user confirmation before continuing. Do not proceed past a checkpoint until user says "ok" / "tiếp tục".

---

## Checkpoint A — Setup, Helpers, Schema

Install test/validation deps, add shared helpers, validate schema with tests. No UI or API code yet.

### Task A1: Install dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install zod + vitest**

```bash
cd /Users/haonguyen/Projects/pingpong304
npm install zod
npm install -D vitest @vitest/ui @vitejs/plugin-react
```

- [ ] **Step 2: Verify install**

Run: `npm ls zod vitest @vitest/ui`
Expected: all three listed with versions.

- [ ] **Step 3: Add test script to package.json**

Edit `package.json` scripts block, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

Keep existing `dev`, `build`, `start`, `lint` unchanged.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zod and vitest for phase 2"
```

### Task A2: Vitest config + setup file

**Files:** `vitest.config.ts`, `src/test/setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Create `src/test/setup.ts`**

```ts
// Vitest global setup. Runs once per test file before tests.
// Keep minimal — individual tests own their mocks.

import { beforeEach, vi } from "vitest";

// Mock env vars required by Supabase clients so imports don't throw.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test";
process.env.SUPABASE_SECRET_KEY = "sk_test";

beforeEach(() => {
  vi.resetAllMocks();
});
```

- [ ] **Step 3: Create `src/test/supabase-mock.ts`** (shared chain helper)

```ts
// Shared mock for Supabase query builder chain.
// Usage:
//   const sb = makeSupabaseMock({ data: [...], error: null });
//   vi.mocked(supabaseServer.from).mockReturnValue(sb.chain);
//   await GET(req);
//   expect(sb.from).toHaveBeenCalledWith("doubles_players");

import { vi } from "vitest";

export type SupabaseResult<T = unknown> = { data: T; error: unknown };

export function makeSupabaseChain<T = unknown>(result: SupabaseResult<T>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const thenable = {
    then: (resolve: (v: SupabaseResult<T>) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  chain.select = vi.fn().mockReturnValue({ ...chain, ...thenable });
  chain.insert = vi.fn().mockReturnValue({ ...chain, ...thenable });
  chain.update = vi.fn().mockReturnValue({ ...chain, ...thenable });
  chain.delete = vi.fn().mockReturnValue({ ...chain, ...thenable });
  chain.eq = vi.fn().mockReturnValue({ ...chain, ...thenable });
  chain.or = vi.fn().mockReturnValue({ ...chain, ...thenable });
  chain.like = vi.fn().mockReturnValue({ ...chain, ...thenable });
  chain.contains = vi.fn().mockReturnValue({ ...chain, ...thenable });
  chain.single = vi.fn().mockResolvedValue(result);
  chain.limit = vi.fn().mockReturnValue({ ...chain, ...thenable });
  chain.order = vi.fn().mockReturnValue({ ...chain, ...thenable });
  return chain;
}
```

- [ ] **Step 4: Smoke test vitest**

Create `src/test/smoke.test.ts` temporarily:

```ts
import { expect, test } from "vitest";
test("smoke", () => expect(1 + 1).toBe(2));
```

Run: `npm test`
Expected: 1 test passes.

Delete `src/test/smoke.test.ts` after verify.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/test/setup.ts src/test/supabase-mock.ts
git commit -m "chore: vitest config + supabase mock helper"
```

### Task A3: Response helpers

**Files:** `src/lib/api/response.ts`, `src/lib/api/response.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/api/response.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- src/lib/api/response.test.ts`
Expected: FAIL — module `./response` not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/api/response.ts`:

```ts
import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data, error: null }, { status });
}

export function err(message: string, status = 500): NextResponse {
  return NextResponse.json({ data: null, error: message }, { status });
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/lib/api/response.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/response.ts src/lib/api/response.test.ts
git commit -m "feat(api): add ok/err response helpers"
```

### Task A4: Zod schema

**Files:** `src/lib/schemas/player.ts`, `src/lib/schemas/player.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/schemas/player.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { PlayerInputSchema, PlayerPatchSchema } from "./player";

describe("PlayerInputSchema", () => {
  test("accepts valid input", () => {
    const r = PlayerInputSchema.safeParse({
      name: "Nguyễn Văn A",
      gender: "M",
      club: "CLB Bình Tân",
      phone: "0901234567",
    });
    expect(r.success).toBe(true);
  });

  test("accepts empty phone", () => {
    const r = PlayerInputSchema.safeParse({
      name: "A",
      gender: "F",
      club: "",
      phone: "",
    });
    expect(r.success).toBe(true);
  });

  test("accepts missing phone", () => {
    const r = PlayerInputSchema.safeParse({ name: "A", gender: "M", club: "" });
    expect(r.success).toBe(true);
  });

  test("rejects empty name", () => {
    const r = PlayerInputSchema.safeParse({ name: "", gender: "M", club: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(["name"]);
      expect(r.error.issues[0].message).toContain("không được");
    }
  });

  test("rejects name over 80 chars", () => {
    const r = PlayerInputSchema.safeParse({
      name: "x".repeat(81),
      gender: "M",
      club: "",
    });
    expect(r.success).toBe(false);
  });

  test("rejects invalid gender", () => {
    const r = PlayerInputSchema.safeParse({
      name: "A",
      gender: "X",
      club: "",
    });
    expect(r.success).toBe(false);
  });

  test("rejects phone over 20 chars", () => {
    const r = PlayerInputSchema.safeParse({
      name: "A",
      gender: "M",
      club: "",
      phone: "1".repeat(21),
    });
    expect(r.success).toBe(false);
  });

  test("trims whitespace", () => {
    const r = PlayerInputSchema.safeParse({
      name: "  Nguyễn  ",
      gender: "M",
      club: " CLB ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Nguyễn");
      expect(r.data.club).toBe("CLB");
    }
  });
});

describe("PlayerPatchSchema", () => {
  test("accepts partial input", () => {
    const r = PlayerPatchSchema.safeParse({ name: "Mới" });
    expect(r.success).toBe(true);
  });

  test("accepts empty object (no-op patch)", () => {
    const r = PlayerPatchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  test("still validates individual fields", () => {
    const r = PlayerPatchSchema.safeParse({ gender: "X" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- src/lib/schemas/player.test.ts`
Expected: FAIL — module `./player` not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/schemas/player.ts`:

```ts
import { z } from "zod";

export const PlayerInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên VĐV không được để trống")
    .max(80, "Tên VĐV tối đa 80 ký tự"),
  gender: z.enum(["M", "F"], { message: "Chọn Nam hoặc Nữ" }),
  club: z.string().trim().max(80, "CLB tối đa 80 ký tự").default(""),
  phone: z
    .string()
    .trim()
    .max(20, "Số điện thoại tối đa 20 ký tự")
    .optional()
    .or(z.literal("")),
});

export const PlayerPatchSchema = PlayerInputSchema.partial();

export type PlayerInput = z.infer<typeof PlayerInputSchema>;
export type PlayerPatch = z.infer<typeof PlayerPatchSchema>;
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/lib/schemas/player.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/player.ts src/lib/schemas/player.test.ts
git commit -m "feat(schemas): add Player zod schema"
```

### Task A5: `requireAdmin()` helper

**Files:** modify `src/lib/auth.ts`, create `src/lib/auth.test.ts`

- [ ] **Step 1: Read existing `src/lib/auth.ts`**

Run: `cat src/lib/auth.ts`
Expected: already contains `SESSION_COOKIE`, `SESSION_VALUE`, `verifyPassword`, `isAdmin`, `createSession`, `destroySession`.

- [ ] **Step 2: Write failing test**

Create `src/lib/auth.test.ts`:

```ts
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
```

- [ ] **Step 3: Run test to verify fail**

Run: `npm test -- src/lib/auth.test.ts`
Expected: FAIL — `requireAdmin` and/or `UnauthorizedError` not exported.

- [ ] **Step 4: Modify `src/lib/auth.ts`**

Append to the existing file (do not modify existing exports):

```ts
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new UnauthorizedError();
}
```

- [ ] **Step 5: Run test to verify pass**

Run: `npm test -- src/lib/auth.test.ts`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat(auth): add requireAdmin helper + UnauthorizedError"
```

### Task A6: Toaster position

**Files:** `src/app/layout.tsx`

- [ ] **Step 1: Read existing file**

Run: `cat src/app/layout.tsx | grep -n Toaster`
Expected: line 35 or similar renders `<Toaster />` with no position prop.

- [ ] **Step 2: Update Toaster**

Find `<Toaster />` in `src/app/layout.tsx` and change to:

```tsx
<Toaster position="top-center" richColors />
```

(`richColors` enables colored success/error backgrounds. Keep other props/imports unchanged.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "chore(ui): Toaster position top-center"
```

---

### 🛑 CHECKPOINT A — User verification

**STOP. Report to user:**

> Checkpoint A xong. Đã có:
> - zod + vitest cài xong, `npm test` chạy được
> - `ok()` / `err()` helpers + 4 tests pass
> - `PlayerInputSchema` + `PlayerPatchSchema` + 11 tests pass
> - `requireAdmin()` + `UnauthorizedError` trong `src/lib/auth.ts` + 3 tests pass
> - Toaster position top-center
> - Total: ~18 tests pass, typecheck clean
>
> Báo "ok" để tiếp Checkpoint B (Doubles Players API).

**Do not proceed until user confirms.**

---

## Checkpoint B — Doubles Players API

Implement 5 Doubles endpoints, TDD, mocked Supabase. No UI changes.

### Task B1: `GET /api/doubles/players`

**Files:**
- Create: `src/app/api/doubles/players/route.ts`
- Create: `src/app/api/doubles/players/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/doubles/players/route.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { GET } from "./route";

describe("GET /api/doubles/players", () => {
  test("returns players array on success", async () => {
    const players = [
      { id: "d01", name: "A", phone: "", gender: "M", club: "" },
      { id: "d02", name: "B", phone: "", gender: "F", club: "" },
    ];
    const chain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: players, error: null });
    expect(supabaseServer.from).toHaveBeenCalledWith("doubles_players");
  });

  test("returns 500 on supabase error", async () => {
    const chain = makeSupabaseChain({ data: null, error: { message: "db down" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("db down");
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- src/app/api/doubles/players/route.test.ts`
Expected: FAIL — `./route` module not found.

- [ ] **Step 3: Write implementation**

Create `src/app/api/doubles/players/route.ts`:

```ts
import { err, ok } from "@/lib/api/response";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id, name, phone, gender, club")
    .order("id");

  if (error) return err(error.message);
  return ok(data);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/app/api/doubles/players/route.test.ts`
Expected: 2 GET tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/players/route.ts src/app/api/doubles/players/route.test.ts
git commit -m "feat(api): GET /api/doubles/players"
```

### Task B2: `POST /api/doubles/players` with retry

**Files:** modify `src/app/api/doubles/players/route.ts` and `route.test.ts`

- [ ] **Step 1: Extend test file**

Append to `src/app/api/doubles/players/route.test.ts`:

```ts
import { POST } from "./route";
import { cookies } from "next/headers";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function mockNoCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("POST /api/doubles/players", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/api/doubles/players", {
      method: "POST",
      body: JSON.stringify({ name: "A", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid body", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/api/doubles/players", {
      method: "POST",
      body: JSON.stringify({ name: "", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tên|name/i);
  });

  test("returns 201 and generates next id", async () => {
    mockAdminCookie();
    // 1st from(): select existing ids — return d01..d05
    // 2nd from(): insert — return the new row
    const selectChain = makeSupabaseChain({
      data: [{ id: "d01" }, { id: "d02" }, { id: "d05" }],
      error: null,
    });
    const inserted = { id: "d06", name: "Test", gender: "M", club: "CLB", phone: "" };
    const insertChain = makeSupabaseChain({ data: inserted, error: null });
    insertChain.single = vi.fn().mockResolvedValue({ data: inserted, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/doubles/players", {
      method: "POST",
      body: JSON.stringify({ name: "Test", gender: "M", club: "CLB" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("d06");
  });

  test("retries on id conflict (23505)", async () => {
    mockAdminCookie();
    // select returns d01..d03 → nextId = d04
    const selectChain = makeSupabaseChain({
      data: [{ id: "d01" }, { id: "d02" }, { id: "d03" }],
      error: null,
    });
    // 1st insert fails with 23505, 2nd select + 2nd insert succeed
    const insertFail = makeSupabaseChain({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    insertFail.single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const selectChain2 = makeSupabaseChain({
      data: [{ id: "d01" }, { id: "d02" }, { id: "d03" }, { id: "d04" }],
      error: null,
    });
    const insertOk = makeSupabaseChain({
      data: { id: "d05", name: "X", gender: "M", club: "", phone: "" },
      error: null,
    });
    insertOk.single = vi.fn().mockResolvedValue({
      data: { id: "d05", name: "X", gender: "M", club: "", phone: "" },
      error: null,
    });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertFail as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(selectChain2 as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertOk as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/doubles/players", {
      method: "POST",
      body: JSON.stringify({ name: "X", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("d05");
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- src/app/api/doubles/players/route.test.ts`
Expected: POST tests FAIL — `POST` not exported.

- [ ] **Step 3: Extend route implementation**

Replace `src/app/api/doubles/players/route.ts` with:

```ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { PlayerInputSchema } from "@/lib/schemas/player";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id, name, phone, gender, club")
    .order("id");

  if (error) return err(error.message);
  return ok(data);
}

async function nextDoublesPlayerId(): Promise<string> {
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id")
    .like("id", "d%");
  if (error) throw new Error(error.message);
  const nums = (data ?? [])
    .map((r: { id: string }) => parseInt(r.id.slice(1), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `d${String(next).padStart(2, "0")}`;
}

async function insertWithRetry(
  body: z.infer<typeof PlayerInputSchema>,
  attempt = 0,
): Promise<unknown> {
  if (attempt >= 3) throw new Error("Không sinh được id sau 3 lần thử");
  const id = await nextDoublesPlayerId();
  const row = {
    id,
    name: body.name,
    gender: body.gender,
    club: body.club ?? "",
    phone: body.phone && body.phone.length > 0 ? body.phone : null,
  };
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .insert(row)
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return insertWithRetry(body, attempt + 1);
    }
    throw new Error(error.message);
  }
  return data;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = PlayerInputSchema.parse(body);
    const created = await insertWithRetry(parsed);
    return ok(created, 201);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/app/api/doubles/players/route.test.ts`
Expected: all GET + POST tests pass (6 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/players/route.ts src/app/api/doubles/players/route.test.ts
git commit -m "feat(api): POST /api/doubles/players with id gen + retry"
```

### Task B3: `GET /api/doubles/players/[id]`

**Files:**
- Create: `src/app/api/doubles/players/[id]/route.ts`
- Create: `src/app/api/doubles/players/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/doubles/players/[id]/route.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { GET } from "./route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/doubles/players/[id]", () => {
  test("returns 200 with player on found", async () => {
    const player = { id: "d01", name: "A", gender: "M", club: "", phone: null };
    const chain = makeSupabaseChain({ data: player, error: null });
    chain.single = vi.fn().mockResolvedValue({ data: player, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET(new Request("http://localhost/x"), ctx("d01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(player);
  });

  test("returns 404 when not found", async () => {
    const chain = makeSupabaseChain({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    chain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET(new Request("http://localhost/x"), ctx("dxx"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- "src/app/api/doubles/players/\[id\]"`
Expected: FAIL — `./route` module not found.

- [ ] **Step 3: Write GET handler**

Create `src/app/api/doubles/players/[id]/route.ts`:

```ts
import { err, ok } from "@/lib/api/response";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id, name, phone, gender, club")
    .eq("id", id)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
    return err(error.message);
  }
  return ok(data);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- "src/app/api/doubles/players/\[id\]"`
Expected: 2 GET tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/players/\[id\]/
git commit -m "feat(api): GET /api/doubles/players/[id]"
```

### Task B4: `PATCH /api/doubles/players/[id]`

**Files:** modify both files from Task B3

- [ ] **Step 1: Extend test file**

Append to `src/app/api/doubles/players/[id]/route.test.ts`:

```ts
import { PATCH } from "./route";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function mockNoCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("PATCH /api/doubles/players/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "Mới" }),
    });
    const res = await PATCH(req, ctx("d01"));
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid body", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ gender: "X" }),
    });
    const res = await PATCH(req, ctx("d01"));
    expect(res.status).toBe(400);
  });

  test("returns 200 with updated player", async () => {
    mockAdminCookie();
    const updated = { id: "d01", name: "Mới", gender: "M", club: "", phone: null };
    const chain = makeSupabaseChain({ data: updated, error: null });
    chain.single = vi.fn().mockResolvedValue({ data: updated, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "Mới" }),
    });
    const res = await PATCH(req, ctx("d01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Mới");
  });

  test("returns 404 when row not found", async () => {
    mockAdminCookie();
    const chain = makeSupabaseChain({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    chain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "X" }),
    });
    const res = await PATCH(req, ctx("dxx"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- "src/app/api/doubles/players/\[id\]"`
Expected: PATCH tests FAIL — `PATCH` not exported.

- [ ] **Step 3: Extend route**

Append to `src/app/api/doubles/players/[id]/route.ts`:

```ts
import { z } from "zod";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { PlayerPatchSchema } from "@/lib/schemas/player";

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = PlayerPatchSchema.parse(body);

    const update: Record<string, unknown> = {};
    if (parsed.name !== undefined) update.name = parsed.name;
    if (parsed.gender !== undefined) update.gender = parsed.gender;
    if (parsed.club !== undefined) update.club = parsed.club;
    if (parsed.phone !== undefined) {
      update.phone = parsed.phone && parsed.phone.length > 0 ? parsed.phone : null;
    }

    const { data, error } = await supabaseServer
      .from("doubles_players")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
      return err(error.message);
    }
    return ok(data);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

Add imports at top: `import { z } from "zod";`, `import { requireAdmin, UnauthorizedError } from "@/lib/auth";`, `import { PlayerPatchSchema } from "@/lib/schemas/player";`.

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- "src/app/api/doubles/players/\[id\]"`
Expected: GET + PATCH tests pass (6 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/players/\[id\]/route.ts src/app/api/doubles/players/\[id\]/route.test.ts
git commit -m "feat(api): PATCH /api/doubles/players/[id]"
```

### Task B5: `DELETE /api/doubles/players/[id]` with pre-check

**Files:** modify both files from Task B3

- [ ] **Step 1: Extend test file**

Append to `src/app/api/doubles/players/[id]/route.test.ts`:

```ts
import { DELETE } from "./route";

describe("DELETE /api/doubles/players/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const res = await DELETE(new Request("http://localhost/x"), ctx("d01"));
    expect(res.status).toBe(401);
  });

  test("returns 409 when player is in a pair", async () => {
    mockAdminCookie();
    const preCheck = makeSupabaseChain({
      data: [{ id: "p01", p1: "d01", p2: "d02" }],
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      preCheck as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await DELETE(new Request("http://localhost/x"), ctx("d01"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("cặp");
    expect(body.error).toContain("p01");
  });

  test("returns 200 on successful delete", async () => {
    mockAdminCookie();
    // pre-check returns empty
    const preCheck = makeSupabaseChain({ data: [], error: null });
    // delete returns success
    const del = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(preCheck as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(del as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await DELETE(new Request("http://localhost/x"), ctx("d99"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: null, error: null });
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- "src/app/api/doubles/players/\[id\]"`
Expected: DELETE tests FAIL — `DELETE` not exported.

- [ ] **Step 3: Extend route**

Append to `src/app/api/doubles/players/[id]/route.ts`:

```ts
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    // Pre-check: any pair references this player?
    const { data: pairs, error: checkErr } = await supabaseServer
      .from("doubles_pairs")
      .select("id, p1, p2")
      .or(`p1.eq.${id},p2.eq.${id}`);
    if (checkErr) return err(checkErr.message);

    if (pairs && pairs.length > 0) {
      const labels = pairs.map((p: { id: string }) => p.id).join(", ");
      return err(
        `VĐV đang trong ${pairs.length} cặp: ${labels} — xoá cặp trước`,
        409,
      );
    }

    const { error } = await supabaseServer.from("doubles_players").delete().eq("id", id);
    if (error) return err(error.message);
    return ok(null);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- "src/app/api/doubles/players/\[id\]"`
Expected: all GET + PATCH + DELETE tests pass (9 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/doubles/players/\[id\]/route.ts src/app/api/doubles/players/\[id\]/route.test.ts
git commit -m "feat(api): DELETE /api/doubles/players/[id] with FK pre-check"
```

---

### 🛑 CHECKPOINT B — User verification

**STOP. Report to user:**

> Checkpoint B xong. Doubles Players API complete:
> - `GET /api/doubles/players` — list
> - `POST /api/doubles/players` — create với id gen + retry 23505
> - `GET /api/doubles/players/[id]` — detail
> - `PATCH /api/doubles/players/[id]` — partial update
> - `DELETE /api/doubles/players/[id]` — hard delete với FK pre-check
>
> Total ~15 API tests pass. Typecheck clean.
>
> Có thể manual test bằng curl:
> ```bash
> curl http://localhost:3000/api/doubles/players | jq
> ```
>
> Báo "ok" để tiếp Checkpoint C (Teams Players API).

**Do not proceed until user confirms.**

---

## Checkpoint C — Teams Players API

Mirror Checkpoint B on `team_players` table. Delete pre-check uses `teams.members @> ARRAY[id]`.

### Task C1: `GET /api/teams/players`

**Files:**
- Create: `src/app/api/teams/players/route.ts`
- Create: `src/app/api/teams/players/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/teams/players/route.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { GET } from "./route";

describe("GET /api/teams/players", () => {
  test("returns players array on success", async () => {
    const players = [
      { id: "t01", name: "Quốc", phone: "", gender: "M", club: "CLB Bình Tân" },
      { id: "t02", name: "Quy", phone: "", gender: "M", club: "CLB Bình Tân" },
    ];
    const chain = makeSupabaseChain({ data: players, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: players, error: null });
    expect(supabaseServer.from).toHaveBeenCalledWith("team_players");
  });

  test("returns 500 on supabase error", async () => {
    const chain = makeSupabaseChain({ data: null, error: { message: "db down" } });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("db down");
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- src/app/api/teams/players/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `src/app/api/teams/players/route.ts`:

```ts
import { err, ok } from "@/lib/api/response";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name, phone, gender, club")
    .order("id");
  if (error) return err(error.message);
  return ok(data);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/app/api/teams/players/route.test.ts`
Expected: 2 GET tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/players/route.ts src/app/api/teams/players/route.test.ts
git commit -m "feat(api): GET /api/teams/players"
```

### Task C2: `POST /api/teams/players` with retry

**Files:** modify both files from C1

- [ ] **Step 1: Extend test file**

Append to `src/app/api/teams/players/route.test.ts`:

```ts
import { POST } from "./route";
import { cookies } from "next/headers";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function mockNoCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("POST /api/teams/players", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/api/teams/players", {
      method: "POST",
      body: JSON.stringify({ name: "A", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid body", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/api/teams/players", {
      method: "POST",
      body: JSON.stringify({ name: "", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 201 and generates next id with t prefix", async () => {
    mockAdminCookie();
    const selectChain = makeSupabaseChain({
      data: [{ id: "t01" }, { id: "t02" }, { id: "t03" }],
      error: null,
    });
    const inserted = { id: "t04", name: "Test", gender: "M", club: "CLB", phone: "" };
    const insertChain = makeSupabaseChain({ data: inserted, error: null });
    insertChain.single = vi.fn().mockResolvedValue({ data: inserted, error: null });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertChain as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/teams/players", {
      method: "POST",
      body: JSON.stringify({ name: "Test", gender: "M", club: "CLB" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("t04");
  });

  test("retries on id conflict (23505)", async () => {
    mockAdminCookie();
    const selectChain = makeSupabaseChain({
      data: [{ id: "t01" }, { id: "t02" }],
      error: null,
    });
    const insertFail = makeSupabaseChain({ data: null, error: { code: "23505" } });
    insertFail.single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const selectChain2 = makeSupabaseChain({
      data: [{ id: "t01" }, { id: "t02" }, { id: "t03" }],
      error: null,
    });
    const insertOk = makeSupabaseChain({
      data: { id: "t04", name: "X", gender: "M", club: "", phone: "" },
      error: null,
    });
    insertOk.single = vi.fn().mockResolvedValue({
      data: { id: "t04", name: "X", gender: "M", club: "", phone: "" },
      error: null,
    });

    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertFail as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(selectChain2 as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(insertOk as unknown as ReturnType<typeof supabaseServer.from>);

    const req = new Request("http://localhost/api/teams/players", {
      method: "POST",
      body: JSON.stringify({ name: "X", gender: "M", club: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("t04");
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- src/app/api/teams/players/route.test.ts`
Expected: POST tests FAIL — `POST` not exported.

- [ ] **Step 3: Extend route**

Replace `src/app/api/teams/players/route.ts` with the mirror of Task B2, changing:
- Table: `team_players`
- ID prefix: `t` (in `nextTeamPlayerId` and `.like("id", "t%")`)
- Function names: `nextTeamPlayerId`, `insertWithRetry` (can stay)

```ts
import { z } from "zod";
import { err, ok } from "@/lib/api/response";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { PlayerInputSchema } from "@/lib/schemas/player";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name, phone, gender, club")
    .order("id");
  if (error) return err(error.message);
  return ok(data);
}

async function nextTeamPlayerId(): Promise<string> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id")
    .like("id", "t%");
  if (error) throw new Error(error.message);
  const nums = (data ?? [])
    .map((r: { id: string }) => parseInt(r.id.slice(1), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `t${String(next).padStart(2, "0")}`;
}

async function insertWithRetry(
  body: z.infer<typeof PlayerInputSchema>,
  attempt = 0,
): Promise<unknown> {
  if (attempt >= 3) throw new Error("Không sinh được id sau 3 lần thử");
  const id = await nextTeamPlayerId();
  const row = {
    id,
    name: body.name,
    gender: body.gender,
    club: body.club ?? "",
    phone: body.phone && body.phone.length > 0 ? body.phone : null,
  };
  const { data, error } = await supabaseServer
    .from("team_players")
    .insert(row)
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return insertWithRetry(body, attempt + 1);
    }
    throw new Error(error.message);
  }
  return data;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const parsed = PlayerInputSchema.parse(body);
    const created = await insertWithRetry(parsed);
    return ok(created, 201);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/app/api/teams/players/route.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/players/route.ts src/app/api/teams/players/route.test.ts
git commit -m "feat(api): POST /api/teams/players with id gen + retry"
```

### Task C3: `GET /api/teams/players/[id]`

**Files:**
- Create: `src/app/api/teams/players/[id]/route.ts`
- Create: `src/app/api/teams/players/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/teams/players/[id]/route.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { makeSupabaseChain } from "@/test/supabase-mock";
import { GET } from "./route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/teams/players/[id]", () => {
  test("returns 200 with player on found", async () => {
    const player = { id: "t01", name: "A", gender: "M", club: "", phone: null };
    const chain = makeSupabaseChain({ data: player, error: null });
    chain.single = vi.fn().mockResolvedValue({ data: player, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET(new Request("http://localhost/x"), ctx("t01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(player);
    expect(supabaseServer.from).toHaveBeenCalledWith("team_players");
  });

  test("returns 404 when not found", async () => {
    const chain = makeSupabaseChain({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    chain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await GET(new Request("http://localhost/x"), ctx("txx"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- "src/app/api/teams/players/\[id\]"`
Expected: FAIL — `./route` module not found.

- [ ] **Step 3: Write GET handler**

Create `src/app/api/teams/players/[id]/route.ts`:

```ts
import { err, ok } from "@/lib/api/response";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name, phone, gender, club")
    .eq("id", id)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
    return err(error.message);
  }
  return ok(data);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- "src/app/api/teams/players/\[id\]"`
Expected: 2 GET tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/players/\[id\]/
git commit -m "feat(api): GET /api/teams/players/[id]"
```

### Task C4: `PATCH /api/teams/players/[id]`

**Files:** modify both files from Task C3

- [ ] **Step 1: Extend test file**

Append to `src/app/api/teams/players/[id]/route.test.ts`:

```ts
import { PATCH } from "./route";

function mockAdminCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: "ok", name: "pp_admin" }),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function mockNoCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("PATCH /api/teams/players/[id]", () => {
  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "Mới" }),
    });
    const res = await PATCH(req, ctx("t01"));
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid body", async () => {
    mockAdminCookie();
    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ gender: "X" }),
    });
    const res = await PATCH(req, ctx("t01"));
    expect(res.status).toBe(400);
  });

  test("returns 200 with updated player", async () => {
    mockAdminCookie();
    const updated = { id: "t01", name: "Mới", gender: "M", club: "", phone: null };
    const chain = makeSupabaseChain({ data: updated, error: null });
    chain.single = vi.fn().mockResolvedValue({ data: updated, error: null });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "Mới" }),
    });
    const res = await PATCH(req, ctx("t01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Mới");
  });

  test("returns 404 when row not found", async () => {
    mockAdminCookie();
    const chain = makeSupabaseChain({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    chain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    vi.mocked(supabaseServer.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "X" }),
    });
    const res = await PATCH(req, ctx("txx"));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npm test -- "src/app/api/teams/players/\[id\]"`
Expected: PATCH tests FAIL — `PATCH` not exported.

- [ ] **Step 3: Extend route**

Append to `src/app/api/teams/players/[id]/route.ts`:

```ts
import { z } from "zod";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { PlayerPatchSchema } from "@/lib/schemas/player";

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = PlayerPatchSchema.parse(body);

    const update: Record<string, unknown> = {};
    if (parsed.name !== undefined) update.name = parsed.name;
    if (parsed.gender !== undefined) update.gender = parsed.gender;
    if (parsed.club !== undefined) update.club = parsed.club;
    if (parsed.phone !== undefined) {
      update.phone = parsed.phone && parsed.phone.length > 0 ? parsed.phone : null;
    }

    const { data, error } = await supabaseServer
      .from("team_players")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") return err("Not found", 404);
      return err(error.message);
    }
    return ok(data);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return err(`${first.path.join(".")}: ${first.message}`, 400);
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- "src/app/api/teams/players/\[id\]"`
Expected: GET + PATCH tests pass (6 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/players/\[id\]/route.ts src/app/api/teams/players/\[id\]/route.test.ts
git commit -m "feat(api): PATCH /api/teams/players/[id]"
```

### Task C5: `DELETE /api/teams/players/[id]` with pre-check

**Files:** modify both files from C3

- [ ] **Step 1: Extend test file**

Same structure as Task B5, but pre-check queries `teams` table with `.contains('members', [id])`:

```ts
describe("DELETE /api/teams/players/[id]", () => {
  test("returns 409 when player is in a team", async () => {
    mockAdminCookie();
    const preCheck = makeSupabaseChain({
      data: [{ id: "tA1", name: "Bình Tân 1", members: ["t01", "t02", "t03"] }],
      error: null,
    });
    vi.mocked(supabaseServer.from).mockReturnValueOnce(
      preCheck as unknown as ReturnType<typeof supabaseServer.from>,
    );

    const res = await DELETE(new Request("http://localhost/x"), ctx("t01"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("đội");
    expect(body.error).toContain("Bình Tân 1");
  });

  test("returns 200 on successful delete", async () => {
    mockAdminCookie();
    const preCheck = makeSupabaseChain({ data: [], error: null });
    const del = makeSupabaseChain({ data: null, error: null });
    vi.mocked(supabaseServer.from)
      .mockReturnValueOnce(preCheck as unknown as ReturnType<typeof supabaseServer.from>)
      .mockReturnValueOnce(del as unknown as ReturnType<typeof supabaseServer.from>);

    const res = await DELETE(new Request("http://localhost/x"), ctx("t99"));
    expect(res.status).toBe(200);
  });

  test("returns 401 when not admin", async () => {
    mockNoCookie();
    const res = await DELETE(new Request("http://localhost/x"), ctx("t01"));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- "src/app/api/teams/players/\[id\]"`
Expected: DELETE tests FAIL.

- [ ] **Step 3: Extend route**

Append to `src/app/api/teams/players/[id]/route.ts`:

```ts
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    const { data: teams, error: checkErr } = await supabaseServer
      .from("teams")
      .select("id, name, members")
      .contains("members", [id]);
    if (checkErr) return err(checkErr.message);

    if (teams && teams.length > 0) {
      const names = teams.map((t: { name: string }) => t.name).join(", ");
      return err(
        `VĐV đang trong ${teams.length} đội: ${names} — xoá khỏi đội trước`,
        409,
      );
    }

    const { error } = await supabaseServer.from("team_players").delete().eq("id", id);
    if (error) return err(error.message);
    return ok(null);
  } catch (e) {
    if (e instanceof UnauthorizedError) return err("Unauthorized", 401);
    const msg = e instanceof Error ? e.message : "Internal error";
    return err(msg, 500);
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- "src/app/api/teams/players/\[id\]"`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/teams/players/\[id\]/route.ts src/app/api/teams/players/\[id\]/route.test.ts
git commit -m "feat(api): DELETE /api/teams/players/[id] with teams.members pre-check"
```

---

### 🛑 CHECKPOINT C — User verification

**STOP. Report to user:**

> Checkpoint C xong. Teams Players API mirror xong.
>
> Total API tests: ~30 pass.
>
> Báo "ok" để tiếp Checkpoint D (UI swap).

**Do not proceed until user confirms.**

---

## Checkpoint D — Admin UI Swap

Extract `PlayersSection` + `PlayerFormDialog`, wire fetch/`useOptimistic`/toasts, swap `page.tsx` files to read from Supabase, add `loading.tsx` skeletons. No unit tests for UI — manual QA at end.

### Task D1: Extract PlayersSection to its own file (no behavior change yet)

**Files:**
- Create: `src/app/admin/_players-section.tsx`
- Modify: `src/app/admin/_components.tsx`

- [ ] **Step 1: Read current `_components.tsx` lines 115-210**

The current `PlayersSection` (lines 117-155) and `PlayerFormDialog` (lines 157-208) are the target. They use these imports from `_components.tsx` scope:

```ts
// From "react"
import { useMemo } from "react";
// From lucide-react
import { Mars, Pencil, Plus, Venus } from "lucide-react";
// shadcn:
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Local helpers/types:
import type { Content, Player } from "./_mock";
// These 2 helpers are inline in _components.tsx: SectionHeader, ConfirmDeleteButton
```

- [ ] **Step 2: Create `_players-section.tsx`**

Paste into `src/app/admin/_players-section.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { Mars, Pencil, Plus, Venus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Content, Player } from "./_mock";
import { SectionHeader, ConfirmDeleteButton } from "./_components";

export function PlayersSection({
  kind,
  players,
}: {
  kind: Content;
  players: Player[];
}) {
  const total = players.length;
  const male = useMemo(
    () => players.filter((p) => p.gender === "M").length,
    [players],
  );
  const female = total - male;

  return (
    <div>
      <SectionHeader
        title="Danh sách VĐV"
        subtitle={`${total} VĐV · ${male} nam · ${female} nữ`}
        action={<PlayerFormDialog kind={kind} mode="create" />}
      />
      <div className="flex flex-col gap-2">
        {players.map((p, i) => (
          <Card key={p.id} className="flex flex-row items-center gap-3 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{p.name}</span>
                {p.gender === "M" ? (
                  <Mars className="size-4 shrink-0 text-blue-500" aria-label="Nam" />
                ) : (
                  <Venus className="size-4 shrink-0 text-pink-500" aria-label="Nữ" />
                )}
              </div>
              <div className="truncate text-sm text-muted-foreground">{p.club}</div>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <PlayerFormDialog kind={kind} mode="edit" player={p} />
              <ConfirmDeleteButton label={`VĐV "${p.name}"`} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PlayerFormDialog({
  kind: _kind,
  mode,
  player,
}: {
  kind: Content;
  mode: "create" | "edit";
  player?: Player;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button size="sm">
              <Plus /> Thêm
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Sửa"
              className="bg-muted hover:bg-muted/70"
            />
          )
        }
      >
        {mode === "edit" ? <Pencil /> : null}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Thêm VĐV" : "Sửa VĐV"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Nhập thông tin VĐV mới." : "Cập nhật thông tin VĐV."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Họ tên</Label>
            <Input id="name" defaultValue={player?.name} placeholder="Nguyễn Văn A" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gender">Giới tính</Label>
            <select
              id="gender"
              defaultValue={player?.gender ?? "M"}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="M">Nam</option>
              <option value="F">Nữ</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="club">CLB / Đơn vị</Label>
            <Input id="club" defaultValue={player?.club} placeholder="CLB ..." />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Huỷ</DialogClose>
          <Button type="button">{mode === "create" ? "Thêm" : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Note: Behaviour is unchanged (no fetch yet). Only move + add `kind` prop placeholder.

- [ ] **Step 3: Update `_components.tsx`**

In `src/app/admin/_components.tsx`:
1. Remove old `PlayersSection` function (lines 117-155) and old `PlayerFormDialog` function (lines 157-208).
2. Export `SectionHeader` and `ConfirmDeleteButton` from this file (so `_players-section.tsx` can import them). Change their declarations from `function X(...)` to `export function X(...)`.
3. Add at top: `import { PlayersSection } from "./_players-section";`
4. Leave the JSX that renders `<PlayersSection ... />` inside `ContentWorkspace` unchanged — it now resolves to the imported one.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Dev smoke**

Run: `npm run dev` (in another terminal)
Open `http://localhost:3000/admin/doubles` and `/admin/teams` after login.
Expected: Players tab still shows mock data, Add/Edit/Delete buttons still visible (no-op as before).

Stop dev server (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/_players-section.tsx src/app/admin/_components.tsx
git commit -m "refactor(admin): extract PlayersSection to own file"
```

### Task D2: Add `loading.tsx` skeletons

**Files:**
- Create: `src/app/admin/doubles/loading.tsx`
- Create: `src/app/admin/teams/loading.tsx`

- [ ] **Step 1: Verify Skeleton component exists**

Run: `cat src/components/ui/skeleton.tsx`
Expected: exports `Skeleton` component.

- [ ] **Step 2: Write `doubles/loading.tsx`**

```tsx
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-44" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="flex flex-row items-center gap-3 p-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </Card>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write `teams/loading.tsx`**

Same content as `doubles/loading.tsx`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/doubles/loading.tsx src/app/admin/teams/loading.tsx
git commit -m "feat(admin): loading.tsx skeletons for doubles/teams"
```

### Task D3: Wire PlayerFormDialog submit + useOptimistic + toast (Create)

**Files:** modify `src/app/admin/_players-section.tsx`

This task wires Create only. Update and Delete come in D4 and D5.

- [ ] **Step 1: Refactor to lift state**

Replace `src/app/admin/_players-section.tsx` with a version that:
- Accepts `players` as server-fetched array (same prop as before)
- Uses `useOptimistic` for add/update/delete reducer
- Exposes handlers down to `PlayerFormDialog`

```tsx
"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mars, Pencil, Plus, Venus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Content, Player } from "./_mock";
import {
  PlayerInputSchema,
  PlayerPatchSchema,
  type PlayerInput,
  type PlayerPatch,
} from "@/lib/schemas/player";
import { SectionHeader, ConfirmDeleteButton } from "./_components";

type OptAction =
  | { type: "add"; player: Player }
  | { type: "update"; id: string; patch: Partial<Player> }
  | { type: "remove"; id: string };

function reducer(state: Player[], action: OptAction): Player[] {
  switch (action.type) {
    case "add":
      return [...state, action.player];
    case "update":
      return state.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p));
    case "remove":
      return state.filter((p) => p.id !== action.id);
  }
}

function apiBase(kind: Content) {
  return `/api/${kind}/players`;
}

const GHOST_ID = "__pending__";

export function PlayersSection({
  kind,
  players,
}: {
  kind: Content;
  players: Player[];
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(players, reducer);
  const [isPending, startTransition] = useTransition();

  const handleCreate = (input: PlayerInput) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const ghost: Player = {
          id: GHOST_ID,
          name: input.name,
          gender: input.gender,
          club: input.club ?? "",
          phone: input.phone ?? "",
        };
        setOptimistic({ type: "add", player: ghost });
        try {
          const res = await fetch(apiBase(kind), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Có lỗi");
          toast.success(`Đã thêm VĐV ${input.name}`);
          router.refresh();
          resolve();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Có lỗi";
          toast.error(msg, { duration: 6000 });
          reject(e);
        }
      });
    });

  const total = optimistic.length;
  const male = useMemo(
    () => optimistic.filter((p) => p.gender === "M").length,
    [optimistic],
  );
  const female = total - male;

  return (
    <div>
      <SectionHeader
        title="Danh sách VĐV"
        subtitle={`${total} VĐV · ${male} nam · ${female} nữ`}
        action={<PlayerFormDialog mode="create" onSubmitCreate={handleCreate} />}
      />
      <div className="flex flex-col gap-2">
        {optimistic.map((p, i) => {
          const isGhost = p.id === GHOST_ID;
          return (
            <Card
              key={`${p.id}-${i}`}
              className={`flex flex-row items-center gap-3 p-3 ${
                isGhost ? "opacity-60" : ""
              }`}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{p.name}</span>
                  {p.gender === "M" ? (
                    <Mars className="size-4 shrink-0 text-blue-500" aria-label="Nam" />
                  ) : (
                    <Venus className="size-4 shrink-0 text-pink-500" aria-label="Nữ" />
                  )}
                  {isGhost && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="truncate text-sm text-muted-foreground">{p.club}</div>
              </div>
              {!isGhost && (
                <div className="flex shrink-0 gap-0.5">
                  <PlayerFormDialog mode="edit" player={p} />
                  <ConfirmDeleteButton label={`VĐV "${p.name}"`} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function PlayerFormDialog({
  mode,
  player,
  onSubmitCreate,
}: {
  mode: "create" | "edit";
  player?: Player;
  onSubmitCreate?: (input: PlayerInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(player?.name ?? "");
  const [gender, setGender] = useState<"M" | "F">(player?.gender ?? "M");
  const [club, setClub] = useState(player?.club ?? "");
  const [phone, setPhone] = useState(player?.phone ?? "");

  const reset = () => {
    setName(player?.name ?? "");
    setGender(player?.gender ?? "M");
    setClub(player?.club ?? "");
    setPhone(player?.phone ?? "");
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) reset();
  };

  const handleSubmit = async () => {
    const parsed = PlayerInputSchema.safeParse({ name, gender, club, phone });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }
    if (mode === "create" && onSubmitCreate) {
      setPending(true);
      try {
        await onSubmitCreate(parsed.data);
        setOpen(false);
        reset();
      } catch {
        // toast already shown by handler
      } finally {
        setPending(false);
      }
    }
    // edit handled in D4
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button size="sm">
              <Plus /> Thêm
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Sửa"
              className="bg-muted hover:bg-muted/70"
            />
          )
        }
      >
        {mode === "edit" ? <Pencil /> : null}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Thêm VĐV" : "Sửa VĐV"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Nhập thông tin VĐV mới." : "Cập nhật thông tin VĐV."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Họ tên</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gender">Giới tính</Label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as "M" | "F")}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
              disabled={pending}
            >
              <option value="M">Nam</option>
              <option value="F">Nữ</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="club">CLB / Đơn vị</Label>
            <Input
              id="club"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="CLB ..."
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" disabled={pending} />}>
            Huỷ
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Thêm" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/_players-section.tsx
git commit -m "feat(admin): wire PlayerFormDialog create with useOptimistic + toast"
```

### Task D4: Add Update handler

**Files:** modify `src/app/admin/_players-section.tsx`

- [ ] **Step 1: Add `handleUpdate` in PlayersSection**

Inside `PlayersSection`, after `handleCreate`, add:

```tsx
const handleUpdate = (id: string, patch: PlayerPatch) =>
  new Promise<void>((resolve, reject) => {
    startTransition(async () => {
      setOptimistic({ type: "update", id, patch: patch as Partial<Player> });
      try {
        const res = await fetch(`${apiBase(kind)}/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Có lỗi");
        toast.success("Đã lưu");
        router.refresh();
        resolve();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Có lỗi";
        toast.error(msg, { duration: 6000 });
        reject(e);
      }
    });
  });
```

- [ ] **Step 2: Pass to `PlayerFormDialog` in edit mode**

In the row rendering, change:

```tsx
<PlayerFormDialog mode="edit" player={p} />
```

to:

```tsx
<PlayerFormDialog mode="edit" player={p} onSubmitUpdate={handleUpdate} />
```

- [ ] **Step 3: Extend `PlayerFormDialog` props + handler**

Update props:

```tsx
export function PlayerFormDialog({
  mode,
  player,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  mode: "create" | "edit";
  player?: Player;
  onSubmitCreate?: (input: PlayerInput) => Promise<void>;
  onSubmitUpdate?: (id: string, patch: PlayerPatch) => Promise<void>;
}) {
```

Replace `handleSubmit`:

```tsx
const handleSubmit = async () => {
  if (mode === "create") {
    const parsed = PlayerInputSchema.safeParse({ name, gender, club, phone });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }
    if (!onSubmitCreate) return;
    setPending(true);
    try {
      await onSubmitCreate(parsed.data);
      setOpen(false);
      reset();
    } catch {
      /* handler already toasted */
    } finally {
      setPending(false);
    }
    return;
  }
  // edit
  if (!player || !onSubmitUpdate) return;
  const patch: Record<string, unknown> = {};
  if (name !== player.name) patch.name = name;
  if (gender !== player.gender) patch.gender = gender;
  if (club !== player.club) patch.club = club;
  if (phone !== player.phone) patch.phone = phone;
  if (Object.keys(patch).length === 0) {
    setOpen(false);
    return;
  }
  const parsed = PlayerPatchSchema.safeParse(patch);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    toast.error(`${first.path.join(".")}: ${first.message}`);
    return;
  }
  setPending(true);
  try {
    await onSubmitUpdate(player.id, parsed.data);
    setOpen(false);
  } catch {
    /* toasted */
  } finally {
    setPending(false);
  }
};
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/_players-section.tsx
git commit -m "feat(admin): wire PlayerFormDialog edit (PATCH) with optimistic"
```

### Task D5: Add Delete handler

**Files:** modify `src/app/admin/_players-section.tsx`, `src/app/admin/_components.tsx`

- [ ] **Step 1: Inspect `ConfirmDeleteButton` in `_components.tsx`**

Run: `grep -n "ConfirmDeleteButton" src/app/admin/_components.tsx | head -5`

Read its signature. If it has no `onConfirm` prop, we need to extend it. The plan assumes it's a simple confirm-triggered delete button that now needs to accept a handler.

- [ ] **Step 2: Extend `ConfirmDeleteButton` to accept `onConfirm`**

In `src/app/admin/_components.tsx`, find `ConfirmDeleteButton` and change its props to accept an optional `onConfirm?: () => Promise<void> | void` + `disabled?: boolean`. On confirm click, call `await onConfirm?.()` and close. Keep all existing UI unchanged. If the component doesn't exist yet, create it with this signature:

```tsx
export function ConfirmDeleteButton({
  label,
  onConfirm,
  disabled,
}: {
  label: string;
  onConfirm?: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Xoá"
            className="bg-muted hover:bg-muted/70 text-destructive"
            disabled={disabled}
          />
        }
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xoá {label}?</DialogTitle>
          <DialogDescription>Hành động này không thể hoàn tác.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" disabled={pending} />}>
            Huỷ
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              if (!onConfirm) {
                setOpen(false);
                return;
              }
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                /* toasted by handler */
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

(Make sure `Loader2` and `Trash2` from `lucide-react` are imported. Add if missing.)

Note: the existing JSX inside `_components.tsx` that renders `<ConfirmDeleteButton label={...} />` will still work because `onConfirm` is optional — callers that don't wire it remain no-op as before.

- [ ] **Step 3: Add `handleDelete` in PlayersSection**

After `handleUpdate`, add:

```tsx
const handleDelete = (id: string) =>
  new Promise<void>((resolve, reject) => {
    startTransition(async () => {
      setOptimistic({ type: "remove", id });
      try {
        const res = await fetch(`${apiBase(kind)}/${id}`, { method: "DELETE" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Có lỗi");
        const target = players.find((p) => p.id === id);
        toast.success(`Đã xoá ${target?.name ?? "VĐV"}`);
        router.refresh();
        resolve();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Có lỗi";
        toast.error(msg, { duration: 6000 });
        reject(e);
      }
    });
  });
```

- [ ] **Step 4: Wire into row**

Change:

```tsx
<ConfirmDeleteButton label={`VĐV "${p.name}"`} />
```

to:

```tsx
<ConfirmDeleteButton
  label={`VĐV "${p.name}"`}
  onConfirm={() => handleDelete(p.id)}
/>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/_players-section.tsx src/app/admin/_components.tsx
git commit -m "feat(admin): wire ConfirmDeleteButton with DELETE + optimistic"
```

### Task D6: Swap doubles/page.tsx to fetch from Supabase

**Files:** modify `src/app/admin/doubles/page.tsx`

- [ ] **Step 1: Replace page with async RSC**

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import {
  MOCK_DOUBLES_GROUPS,
  MOCK_DOUBLES_KO,
  MOCK_PAIRS,
} from "../_mock";
import { supabaseServer } from "@/lib/supabase/server";
import type { Player } from "../_mock";

export const dynamic = "force-dynamic";

async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabaseServer
    .from("doubles_players")
    .select("id, name, phone, gender, club")
    .order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? "",
    gender: r.gender,
    club: r.club ?? "",
  }));
}

export default async function DoublesAdminPage() {
  const players = await fetchPlayers();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/admin" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Nội dung Đôi</h1>
          <p className="text-sm text-muted-foreground">VĐV, cặp đôi và bảng đấu</p>
        </div>
      </header>

      <ContentWorkspace
        kind="doubles"
        players={players}
        pairs={MOCK_PAIRS}
        groups={MOCK_DOUBLES_GROUPS}
        knockout={MOCK_DOUBLES_KO}
      />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Dev verify**

Run: `npm run dev`
Open `/admin/doubles` after login.
Expected: Players tab shows DB-seeded players (36 rows). Pairs/Groups still from mock.

Stop dev.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/doubles/page.tsx
git commit -m "feat(admin): fetch doubles players from Supabase"
```

### Task D7: Swap teams/page.tsx to fetch from Supabase

**Files:** modify `src/app/admin/teams/page.tsx`

- [ ] **Step 1: Replace page**

Mirror Task D6, changing:
- Table: `team_players`
- Import `MOCK_TEAM_GROUPS, MOCK_TEAM_KO, MOCK_TEAMS, TEAM_FINAL_NOTE` instead of doubles mocks
- Pass `kind="teams"`, `teams={MOCK_TEAMS}` (still mock), `knockoutNote={TEAM_FINAL_NOTE}`

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentWorkspace } from "../_components";
import {
  MOCK_TEAM_GROUPS,
  MOCK_TEAM_KO,
  MOCK_TEAMS,
  TEAM_FINAL_NOTE,
} from "../_mock";
import { supabaseServer } from "@/lib/supabase/server";
import type { Player } from "../_mock";

export const dynamic = "force-dynamic";

async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabaseServer
    .from("team_players")
    .select("id, name, phone, gender, club")
    .order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? "",
    gender: r.gender,
    club: r.club ?? "",
  }));
}

export default async function TeamsAdminPage() {
  const players = await fetchPlayers();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center gap-2">
        <Button
          nativeButton={false}
          render={<Link href="/admin" />}
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Nội dung Đồng đội</h1>
          <p className="text-sm text-muted-foreground">VĐV, đội và bảng đấu</p>
        </div>
      </header>

      <ContentWorkspace
        kind="teams"
        players={players}
        teams={MOCK_TEAMS}
        groups={MOCK_TEAM_GROUPS}
        knockout={MOCK_TEAM_KO}
        knockoutNote={TEAM_FINAL_NOTE}
      />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + dev verify**

Run: `npx tsc --noEmit` then `npm run dev`, open `/admin/teams`, verify Players tab shows 24 team players from DB.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/teams/page.tsx
git commit -m "feat(admin): fetch team players from Supabase"
```

### Task D8: Manual QA verify

**Files:** none (operational)

Full test pass through UI. Run `npm run dev` and walk through:

- [ ] **Login** at `/admin/login` with password `123456`. Verify cookie set.

- [ ] **Doubles — List**
  - Open `/admin/doubles` → Players tab
  - Count should be 36 VĐV
  - Stats "N VĐV · M nam · K nữ" accurate

- [ ] **Doubles — Create**
  - Click "Thêm" → dialog opens
  - Leave name empty, click "Thêm" → toast error về tên
  - Type name "Test A", gender M, club "CLB Test", phone "0901" → click Thêm
  - Verify: ghost row appears with spinner, then real row at bottom, toast "Đã thêm VĐV Test A"
  - Refresh page → row persists
  - Check Supabase Studio → `doubles_players` has new row with id like `d37`

- [ ] **Doubles — Edit**
  - Click pencil on "Test A" → change name to "Test Edited", save
  - Verify: row updates, toast "Đã lưu"
  - Refresh → persists

- [ ] **Doubles — Delete (FK block)**
  - Click trash on seeded player (e.g., first row `d01`)
  - Confirm
  - Verify: toast "VĐV đang trong 1 cặp: p01 — xoá cặp trước", row stays

- [ ] **Doubles — Delete (success)**
  - Click trash on "Test Edited" (not in any pair)
  - Confirm
  - Verify: row disappears, toast "Đã xoá Test Edited"
  - Refresh → gone

- [ ] **Teams — same flow**
  - Open `/admin/teams` → Players tab shows 24 VĐV
  - Add "Test T", edit, delete
  - Delete seeded `t01` → toast should say "VĐV đang trong 1 đội: Bình Tân 1 — xoá khỏi đội trước"

- [ ] **Loading skeleton**
  - Hard reload `/admin/doubles` while dev is slow (or throttle network in devtools) — verify skeleton shows momentarily

- [ ] **401 flow**
  - Open `/admin/doubles` in incognito (no cookie)
  - Try POST via curl without cookie: `curl -X POST http://localhost:3000/api/doubles/players -H 'content-type: application/json' -d '{"name":"X","gender":"M","club":""}'`
  - Expected: `{"data":null,"error":"Unauthorized"}` with 401

- [ ] **Typecheck + lint + test**

```bash
npx tsc --noEmit
npm run lint
npm test
```

All 3 pass.

- [ ] **No commit** (operational task)

---

### 🛑 CHECKPOINT D — User verification

**STOP. Report to user:**

> Checkpoint D xong — Phase 2 complete.
>
> **Đã xong:**
> - 10 API endpoints (5 doubles + 5 teams) với auth, zod validate, FK pre-check, retry-on-conflict
> - `requireAdmin()` + zod schema + response helpers
> - Vitest setup, ~30 unit tests pass
> - `PlayersSection` extracted ra file riêng
> - `useOptimistic` + sonner toast + skeleton loading cho cả 2 content
> - Phone field thêm vào form, PATCH partial
> - Manual QA: create/edit/delete cả doubles + teams, FK block đúng
>
> **Verify giúp:**
> - Add 1 VĐV doubles, edit, delete — persist sau reload
> - Mở Supabase Studio, confirm data match
> - Check row count: doubles_players = 36 + N tự thêm, team_players = 24 + N
>
> Báo "ok" để merge branch `feat/supabase-phase-2` vào main. Phase 3 (Pairs + Teams entity) có plan riêng khi bắt đầu.

**End of Phase 2.**

---

## Done Criteria

- [ ] `zod` + `vitest` cài, `npm test` chạy được, `npm run lint` clean, `npx tsc --noEmit` clean
- [ ] 10 endpoints implemented và tất cả unit test pass
- [ ] `requireAdmin()` + `UnauthorizedError` trong `src/lib/auth.ts`
- [ ] Zod schema shared ở `src/lib/schemas/player.ts`, dùng cả server + client
- [ ] `PlayersSection` + `PlayerFormDialog` tách ra `_players-section.tsx`
- [ ] Admin page doubles + teams đọc players từ Supabase (RSC async)
- [ ] `loading.tsx` skeleton ở `/admin/doubles` + `/admin/teams`
- [ ] `useOptimistic` cho create / update / delete với rollback on error
- [ ] Sonner toast `top-center` position, `richColors`, text VN chuẩn
- [ ] Delete pre-check FK → 409 với message chi tiết (`cặp` cho doubles, `đội` cho teams)
- [ ] Manual QA: add/edit/delete VĐV ở cả 2 content → persist sau reload
- [ ] User approved ở cả 4 checkpoints

**Next:** Phase 3 plan (Pairs + Teams entity API + UI swap). Written separately khi Phase 2 đã merge.
