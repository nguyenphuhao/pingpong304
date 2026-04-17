# AI Match Input — Design Spec

## Overview

Tích hợp AI để parse kết quả trận đấu từ voice (Speech-to-Text) và hình ảnh (vision) — cho phép admin nhập/sửa kết quả nhanh hơn thay vì gõ thủ công từng set score.

**Flow**: Admin nhận ảnh/voice từ trọng tài → mở AI modal trong app → AI parse → review → apply.

## Approach

Single-turn AI parse. Mỗi lần gửi input (text hoặc image) = 1 API call đến AI Gateway. Không multi-turn, không streaming. AI trả về structured JSON hoặc rejection.

## Two Modes

### Single Match Mode

- Entry point: nút sparkle icon trên mỗi match card (doubles hoặc team)
- Modal mở với context của trận cụ thể (pairA/B, teamA/B, bestOf, sub-matches)
- AI chỉ parse score — không cần fuzzy match tên vì context đã có sẵn

### Batch Mode

- Entry point: nút sparkle icon trên group page header
- Modal mở với context toàn bộ matches trong group
- AI parse nhiều trận từ 1 ảnh/text → match với đúng trận trong group bằng tên
- UI hiển thị danh sách trận parsed, phân biệt "mới" vs "đã có kết quả"
- Admin chọn trận nào muốn apply (checkbox)

## Architecture

```
Input (text/image) + Match/Group Context
     ↓
POST /api/ai/parse-match
     ↓
AI Gateway → anthropic/claude-haiku-4.5 (vision)
     ↓
generateObject (Zod schema) → Structured JSON or rejection
     ↓
Preview in modal → Admin confirms
     ↓
PATCH /api/doubles/matches/[id]   (existing API)
PATCH /api/teams/matches/[id]     (existing API)
```

## API Route

### `POST /api/ai/parse-match`

Auth: `requireAdmin()`

#### Request

```typescript
type ParseMatchRequest = {
  // Input — at least one required
  text?: string;
  imageBase64?: string;

  // Mode 1: Single match (from match card)
  match?: {
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

  // Mode 2: Batch (from group page)
  group?: {
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
};
```

- `match` or `group` — never both.

#### Response

```typescript
// Single match success
type SingleResult = {
  status: "ok";
  mode: "single";
  matchId: string;
  result: MatchResult;
};

// Batch success
type BatchResult = {
  status: "ok";
  mode: "batch";
  parsed: Array<{
    matchId: string;
    sideA: string;
    sideB: string;
    result: MatchResult;
    alreadyHasResult: boolean;
  }>;
  unmatched?: string[];
};

type MatchResult = {
  sets: Array<{ a: number; b: number }>;
  subMatches?: Array<{
    label: string;
    sets: Array<{ a: number; b: number }>;
  }>;
};

// Rejection (both modes)
type ParseMatchRejection = {
  status: "rejected";
  reason: string;
};
```

## AI Prompt Design

### System prompt — single mode

```
Bạn là trợ lý nhập kết quả trận đấu bóng bàn.

Trận đang diễn ra:
- {sideA} vs {sideB}
- Best of {bestOf} sets
{subMatches nếu team match}

Nhiệm vụ:
- Parse kết quả từ text hoặc hình ảnh
- Trả về JSON theo format chính xác
- Nếu không đọc được rõ ràng → trả rejection với lý do cụ thể
- Điểm mỗi set là số nguyên 0-99
- Không đoán mò — nếu không chắc chắn, từ chối
```

### System prompt — batch mode

```
Bạn là trợ lý nhập kết quả bóng bàn.

Các trận trong bảng:
{danh sách matches với sideA, sideB, hasResult flag}

Nhiệm vụ:
- Parse tất cả kết quả có trong input
- Match tên đội/cặp với danh sách trên (chấp nhận viết tắt, tên gần đúng)
- Trả về JSON với matchId cho mỗi trận parse được
- Trận nào không khớp tên → đưa vào "unmatched"
- Không đoán mò — nếu không chắc chắn về trận nào, bỏ qua trận đó
```

Temperature = 0. Max tokens ~1000.

## Tech Stack

### Dependencies

```
ai@^6.0.0    — Vercel AI SDK core
```

No provider-specific packages. AI Gateway routes via plain string.

