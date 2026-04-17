import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  gateway,
  type SystemModelMessage,
  type UIMessage,
} from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ai/chat/rate-limit";
import { buildSystemPrompt } from "@/lib/ai/chat/system-prompt";
import { chatTools } from "@/lib/ai/chat/tools";

export const maxDuration = 30;

const RequestSchema = z.object({
  messages: z.array(z.unknown()),
  context: z
    .object({ currentPage: z.string().optional() })
    .optional()
    .default({}),
});

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Quá nhiều yêu cầu, thử lại sau." }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(rl.retryAfterSec ?? 3600),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body không hợp lệ" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: parsed.error.issues.map((i) => i.message).join("; "),
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const systemParts = buildSystemPrompt(parsed.data.context ?? {});
  const system: Array<SystemModelMessage> = systemParts.map((p) => ({
    role: "system" as const,
    content: p.text,
    ...(p.providerOptions
      ? { providerOptions: p.providerOptions as ProviderOptions }
      : {}),
  }));

  const messages = await convertToModelMessages(
    parsed.data.messages as Array<Omit<UIMessage, "id">>,
  );

  const result = streamText({
    model: gateway("anthropic/claude-haiku-4.5"),
    system,
    messages,
    tools: chatTools,
    stopWhen: stepCountIs(5),
    temperature: 0.3,
    providerOptions: {
      gateway: { tags: ["feature:chat"] },
    },
    experimental_telemetry: { isEnabled: true, functionId: "chat" },
  });

  return result.toUIMessageStreamResponse();
}
