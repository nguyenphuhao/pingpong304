# AI Match Input — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered match result entry from voice and images, supporting single-match and batch modes.

**Architecture:** Single API route (`POST /api/ai/parse-match`) uses Vercel AI SDK `generateObject` via AI Gateway to parse match results from text/images into structured JSON. Client UI is a chat-style modal opened from match cards (single mode) or group page headers (batch mode). Existing PATCH APIs handle saving.

**Tech Stack:** Vercel AI SDK v6, AI Gateway (`anthropic/claude-haiku-4.5`), Zod 4, Web Speech API, shadcn Dialog

**Worktree:** `.worktrees/ai-match-input` on branch `feature/ai-match-input`

---

## Task 1: Install AI SDK dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `ai` package**

```bash
cd .worktrees/ai-match-input
npm install ai@^6
```

- [ ] **Step 2: Verify installation**

```bash
cd .worktrees/ai-match-input
node -e "const { generateObject } = require('ai'); console.log('ok')" 2>/dev/null || npx tsx -e "import { generateObject } from 'ai'; console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
cd .worktrees/ai-match-input
git add package.json package-lock.json
git commit -m "chore: add vercel ai sdk dependency"
```

---

## Task 2: AI response Zod schemas

**Files:**
- Create: `src/lib/ai/schemas.ts`
- Create: `src/lib/ai/schemas.test.ts`

- [ ] **Step 1: Write failing tests for AI response schemas**

Create `src/lib/ai/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  MatchResultSchema,
  SingleResultSchema,
  BatchResultSchema,
  RejectionSchema,
  ParseMatchResponseSchema,
} from "./schemas";

describe("MatchResultSchema", () => {
  it("accepts valid doubles result (sets only)", () => {
    const input = {
      sets: [{ a: 11, b: 9 }, { a: 11, b: 7 }],
    };
    expect(() => MatchResultSchema.parse(input)).not.toThrow();
  });

  it("accepts valid team result (sets + subMatches)", () => {
    const input = {
      sets: [],
      subMatches: [
        { label: "Đôi 1", sets: [{ a: 11, b: 5 }, { a: 11, b: 8 }] },
        { label: "Đơn 1", sets: [{ a: 9, b: 11 }, { a: 11, b: 7 }, { a: 11, b: 9 }] },
      ],
    };
    expect(() => MatchResultSchema.parse(input)).not.toThrow();
  });

  it("rejects set scores outside 0-99", () => {
    const input = { sets: [{ a: 100, b: 5 }] };
    expect(() => MatchResultSchema.parse(input)).toThrow();
  });
});

describe("SingleResultSchema", () => {
  it("accepts valid single result", () => {
    const input = {
      status: "ok" as const,
      mode: "single" as const,
      matchId: "abc123",
      result: { sets: [{ a: 11, b: 9 }] },
    };
    expect(() => SingleResultSchema.parse(input)).not.toThrow();
  });
});

describe("BatchResultSchema", () => {
  it("accepts valid batch result", () => {
    const input = {
      status: "ok" as const,
      mode: "batch" as const,
      parsed: [
        {
          matchId: "m1",
          sideA: "Hào – Minh",
          sideB: "Long – Tuấn",
          result: { sets: [{ a: 11, b: 9 }] },
          alreadyHasResult: false,
        },
      ],
      unmatched: ["Unknown Team"],
    };
    expect(() => BatchResultSchema.parse(input)).not.toThrow();
  });

  it("accepts batch result without unmatched", () => {
    const input = {
      status: "ok" as const,
      mode: "batch" as const,
      parsed: [],
    };
    expect(() => BatchResultSchema.parse(input)).not.toThrow();
  });
});

describe("RejectionSchema", () => {
  it("accepts valid rejection", () => {
    const input = { status: "rejected" as const, reason: "Ảnh quá mờ" };
    expect(() => RejectionSchema.parse(input)).not.toThrow();
  });
});

describe("ParseMatchResponseSchema", () => {
  it("accepts single result", () => {
    const input = {
      status: "ok",
      mode: "single",
      matchId: "abc",
      result: { sets: [{ a: 11, b: 9 }] },
    };
    expect(() => ParseMatchResponseSchema.parse(input)).not.toThrow();
  });

  it("accepts batch result", () => {
    const input = {
      status: "ok",
      mode: "batch",
      parsed: [],
    };
    expect(() => ParseMatchResponseSchema.parse(input)).not.toThrow();
  });

  it("accepts rejection", () => {
    const input = { status: "rejected", reason: "Cannot read" };
    expect(() => ParseMatchResponseSchema.parse(input)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd .worktrees/ai-match-input
npx vitest run src/lib/ai/schemas.test.ts
```

Expected: FAIL — module `./schemas` not found.

- [ ] **Step 3: Implement AI response schemas**

Create `src/lib/ai/schemas.ts`:

