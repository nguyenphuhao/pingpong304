import { NextResponse } from "next/server";
import { z } from "zod";
import { generateObject, gateway } from "ai";
import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { buildSinglePrompt, buildBatchPrompt } from "@/lib/ai/prompts";
import { SingleResultSchema, BatchResultSchema, RejectionSchema } from "@/lib/ai/schemas";
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
  matches: z.array(
    z.object({
      id: z.string().min(1),
      sideA: z.string().min(1),
      sideB: z.string().min(1),
      bestOf: BestOfVal,
      hasResult: z.boolean(),
      subMatches: z.array(SubMatchContextSchema).optional(),
    }),
  ).min(1),
});

const RequestSchema = z.object({
  text: z.string().min(1).optional(),
  imageBase64: z.string().min(1).max(8_000_000).optional(),
  match: SingleMatchSchema.optional(),
  group: BatchGroupSchema.optional(),
}).refine((d) => d.text != null || d.imageBase64 != null, {
  message: "Vui lòng nhập text hoặc gửi ảnh",
}).refine((d) => !(d.match != null && d.group != null), {
  message: "Chỉ gửi match hoặc group, không cả hai",
}).refine((d) => d.match != null || d.group != null, {
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
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { data: null, error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    console.error("[ai/parse-match]", err);
    return NextResponse.json({
      data: { status: "rejected" as const, reason: "AI không xử lý được, vui lòng thử lại" },
      error: null,
    }, { status: 200 });
  }
}