### AI Gateway

- Model: `gateway("anthropic/claude-haiku-4.5")`
- Auth: OIDC (default) — `vercel env pull` for `VERCEL_OIDC_TOKEN`
- No provider API keys needed
- Tags: `["feature:match-input"]` for cost tracking
- Switching model later: change the string only

### Implementation

```typescript
import { generateObject, gateway } from "ai";

const result = await generateObject({
  model: gateway("anthropic/claude-haiku-4.5"),
  schema: parseMatchResponseSchema,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ],
  temperature: 0,
  providerOptions: {
    gateway: { tags: ["feature:match-input"] },
  },
});
```

Image input via AI SDK multimodal messages:

```typescript
{ role: "user", content: [
  { type: "image", image: base64String },
  { type: "text", text: "Parse kết quả từ ảnh này" }
]}
```

## UI Components

### 1. `AiInputButton`

- Sparkle icon (lucide-react `Sparkles`)
- Renders on each match card (single mode) and group page header (batch mode)
- Click → opens `AiChatModal`

### 2. `AiChatModal`

- Reuse shadcn `Dialog`
- Header: match info (single) or group info (batch)
- Message area:
  - User message: text or image thumbnail
  - AI response (single): formatted set scores table + Apply button
  - AI response (batch): checklist of parsed matches with badges ("mới" / "đã có" / "không khớp")
  - Rejection: reason text + prompt to retry
- Input bar: `[📷 Upload] [🎤 Voice] [text input] [Send]`
- Footer: `[Apply]` + `[Cancel]` (appear when result available)

### 3. `VoiceInputButton`

- Wraps Web Speech API (`webkitSpeechRecognition`)
- `lang="vi-VN"`
- States: idle → listening (animated pulse) → done
- Interim text shown in real-time in text input
- Browser không support → hide button (feature detection)

## Input Handling

### Image

- `<input type="file" accept="image/*" capture="environment">`
- Client-side: resize to max 1024px width if larger, convert to base64
- Max 4MB after resize
- Show thumbnail preview in message area

### Voice

- Browser Speech-to-Text (Web Speech API) → text
- Text sent to AI as regular text input
- No audio file upload — browser handles transcription

### Text

- Direct text input — admin types or pastes result
- e.g. "11-9 11-7 8-11 11-5"

## Error Handling

### AI errors

- `generateObject` schema mismatch → catch → return rejection "AI không xử lý được, thử lại"
- AI Gateway 503 → "Dịch vụ AI tạm thời không khả dụng"
- Rate limit 429 → "Quá nhiều request, vui lòng thử lại sau"

### Input validation

- No text and no image → 400 "Vui lòng nhập text hoặc gửi ảnh"
- Image too large (>4MB after resize) → client-side error
- No match/group context → 400

### Speech-to-Text

- Browser không support → hide voice button
- STT returns empty → "Không nghe được, thử lại"

### Batch edge cases

- Parsed match không khớp tên → `unmatched[]`, UI hiện riêng
- Ảnh chỉ chứa 1 trận → return 1 result
- Tất cả đã có kết quả → parse, hiện badge "đã có", uncheck mặc định

### Apply errors

- PATCH fail → toast error, modal stays open
- Partial batch apply (some OK, some fail) → report per match, user retries failed ones

## File Structure

New files only — existing files (`_components.tsx`, API routes) are modified in place.

```
src/
├── app/
│   ├── api/ai/
│   │   └── parse-match/
│   │       └── route.ts              # POST handler (new)
│   └── admin/
│       ├── _ai-chat-modal.tsx        # Modal with chat UI (new)
│       ├── _ai-input-button.tsx      # Sparkle button (new)
│       └── _voice-input-button.tsx   # Speech-to-Text (new)
├── lib/
│   └── ai/
│       ├── prompts.ts                # System prompt builders (new)
│       └── schemas.ts                # Zod schemas for AI response (new)
```

Note: Admin components currently live in `src/app/admin/_components.tsx` (single file).
New AI components are separate files following the `_` prefix convention for co-located private modules.

## Out of Scope

- Multi-turn conversation / follow-up questions from AI
- Streaming responses
- Audio file upload (only browser STT)
- Automatic match creation (only update existing matches)
- History of AI interactions