```typescript
import { z } from "zod";

const SetScoreSchema = z.object({
  a: z.number().int().min(0).max(99),
  b: z.number().int().min(0).max(99),
});

const SubMatchResultSchema = z.object({
  label: z.string().min(1),
  sets: z.array(SetScoreSchema).min(1).max(5),
});

export const MatchResultSchema = z.object({
  sets: z.array(SetScoreSchema).max(5),
  subMatches: z.array(SubMatchResultSchema).max(7).optional(),
});

export const SingleResultSchema = z.object({
  status: z.literal("ok"),
  mode: z.literal("single"),
  matchId: z.string().min(1),
  result: MatchResultSchema,
});

export const BatchResultSchema = z.object({
  status: z.literal("ok"),
  mode: z.literal("batch"),
  parsed: z.array(
    z.object({
      matchId: z.string().min(1),
      sideA: z.string(),
      sideB: z.string(),
      result: MatchResultSchema,
      alreadyHasResult: z.boolean(),
    }),
  ),
  unmatched: z.array(z.string()).optional(),
});

export const RejectionSchema = z.object({
  status: z.literal("rejected"),
  reason: z.string().min(1),
});

export const ParseMatchResponseSchema = z.discriminatedUnion("status", [
  z.discriminatedUnion("mode", [SingleResultSchema, BatchResultSchema]),
  RejectionSchema,
]);

export type MatchResult = z.infer<typeof MatchResultSchema>;
export type SingleResult = z.infer<typeof SingleResultSchema>;
export type BatchResult = z.infer<typeof BatchResultSchema>;
export type Rejection = z.infer<typeof RejectionSchema>;
export type ParseMatchResponse = z.infer<typeof ParseMatchResponseSchema>;
```

> **Note:** `z.discriminatedUnion` in Zod 4 does not support nesting like this. If this fails, flatten to a single union:

Fallback if nested discriminatedUnion fails:

```typescript
export const ParseMatchResponseSchema = z.union([
  SingleResultSchema,
  BatchResultSchema,
  RejectionSchema,
]);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd .worktrees/ai-match-input
npx vitest run src/lib/ai/schemas.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/ai-match-input
git add src/lib/ai/schemas.ts src/lib/ai/schemas.test.ts
git commit -m "feat(ai): add zod schemas for AI parse-match response"
```

---

## Task 3: AI prompt builders

**Files:**
- Create: `src/lib/ai/prompts.ts`
- Create: `src/lib/ai/prompts.test.ts`

- [ ] **Step 1: Write failing tests for prompt builders**

Create `src/lib/ai/prompts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSinglePrompt, buildBatchPrompt } from "./prompts";

describe("buildSinglePrompt", () => {
  it("builds prompt for doubles match", () => {
    const prompt = buildSinglePrompt({
      id: "m1",
      type: "doubles",
      bestOf: 3,
      sideA: "Hào – Minh",
      sideB: "Long – Tuấn",
    });
    expect(prompt).toContain("Hào – Minh");
    expect(prompt).toContain("Long – Tuấn");
    expect(prompt).toContain("Best of 3");
    expect(prompt).toContain("m1");
  });

  it("builds prompt for team match with sub-matches", () => {
    const prompt = buildSinglePrompt({
      id: "m2",
      type: "team",
      bestOf: 5,
      sideA: "Team A",
      sideB: "Team B",
      subMatches: [
        { label: "Đôi 1", kind: "doubles", bestOf: 3 },
        { label: "Đơn 1", kind: "singles", bestOf: 3 },
      ],
    });
    expect(prompt).toContain("Team A");
    expect(prompt).toContain("Đôi 1");
    expect(prompt).toContain("Đơn 1");
  });
});

describe("buildBatchPrompt", () => {
  it("builds prompt listing all matches", () => {
    const prompt = buildBatchPrompt({
      type: "doubles",
      matches: [
        { id: "m1", sideA: "A – B", sideB: "C – D", bestOf: 3, hasResult: false },
        { id: "m2", sideA: "E – F", sideB: "G – H", bestOf: 3, hasResult: true },
      ],
    });
    expect(prompt).toContain("A – B");
    expect(prompt).toContain("C – D");
    expect(prompt).toContain("đã có kết quả");
    expect(prompt).toContain("m1");
    expect(prompt).toContain("m2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd .worktrees/ai-match-input
npx vitest run src/lib/ai/prompts.test.ts
```

Expected: FAIL — module `./prompts` not found.

- [ ] **Step 3: Implement prompt builders**

Create `src/lib/ai/prompts.ts`:

```typescript
type SingleMatchContext = {
  id: string;
  type: "doubles" | "team";
  bestOf: 3 | 5;
  sideA: string;
  sideB: string;
  subMatches?: Array<{
    label: string;
    kind: "singles" | "doubles";
    bestOf: 3 | 5;
  }>;
};

type BatchGroupContext = {
  type: "doubles" | "team";
  matches: Array<{
    id: string;
    sideA: string;
    sideB: string;
    bestOf: 3 | 5;
    hasResult: boolean;
    subMatches?: Array<{
      label: string;
      kind: "singles" | "doubles";
      bestOf: 3 | 5;
    }>;
  }>;
};

export function buildSinglePrompt(match: SingleMatchContext): string {
  const subMatchesSection = match.subMatches
    ? `\nCác trận con:\n${match.subMatches.map((s) => `- ${s.label} (${s.kind}, best of ${s.bestOf})`).join("\n")}`
    : "";

  return `Bạn là trợ lý nhập kết quả trận đấu bóng bàn.

Trận đang diễn ra (matchId: "${match.id}"):
- ${match.sideA} vs ${match.sideB}
- Loại: ${match.type === "doubles" ? "đôi" : "đồng đội"}
- Best of ${match.bestOf} sets${subMatchesSection}

Nhiệm vụ:
- Parse kết quả từ text hoặc hình ảnh người dùng gửi
- Điểm mỗi set là số nguyên 0-99
- Không đoán mò — nếu không đọc được rõ ràng hoặc không chắc chắn, từ chối`;
}

export function buildBatchPrompt(group: BatchGroupContext): string {
  const matchList = group.matches
    .map((m) => {
      const status = m.hasResult ? " (đã có kết quả)" : "";
      const subs = m.subMatches
        ? `\n    Trận con: ${m.subMatches.map((s) => `${s.label} (${s.kind}, bo${s.bestOf})`).join(", ")}`
        : "";
      return `  - matchId: "${m.id}" | ${m.sideA} vs ${m.sideB} | bo${m.bestOf}${status}${subs}`;
    })
    .join("\n");

  return `Bạn là trợ lý nhập kết quả bóng bàn.

Các trận trong bảng (${group.type === "doubles" ? "đôi" : "đồng đội"}):
${matchList}

Nhiệm vụ:
- Parse tất cả kết quả có trong input (text hoặc hình ảnh)
- Match tên đội/cặp với danh sách trên (chấp nhận viết tắt, tên gần đúng)
- Dùng matchId tương ứng cho mỗi trận parse được
- Trận nào không khớp tên → đưa vào "unmatched"
- Đánh dấu alreadyHasResult=true nếu trận đó đã có kết quả
- Không đoán mò — nếu không chắc chắn về trận nào, bỏ qua trận đó`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd .worktrees/ai-match-input
npx vitest run src/lib/ai/prompts.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/ai-match-input
git add src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts
git commit -m "feat(ai): add prompt builders for single and batch modes"
```

---

## Task 4: API route — `POST /api/ai/parse-match`

**Files:**
- Create: `src/app/api/ai/parse-match/route.ts`

This task creates the server-side API route. It cannot be unit-tested easily (requires AI Gateway), so we write integration-style validation tests in the next task and manually test via curl.

- [ ] **Step 1: Create the request validation schema**

Create `src/app/api/ai/parse-match/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject, gateway } from "ai";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { buildSinglePrompt, buildBatchPrompt } from "@/lib/ai/prompts";
import {
  SingleResultSchema,
  BatchResultSchema,
  RejectionSchema,
} from "@/lib/ai/schemas";
import type { CoreMessage } from "ai";

const BestOfVal = z.union([z.literal(3), z.literal(5)]);

const SubMatchContextSchema = z.object({
  label: z.string().min(1),
  kind: z.enum(["singles", "doubles"]),
  bestOf: BestOfVal,
});

const SingleMatchSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["doubles", "team"]),
  bestOf: BestOfVal,
  sideA: z.string().min(1),
  sideB: z.string().min(1),
  subMatches: z.array(SubMatchContextSchema).optional(),
});

const BatchGroupSchema = z.object({
  type: z.enum(["doubles", "team"]),
  matches: z
    .array(
      z.object({
        id: z.string().min(1),
        sideA: z.string().min(1),
        sideB: z.string().min(1),
        bestOf: BestOfVal,
        hasResult: z.boolean(),
        subMatches: z.array(SubMatchContextSchema).optional(),
      }),
    )
    .min(1),
});

const RequestSchema = z
  .object({
    text: z.string().min(1).optional(),
    imageBase64: z.string().min(1).optional(),
    match: SingleMatchSchema.optional(),
    group: BatchGroupSchema.optional(),
  })
  .refine((d) => d.text != null || d.imageBase64 != null, {
    message: "Vui lòng nhập text hoặc gửi ảnh",
  })
  .refine((d) => !(d.match != null && d.group != null), {
    message: "Chỉ gửi match hoặc group, không cả hai",
  })
  .refine((d) => d.match != null || d.group != null, {
    message: "Thiếu context: cần match hoặc group",
  });

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const data = RequestSchema.parse(body);

    const isBatch = data.group != null;
    const systemPrompt = isBatch
      ? buildBatchPrompt(data.group!)
      : buildSinglePrompt(data.match!);

    const responseSchema = isBatch
      ? z.union([BatchResultSchema, RejectionSchema])
      : z.union([SingleResultSchema, RejectionSchema]);

    // Build user message content
    const userContent: CoreMessage["content"] = [];
    if (data.imageBase64 != null) {
      userContent.push({ type: "image", image: data.imageBase64 });
    }
    userContent.push({
      type: "text",
      text: data.text ?? "Parse kết quả từ ảnh này",
    });

    const result = await generateObject({
      model: gateway("anthropic/claude-haiku-4.5"),
      schema: responseSchema,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      providerOptions: {
        gateway: { tags: ["feature:match-input"] },
      },
    });

    return NextResponse.json({ data: result.object, error: null });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { data: null, error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    console.error("[ai/parse-match]", err);
    return NextResponse.json(
      {
        data: {
          status: "rejected" as const,
          reason: "AI không xử lý được, vui lòng thử lại",
        },
        error: null,
      },
      { status: 200 },
    );
  }
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd .worktrees/ai-match-input
npx tsc --noEmit src/app/api/ai/parse-match/route.ts 2>&1 || echo "Check errors above"
```

> **Note:** Type-checking may require the full project context. If `tsc` flags import issues, verify the imports are correct and move on — Next.js will catch real errors at build time.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/ai-match-input
git add src/app/api/ai/parse-match/route.ts
git commit -m "feat(ai): add POST /api/ai/parse-match route"
```

---

## Task 5: Client-side AI action function

**Files:**
- Modify: `src/app/admin/_match-actions.ts`

- [ ] **Step 1: Add `parseMatchWithAI` function**

Append to `src/app/admin/_match-actions.ts`:

```typescript
// --- AI parse-match ---

export type AiSingleMatchContext = {
  id: string;
  type: "doubles" | "team";
  bestOf: 3 | 5;
  sideA: string;
  sideB: string;
  subMatches?: Array<{
    label: string;
    kind: "singles" | "doubles";
    bestOf: 3 | 5;
  }>;
};

export type AiBatchGroupContext = {
  type: "doubles" | "team";
  matches: Array<{
    id: string;
    sideA: string;
    sideB: string;
    bestOf: 3 | 5;
    hasResult: boolean;
    subMatches?: Array<{
      label: string;
      kind: "singles" | "doubles";
      bestOf: 3 | 5;
    }>;
  }>;
};

export type AiParseInput = {
  text?: string;
  imageBase64?: string;
} & (
  | { match: AiSingleMatchContext; group?: never }
  | { group: AiBatchGroupContext; match?: never }
);

export type AiParseResponse =
  | {
      status: "ok";
      mode: "single";
      matchId: string;
      result: { sets: SetScore[]; subMatches?: Array<{ label: string; sets: SetScore[] }> };
    }
  | {
      status: "ok";
      mode: "batch";
      parsed: Array<{
        matchId: string;
        sideA: string;
        sideB: string;
        result: { sets: SetScore[]; subMatches?: Array<{ label: string; sets: SetScore[] }> };
        alreadyHasResult: boolean;
      }>;
      unmatched?: string[];
    }
  | { status: "rejected"; reason: string };

export async function parseMatchWithAI(
  input: AiParseInput,
): Promise<AiParseResponse> {
  const res = await fetch("/api/ai/parse-match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as ApiResponse<AiParseResponse>;
  if (!res.ok && !json.data) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  return json.data!;
}
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
cd .worktrees/ai-match-input
npx vitest run
```

Expected: all tests PASS (new function is not tested in isolation — it's a fetch wrapper).

- [ ] **Step 3: Commit**

```bash
cd .worktrees/ai-match-input
git add src/app/admin/_match-actions.ts
git commit -m "feat(ai): add parseMatchWithAI client action"
```

---

## Task 6: VoiceInputButton component

**Files:**
- Create: `src/app/admin/_voice-input-button.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/admin/_voice-input-button.tsx`:

```typescript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type SpeechRecognitionType = typeof window extends { webkitSpeechRecognition: infer T } ? T : never;

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition ??
    (window as unknown as Record<string, unknown>).SpeechRecognition ??
    null
  ) as (new () => SpeechRecognition) | null;
}

export function VoiceInputButton({
  onResult,
  onInterim,
  disabled,
}: {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recogRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognition() != null);
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      recogRef.current?.stop();
      return;
    }

    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "vi-VN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recogRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim && onInterim) onInterim(interim);
      if (final) onResult(final);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
    setListening(true);
  }, [listening, onResult, onInterim]);

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? "Dừng ghi âm" : "Nhập bằng giọng nói"}
      className={listening ? "text-red-500 animate-pulse" : ""}
    >
      {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
    </Button>
  );
}
```

- [ ] **Step 2: Verify the project builds**

```bash
cd .worktrees/ai-match-input
npx vitest run
```

Expected: all existing tests PASS.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/ai-match-input
git add src/app/admin/_voice-input-button.tsx
git commit -m "feat(ai): add VoiceInputButton with Web Speech API"
```

---

## Task 7: AiChatModal component — single mode

**Files:**
- Create: `src/app/admin/_ai-chat-modal.tsx`

This is the core UI component. We build single mode first, then extend for batch in Task 8.

- [ ] **Step 1: Create the modal component (single mode)**

Create `src/app/admin/_ai-chat-modal.tsx`:

```typescript
"use client";

import { useState, useRef } from "react";
import { Sparkles, ImagePlus, Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { VoiceInputButton } from "./_voice-input-button";
import {
  parseMatchWithAI,
  type AiSingleMatchContext,
  type AiParseResponse,
} from "./_match-actions";
import type { SetScore } from "@/lib/schemas/match";

type Message =
  | { role: "user"; text?: string; imageUrl?: string }
  | { role: "ai"; response: AiParseResponse };

export function AiSingleMatchButton({
  matchContext,
  onApply,
  disabled,
}: {
  matchContext: AiSingleMatchContext;
  onApply: (sets: SetScore[], subMatches?: Array<{ label: string; sets: SetScore[] }>) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMessages([]);
    setText("");
    setLoading(false);
    setImageBase64(null);
    setImagePreview(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 4MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      // Strip the data:image/...;base64, prefix
      setImageBase64(dataUrl.replace(/^data:image\/\w+;base64,/, ""));
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const send = async () => {
    const inputText = text.trim() || undefined;
    const inputImage = imageBase64 ?? undefined;
    if (!inputText && !inputImage) return;

    const userMsg: Message = {
      role: "user",
      text: inputText,
      imageUrl: imagePreview ?? undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setText("");
    setImageBase64(null);
    setImagePreview(null);
    setLoading(true);

    try {
      const response = await parseMatchWithAI({
        text: inputText,
        imageBase64: inputImage,
        match: matchContext,
      });
      setMessages((prev) => [...prev, { role: "ai", response }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi kết nối AI");
    } finally {
      setLoading(false);
    }
  };

  const lastAiResponse = [...messages]
    .reverse()
    .find((m): m is Extract<Message, { role: "ai" }> => m.role === "ai");

  const canApply =
    lastAiResponse?.response.status === "ok" &&
    lastAiResponse.response.mode === "single";

  const handleApply = () => {
    if (!canApply) return;
    const res = lastAiResponse!.response;
    if (res.status !== "ok" || res.mode !== "single") return;
    onApply(res.result.sets, res.result.subMatches);
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="AI nhập kết quả"
          />
        }
      >
        <Sparkles className="size-4" />
      </DialogTrigger>
      <DialogContent className="flex max-h-[80dvh] flex-col">
        <DialogHeader>
          <DialogTitle>AI nhập kết quả</DialogTitle>
          <DialogDescription>
            {matchContext.sideA} vs {matchContext.sideB}
          </DialogDescription>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="flex flex-col items-end gap-1">
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Input"
                      className="max-h-40 rounded-lg border"
                    />
                  )}
                  {msg.text && (
                    <div className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                      {msg.text}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <AiResponseDisplay response={msg.response} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang xử lý...
            </div>
          )}
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="relative mx-1 mb-1">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-20 rounded border"
            />
            <button
              type="button"
              onClick={() => {
                setImageBase64(null);
                setImagePreview(null);
              }}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
              aria-label="Xoá ảnh"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-center gap-1.5 border-t pt-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            aria-label="Chọn ảnh"
          >
            <ImagePlus className="size-4" />
          </Button>
          <VoiceInputButton
            onResult={(t) => setText((prev) => prev + t)}
            onInterim={(t) => setText(t)}
            disabled={loading}
          />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Nhập kết quả hoặc gửi ảnh..."
            className="h-8 flex-1 text-sm"
            disabled={loading}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={send}
            disabled={loading || (!text.trim() && !imageBase64)}
            aria-label="Gửi"
          >
            <Send className="size-4" />
          </Button>
        </div>

        {/* Apply button */}
        {canApply && (
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" size="sm" onClick={handleApply}>
              Áp dụng kết quả
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AiResponseDisplay({ response }: { response: AiParseResponse }) {
  if (response.status === "rejected") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Không thể đọc kết quả
        </p>
        <p className="text-muted-foreground">{response.reason}</p>
      </div>
    );
  }

  if (response.mode === "single") {
    return (
      <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
        <p className="mb-1 font-medium">Kết quả:</p>
        <div className="space-y-0.5 tabular-nums">
          {response.result.sets.map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground">Set {i + 1}:</span>
              <span className="font-semibold">
                {s.a} – {s.b}
              </span>
            </div>
          ))}
        </div>
        {response.result.subMatches && (
          <div className="mt-2 space-y-1.5">
            {response.result.subMatches.map((sub, i) => (
              <div key={i}>
                <p className="font-medium">{sub.label}:</p>
                <div className="ml-2 space-y-0.5 tabular-nums">
                  {sub.sets.map((s, j) => (
                    <div key={j} className="flex gap-2">
                      <span className="text-muted-foreground">Set {j + 1}:</span>
                      <span className="font-semibold">
                        {s.a} – {s.b}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // batch mode — handled in Task 8
  return null;
}
```

- [ ] **Step 2: Verify the project builds**

```bash
cd .worktrees/ai-match-input
npx vitest run
```

Expected: all existing tests PASS.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/ai-match-input
git add src/app/admin/_ai-chat-modal.tsx
git commit -m "feat(ai): add AiChatModal with single match mode"
```

---

## Task 8: AiChatModal — extend for batch mode

**Files:**
- Modify: `src/app/admin/_ai-chat-modal.tsx`

- [ ] **Step 1: Add `AiBatchGroupButton` and batch display**

Add to the bottom of `src/app/admin/_ai-chat-modal.tsx`, before the closing of the file. Also update `AiResponseDisplay` to handle batch mode.

Add the batch button component:

```typescript
export function AiBatchGroupButton({
  groupContext,
  onApply,
}: {
  groupContext: AiBatchGroupContext;
  onApply: (results: Array<{ matchId: string; sets: SetScore[]; subMatches?: Array<{ label: string; sets: SetScore[] }> }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMessages([]);
    setText("");
    setLoading(false);
    setImageBase64(null);
    setImagePreview(null);
    setSelected(new Set());
  };

  // handleImageSelect — same as AiSingleMatchButton
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 4MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.replace(/^data:image\/\w+;base64,/, ""));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const send = async () => {
    const inputText = text.trim() || undefined;
    const inputImage = imageBase64 ?? undefined;
    if (!inputText && !inputImage) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: inputText, imageUrl: imagePreview ?? undefined },
    ]);
    setText("");
    setImageBase64(null);
    setImagePreview(null);
    setLoading(true);

    try {
      const response = await parseMatchWithAI({
        text: inputText,
        imageBase64: inputImage,
        group: groupContext,
      });
      setMessages((prev) => [...prev, { role: "ai", response }]);

      // Auto-select matches that don't already have results
      if (response.status === "ok" && response.mode === "batch") {
        const newIds = new Set(
          response.parsed
            .filter((p) => !p.alreadyHasResult)
            .map((p) => p.matchId),
        );
        setSelected(newIds);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi kết nối AI");
    } finally {
      setLoading(false);
    }
  };

  const lastAiResponse = [...messages]
    .reverse()
    .find((m): m is Extract<Message, { role: "ai" }> => m.role === "ai");

  const canApply =
    lastAiResponse?.response.status === "ok" &&
    lastAiResponse.response.mode === "batch" &&
    selected.size > 0;

  const handleApply = () => {
    if (
      !lastAiResponse ||
      lastAiResponse.response.status !== "ok" ||
      lastAiResponse.response.mode !== "batch"
    )
      return;
    const results = lastAiResponse.response.parsed
      .filter((p) => selected.has(p.matchId))
      .map((p) => ({
        matchId: p.matchId,
        sets: p.result.sets,
        subMatches: p.result.subMatches,
      }));
    onApply(results);
    setOpen(false);
    reset();
  };

  const toggleSelected = (matchId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="AI nhập kết quả hàng loạt"
          />
        }
      >
        <Sparkles className="mr-1 size-4" />
        AI
      </DialogTrigger>
      <DialogContent className="flex max-h-[80dvh] flex-col">
        <DialogHeader>
          <DialogTitle>AI nhập kết quả hàng loạt</DialogTitle>
          <DialogDescription>
            {groupContext.matches.length} trận trong bảng
          </DialogDescription>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="flex flex-col items-end gap-1">
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Input" className="max-h-40 rounded-lg border" />
                  )}
                  {msg.text && (
                    <div className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                      {msg.text}
                    </div>
                  )}
                </div>
              ) : (
                <AiResponseDisplay
                  response={msg.response}
                  selected={selected}
                  onToggle={toggleSelected}
                />
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang xử lý...
            </div>
          )}
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="relative mx-1 mb-1">
            <img src={imagePreview} alt="Preview" className="max-h-20 rounded border" />
            <button
              type="button"
              onClick={() => { setImageBase64(null); setImagePreview(null); }}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
              aria-label="Xoá ảnh"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-center gap-1.5 border-t pt-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelect}
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => fileRef.current?.click()} disabled={loading}>
            <ImagePlus className="size-4" />
          </Button>
          <VoiceInputButton
            onResult={(t) => setText((prev) => prev + t)}
            onInterim={(t) => setText(t)}
            disabled={loading}
          />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Nhập kết quả hoặc gửi ảnh..."
            className="h-8 flex-1 text-sm"
            disabled={loading}
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={send} disabled={loading || (!text.trim() && !imageBase64)}>
            <Send className="size-4" />
          </Button>
        </div>

        {/* Apply button */}
        {canApply && (
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-sm text-muted-foreground">{selected.size} trận được chọn</span>
            <Button type="button" size="sm" onClick={handleApply}>
              Áp dụng {selected.size} trận
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Update `AiResponseDisplay` to handle batch mode**

Replace the existing `AiResponseDisplay` function's batch return (`return null`) with actual batch rendering:

```typescript
// Inside AiResponseDisplay, replace the "batch mode — handled in Task 8" comment:
  if (response.mode === "batch") {
    return (
      <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
        <p className="mb-2 font-medium">
          {response.parsed.length} trận được nhận diện:
        </p>
        <div className="space-y-1.5">
          {response.parsed.map((p) => (
            <label
              key={p.matchId}
              className="flex items-start gap-2 rounded p-1 hover:bg-background/60"
            >
              {selected && onToggle && (
                <input
                  type="checkbox"
                  checked={selected.has(p.matchId)}
                  onChange={() => onToggle(p.matchId)}
                  className="mt-0.5"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">
                    {p.sideA} vs {p.sideB}
                  </span>
                  {p.alreadyHasResult && (
                    <span className="rounded bg-amber-500/15 px-1 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                      đã có
                    </span>
                  )}
                </div>
                <div className="tabular-nums text-muted-foreground">
                  {p.result.sets.map((s, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      {s.a}–{s.b}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>
        {response.unmatched && response.unmatched.length > 0 && (
          <div className="mt-2 border-t pt-1.5">
            <p className="text-xs text-muted-foreground">
              Không khớp: {response.unmatched.join(", ")}
            </p>
          </div>
        )}
      </div>
    );
  }
```

Also update the `AiResponseDisplay` function signature to accept optional `selected` and `onToggle` props:

```typescript
function AiResponseDisplay({
  response,
  selected,
  onToggle,
}: {
  response: AiParseResponse;
  selected?: Set<string>;
  onToggle?: (matchId: string) => void;
}) {
```

- [ ] **Step 3: Verify all tests pass**

```bash
cd .worktrees/ai-match-input
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
cd .worktrees/ai-match-input
git add src/app/admin/_ai-chat-modal.tsx
git commit -m "feat(ai): add batch mode to AiChatModal"
```

---

## Task 9: Wire AiSingleMatchButton into match cards

**Files:**
- Modify: `src/app/admin/_components.tsx`

- [ ] **Step 1: Add import**

At the top of `src/app/admin/_components.tsx`, add:

```typescript
import { AiSingleMatchButton } from "./_ai-chat-modal";
```

- [ ] **Step 2: Add AI button to DoublesMatchCard**

In the `DoublesMatchCard` function, find the button row (around line 521). Add `AiSingleMatchButton` after `EditDoublesMatchDialog`:

```typescript
            <AiSingleMatchButton
              matchContext={{
                id: match.id,
                type: "doubles",
                bestOf: match.bestOf,
                sideA: match.pairA.label,
                sideB: match.pairB.label,
              }}
              onApply={(sets) => save({ sets })}
              disabled={pending}
            />
```

The button row should look like:

```typescript
          <div className="flex shrink-0 items-center gap-2">
            <EditDoublesMatchDialog
              title={`Trận ${index}`}
              match={match}
              disabled={pending}
              onSave={save}
            />
            <AiSingleMatchButton
              matchContext={{
                id: match.id,
                type: "doubles",
                bestOf: match.bestOf,
                sideA: match.pairA.label,
                sideB: match.pairB.label,
              }}
              onApply={(sets) => save({ sets })}
              disabled={pending}
            />
            {(match.sets.length > 0 || status !== "scheduled") && (
```

- [ ] **Step 3: Add AI button to TeamMatchCard**

In the `TeamMatchCard` function, find the header area with `LiveToggleButton` (around line 912-918). Add `AiSingleMatchButton` before the `LiveToggleButton`:

Find this code block:

```typescript
          {!readOnly && (
            <LiveToggleButton
```

Add the AI button before it:

```typescript
          {!readOnly && (
            <AiSingleMatchButton
              matchContext={{
                id: match.id,
                type: "team",
                bestOf: 3,
                sideA: match.teamA.name,
                sideB: match.teamB.name,
                subMatches: match.individual.map((s) => ({
                  label: s.label,
                  kind: s.kind,
                  bestOf: s.bestOf,
                })),
              }}
              onApply={(sets, subMatches) => {
                if (subMatches) {
                  // Map AI sub-match results onto existing sub-match IDs by label
                  const updatedSubs = match.individual.map((existing) => {
                    const aiSub = subMatches.find((s) => s.label === existing.label);
                    if (!aiSub) return subMatchToPatch(existing);
                    return {
                      ...subMatchToPatch(existing),
                      sets: aiSub.sets,
                    };
                  });
                  applySubs(updatedSubs);
                }
              }}
              disabled={pending}
            />
          )}
          {!readOnly && (
            <LiveToggleButton
```

> **Note:** `applySubs` is defined inside `TeamMatchCard` (around line 839). It takes the full sub-match array and triggers a debounced save. `subMatchToPatch` is a helper function defined around line 671 that converts `SubMatchResolved` to the patch format.

- [ ] **Step 4: Verify all tests pass**

```bash
cd .worktrees/ai-match-input
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
cd .worktrees/ai-match-input
git add src/app/admin/_components.tsx
git commit -m "feat(ai): wire AI input button into match cards"
```

---

## Task 10: Wire AiBatchGroupButton into group pages

**Files:**
- Modify: `src/app/admin/doubles/groups/[id]/page.tsx`
- Modify: `src/app/admin/teams/groups/[id]/page.tsx`

Both group pages are Server Components. The batch button needs client-side state, so we need a small client wrapper.

- [ ] **Step 1: Create client wrapper for doubles batch button**

The group pages are server components and pass `matches` data down. The batch button needs access to the full match list. The simplest approach: make `DoublesSchedule` and `TeamSchedule` (which are already client components via `useState`) render the batch button.

In `src/app/admin/_components.tsx`, find `DoublesSchedule` (line 321). Add the import at the top of the file (if not already added):

```typescript
import { AiBatchGroupButton } from "./_ai-chat-modal";
```

Then inside the `DoublesSchedule` return, add the batch button next to the `MatchScheduleSection` title area. Find this code:

```typescript
      <MatchScheduleSection
        title="Lịch thi đấu vòng bảng"
        subtitle={`${matches.length} trận · vòng tròn`}
```

Before `<MatchScheduleSection`, add the batch button:

```typescript
      {!readOnly && (
        <AiBatchGroupButton
          groupContext={{
            type: "doubles",
            matches: matches.map((m) => ({
              id: m.id,
              sideA: m.pairA.label,
              sideB: m.pairB.label,
              bestOf: m.bestOf,
              hasResult: m.sets.length > 0,
            })),
          }}
          onApply={async (results) => {
            for (const r of results) {
              try {
                const updated = await patchDoublesMatch(r.matchId, { sets: r.sets });
                handleMatchUpdated(updated);
              } catch (err) {
                toast.error(`Lỗi cập nhật trận: ${err instanceof Error ? err.message : "Unknown"}`);
              }
            }
            toast.success(`Đã cập nhật ${results.length} trận`);
          }}
        />
      )}

      <MatchScheduleSection
```

Add the missing imports at the top (if not already):

```typescript
import { patchDoublesMatch } from "./_match-actions";
import { toast } from "sonner";
```

> **Note:** Check if `patchDoublesMatch` is already imported. If `_components.tsx` only imports types from `_match-actions`, add the function import.

- [ ] **Step 2: Do the same for `TeamSchedule`**

In `TeamSchedule` (line 557), add batch button before `<MatchScheduleSection`. The `TeamSchedule` component already has access to `matches` (type `TeamMatchResolved[]`).

```typescript
      {!readOnly && (
        <AiBatchGroupButton
          groupContext={{
            type: "team",
            matches: matches.map((m) => ({
              id: m.id,
              sideA: m.teamA.name,
              sideB: m.teamB.name,
              bestOf: 3,
              hasResult: m.individual.some((s) => s.sets.length > 0),
              subMatches: m.individual.map((s) => ({
                label: s.label,
                kind: s.kind,
                bestOf: s.bestOf,
              })),
            })),
          }}
          onApply={async (results) => {
            for (const r of results) {
              try {
                const existing = matches.find((m) => m.id === r.matchId);
                if (!existing) continue;
                const updatedSubs = existing.individual.map((sub) => {
                  const aiSub = r.subMatches?.find((s) => s.label === sub.label);
                  return {
                    id: sub.id,
                    label: sub.label,
                    kind: sub.kind,
                    playersA: sub.playersA.map((p) => p.id),
                    playersB: sub.playersB.map((p) => p.id),
                    bestOf: sub.bestOf,
                    sets: aiSub ? aiSub.sets : sub.sets,
                  };
                });
                const updated = await patchTeamMatch(r.matchId, { individual: updatedSubs });
                handleMatchUpdated(updated);
              } catch (err) {
                toast.error(`Lỗi cập nhật trận: ${err instanceof Error ? err.message : "Unknown"}`);
              }
            }
            toast.success(`Đã cập nhật ${results.length} trận`);
          }}
        />
      )}
```

Add import if needed:

```typescript
import { patchDoublesMatch, patchTeamMatch } from "./_match-actions";
```

- [ ] **Step 3: Verify all tests pass**

```bash
cd .worktrees/ai-match-input
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
cd .worktrees/ai-match-input
git add src/app/admin/_components.tsx
git commit -m "feat(ai): wire batch AI button into group schedule views"
```

---

## Task 11: Environment setup and manual testing

**Files:** none (configuration only)

- [ ] **Step 1: Set up AI Gateway**

```bash
cd .worktrees/ai-match-input
vercel link  # if not already linked
vercel env pull .env.local
```

Then enable AI Gateway in Vercel dashboard: `https://vercel.com/{team}/{project}/settings` → AI Gateway.

- [ ] **Step 2: Start dev server and test single match mode**

```bash
cd .worktrees/ai-match-input
npm run dev
```

1. Navigate to `/admin/doubles` → open a group → find a match card
2. Click the sparkle (✦) button
3. Type "11-9 11-7 11-5" → Send
4. Verify AI returns structured result
5. Click "Áp dụng kết quả"
6. Verify match card updates with the scores

- [ ] **Step 3: Test image input**

1. Take a photo of a handwritten score sheet
2. Click the image button in the AI modal
3. Upload the photo
4. Verify AI parses the scores correctly or rejects with reason

- [ ] **Step 4: Test voice input**

1. Click the mic button
2. Say "mười một chín, mười một bảy"
3. Verify speech-to-text converts to text
4. Verify AI parses the text result

- [ ] **Step 5: Test batch mode**

1. Navigate to a group page
2. Click the "AI" batch button
3. Send an image with multiple match results
4. Verify parsed results appear as checklist
5. Select which matches to apply → click Apply
6. Verify selected matches update

- [ ] **Step 6: Test error cases**

1. Send a blurry/unreadable image → verify rejection message
2. Send empty input → verify validation error
3. Test without admin session → verify 401

- [ ] **Step 7: Commit any fixes found during testing**

```bash
cd .worktrees/ai-match-input
git add -A
git commit -m "fix(ai): adjustments from manual testing"
```

---

## Task 12: Run full test suite and final cleanup

- [ ] **Step 1: Run all tests**

```bash
cd .worktrees/ai-match-input
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 2: Type-check the entire project**

```bash
cd .worktrees/ai-match-input
npx tsc --noEmit
```

Fix any type errors found.

- [ ] **Step 3: Final commit if any fixes**

```bash
cd .worktrees/ai-match-input
git add -A
git commit -m "chore: fix type errors and cleanup"
```
