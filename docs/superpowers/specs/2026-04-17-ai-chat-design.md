# AI Chat cho giải bóng bàn — Design Spec

**Ngày**: 2026-04-17
**Status**: Approved for implementation
**Scope**: V1

---

## 1. Mục tiêu

Tích hợp AI chat vào app giải đấu bóng bàn cho VĐV và khán giả, tăng tính tương tác. User có thể hỏi bằng tiếng Việt tự nhiên về:

1. Thống kê cặp/đội: đã đánh bao nhiêu trận, còn bao nhiêu, đối thủ tiếp theo
2. Xác suất vào vòng trong + kịch bản cần thắng
3. Bảng điểm hiện tại
4. Điều lệ giải
5. So sánh 2 cặp/đội
6. Phân tích phong độ (AI commentary dựa trên data)
7. Lịch trận sắp tới

## 2. Ràng buộc & quyết định đã chốt

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Public access, floating bubble ở mọi page (trừ `/admin`) | Rào cản thấp nhất, tối đa tương tác |
| 2 | Thuật toán deterministic cho xác suất (không để LLM đoán) | Con số phải chính xác, LLM không reliable với tính toán |
| 3 | Điều lệ = file markdown `docs/tournament-rules.md` (user viết tay) | Version control, dễ chỉnh, chứa được phần "mềm" (giải thưởng, trang phục...) |
| 4 | Model: **Claude Haiku 4.5** qua Vercel AI Gateway | Đủ năng lực vì heavy lifting đã ở tools; latency thấp, chi phí rẻ |
| 5 | Binary enumeration kịch bản (không Monte Carlo) | Data nhỏ (≤10 trận pending/bảng → 1024 scenarios); winner-sweep assumption |
| 6 | Rules inject vào system prompt với prompt caching (không RAG/embeddings) | File nhỏ <2k tokens, caching free sau request đầu, giảm phân mảnh context |
| 7 | Stateless V1 (không lưu lịch sử chat) | Giảm scope; session ephemeral trong React state |
| 8 | Tiếng Việt only, V1 | Đối tượng người dùng |
| 9 | Implement trong git worktree mới | Isolation với work hiện tại |

## 3. Kiến trúc

```
User (browser)
  ↓ message
Floating Chat Bubble (client, @ai-sdk/react useChat)
  ↓ fetch POST
/api/ai/chat (Vercel Function, Fluid Compute, maxDuration=30)
  ↓ streamText() với 7 tools
Claude Haiku 4.5 (via Vercel AI Gateway "anthropic/claude-haiku-4-5")
  ↓ model tự quyết định gọi tool
Tools (deterministic TS, pure functions):
  findEntity, getEntityStats, getStandings, getUpcomingMatches,
  computeQualificationOdds, comparePairs, analyzeForm
  ↓ JSON structured
Claude tổng hợp → stream text về client
```

### 3.1 Tools (7)

| Tool | Input | Output |
|---|---|---|
| `findEntity` | `{ query: string }` | `{ type, id, groupId, label, matchedOn }` — fuzzy match top-3 |
| `getEntityStats` | `{ entityId, type: 'pair'\|'team' }` | `{ played, won, lost, remaining, nextOpponent, streak }` |
| `getStandings` | `{ groupId }` | `StandingRow[]` + label |
| `getUpcomingMatches` | `{ entityId?, groupId?, limit? }` | `Match[]` sorted by scheduled time |
| `computeQualificationOdds` | `{ groupId, entityId, advanceCount? = 2 }` | Xem §4 |
| `comparePairs` | `{ entityIdA, entityIdB }` | `{ h2h, formA, formB, commonOpponents, setsAvg }` |
| `analyzeForm` | `{ entityId, lastN = 5 }` | `{ lastMatches, streak, avgSetDiff, momentum, winRate }` |

Tất cả tools:
- Pure functions, không side-effect
- Trả về JSON structured (AI tự diễn giải thành prose)
- Throw typed errors `{ code, message }` → AI xin lỗi đúng ngữ cảnh

### 3.2 API endpoint

`src/app/api/ai/chat/route.ts`:

```ts
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, context } = await req.json();
  const result = streamText({
    model: 'anthropic/claude-haiku-4-5',
    system: buildSystemPrompt(context),
    messages: convertToModelMessages(messages),
    tools: { findEntity, getEntityStats, ... },
    stopWhen: stepCountIs(5),
    experimental_telemetry: { isEnabled: true, functionId: 'chat' },
  });
  return result.toUIMessageStreamResponse();
}
```

### 3.3 System prompt

```
Bạn là trợ lý AI của giải bóng bàn [TENGIAIDAU].
Nhiệm vụ: trả lời VĐV và khán giả về thông tin giải — trận, bảng điểm,
xác suất, điều lệ, phong độ.

Quy tắc:
- Luôn dùng tool để lấy số liệu, KHÔNG được tự đoán
- Nếu user gõ tên cặp/đội, gọi findEntity trước để lấy id
- Trả lời tiếng Việt, ngắn gọn, dùng bullet khi có nhiều thông tin
- Nếu không có tool phù hợp, nói thẳng "Tôi không có thông tin này"
- Context hiện tại: user đang xem trang {currentPage}

# Điều lệ giải (cached)
{nội dung từ docs/tournament-rules.md}
```

Phần rules được đính kèm với `providerOptions.anthropic.cacheControl = { type: 'ephemeral' }` → Claude cache 5 phút.

## 4. Thuật toán xác suất vào vòng trong

### 4.1 Input/Output

```ts
computeQualificationOdds({ groupId, entityId, advanceCount = 2 }) → {
  status: 'qualified' | 'eliminated' | 'alive',
  probability: number,        // 0-100
  totalScenarios: number,
  qualifyingScenarios: number,
  ownMatches: [
    { matchId, opponent, pIfWin, pIfLose, critical: boolean }
  ],
  externalMatches: [
    { matchId, pairA, pairB, impact: 'high'|'medium'|'low' }
  ],
  scenarios: [
    { description: string, probability: number, ambiguous?: boolean }
  ],
  ambiguousRate: number       // % kịch bản tie không giải quyết được
}
```

### 4.2 Logic

1. Fetch group entries + matches từ DB
2. Tách done vs pending; nếu pending = 0 → status `qualified` hoặc `eliminated`
3. Enumerate `2^N` kịch bản binary (A thắng hoặc B thắng)
4. Với mỗi kịch bản:
   - Synthesize `MatchResolved[]` với winner-sweep set score (2-0 cho bestOf 3, 3-0 cho bestOf 5)
   - Gọi `computeDoublesStandings(entries, allMatches)` hoặc `computeTeamStandings(...)` từ `src/lib/standings/compute.ts` (tái sử dụng, zero drift)
   - Check `rank <= advanceCount` của target
5. Tổng hợp:
   - `probability = qualifying / total`
   - `critical` = match mà `pIfWin - pIfLose > 40%`
   - `impact` cho external match: compute marginal change khi flip kết quả
   - `scenarios` narrative: group các kịch bản theo điều kiện ("nếu thắng A", "nếu thua A nhưng thắng B")
6. Nếu standings trả `rank` tied (không resolve được sau tiebreaker) → flag `ambiguous`

### 4.3 Luật tiebreaker (từ `src/lib/standings/tiebreaker.ts`)

- **Primary**: `won` DESC
- **Tie 2 entries**: H2H → `diff` (toàn bảng) → `setsWon` (toàn bảng)
- **Tie 3+ entries**: mini-league chỉ giữa các tied entries (won → diff → setsWon), recursive, depth ≤2
- **Chưa đá trận nào**: xếp cuối, alphabetical

### 4.4 Performance

- Doubles (5 cặp/bảng): max 10 trận → 1024 scenarios × O(n log n) standings ≈ <50ms
- Teams (4 đội/bảng): max 6 trận → 64 scenarios ≈ <10ms
- Không cần cache V1

## 5. Điều lệ & system prompt caching

### 5.1 File `docs/tournament-rules.md`

User viết tay, cấu trúc heading:

```md
# Điều lệ giải [TENGIAI]
## 1. Thông tin chung
## 2. Cơ cấu thi đấu
### 2.1 Nội dung đôi
### 2.2 Nội dung đồng đội
## 3. Thể thức ván đấu
## 4. Xếp hạng & tiebreaker
## 5. Vòng knockout
## 6. Giải thưởng
## 7. Quy định kỹ thuật
## 8. Khiếu nại & kỷ luật
```

### 5.2 Loader

`src/lib/ai/rules.ts`: đọc 1 lần ở module scope (Fluid Compute reuse instance). Nội dung inject vào system prompt với cache marker.

### 5.3 Validation

`scripts/validate-rules.ts` chạy ở build: đảm bảo file tồn tại, có H1, không trống.

### 5.4 Upgrade path

Nếu file >20KB → chuyển sang heading-based chunking hoặc embeddings. Không cần V1.

## 6. UI — Floating Chat Bubble

### 6.1 Component tree

```
<FloatingChatBubble>           ← mount ở root layout
  <ChatLauncher />             ← nút tròn 56px, góc dưới-phải
  <ChatWindow open={open}>
    <ChatHeader />
    <MessageList>
      <UserMessage />
      <AssistantMessage>
        <ToolInvocationBadge /> ← chip "⏳ đang tính xác suất..."
        <Markdown />
      </AssistantMessage>
    </MessageList>
    <SuggestedPrompts />       ← 3 gợi ý theo currentPage
    <MessageInput />
  </ChatWindow>
</FloatingChatBubble>
```

### 6.2 Sizing & responsive

- Desktop: 400×600px, fixed bottom-right, offset 16px
- Mobile <640px: full-screen modal; launcher bottom-right 16px
- Unread dot khi streaming xong trong lúc panel đóng

### 6.3 Suggested prompts theo context

- `/d/[id]` (bảng doubles): "Xác suất cặp X vào vòng trong?", "Bảng điểm hiện tại?", "Trận tiếp theo?"
- `/t/[id]` (bảng teams): tương tự cho đội
- `/` (home): "Giải này có thể lệ gì?", "Hôm nay có trận nào?"
- Fallback: 3 câu chung

### 6.4 Accessibility

- Launcher `aria-label="Mở trợ lý AI"`
- Panel `role="dialog"`, `aria-modal` trên mobile
- Focus trap khi mở, ESC để đóng
- Enter gửi, Shift+Enter xuống dòng

### 6.5 Integration

- Mount 1 lần ở `src/app/layout.tsx`
- `usePathname()` → `currentPage` context → suggested prompts + system prompt
- **Loại trừ: `/admin/**`** (admin đã có AI chat riêng cho parse kết quả)

## 7. Rate limiting & abuse protection

- **Rate limit**: 20 messages/IP/giờ. Dùng `@upstash/ratelimit` + Upstash Redis qua Vercel Marketplace nếu đã có; nếu chưa → in-memory LRU cho V1 (chấp nhận không-cluster-safe, flag là temporary, upgrade khi traffic tăng).
- **Max input**: 500 chars client-side + server-side check.
- **Tool-call cap**: `stopWhen: stepCountIs(5)` — chặn AI loop.
- **Timeout**: `maxDuration = 30` giây.
- **BotID**: không bật V1; theo dõi abuse, bật sau nếu cần.

## 8. Testing

### 8.1 Unit tests (V1 bắt buộc)

| File | Coverage |
|---|---|
| `src/lib/ai/qualification.test.ts` | Đã qualified → 100%, đã loại → 0%, 1 trận còn lại, N trận với tiebreaker, ambiguous scenario, doubles + teams |
| `src/lib/ai/tools/*.test.ts` | Mỗi tool: happy path + not found + invalid input |
| `src/lib/ai/compare.test.ts` | H2H count, form diff, common opponents |
| `src/lib/ai/form.test.ts` | Streak detection, momentum với N=5 |

**Test fixtures**: Tái sử dụng `src/app/admin/_mock.ts` + thêm 1 fixture edge case (3-way tie).

### 8.2 Integration test

`src/app/api/ai/chat/route.test.ts` — mock model, verify tool được gọi đúng args. Dùng `mockLanguageModelV2` pattern của AI SDK.

### 8.3 Không test V1

- UI components (floating bubble, message list) — test thủ công
- Streaming — trust AI SDK

## 9. Telemetry

- `experimental_telemetry: { isEnabled: true, functionId: 'chat' }` → Vercel Observability
- Log per request: `tokens_in`, `tokens_out`, `tool_calls[]`, `latency_ms`, `user_ip_hash`
- Monitoring: Vercel Functions tab

## 10. Rollout

| Step | Hành động |
|---|---|
| 1 | Implement trong git worktree mới (`../pingpong304-ai-chat` hoặc tương tự) |
| 2 | Merge PR → deploy preview → test thủ công 10 prompts chính |
| 3 | Merge vào main với `NEXT_PUBLIC_CHAT_ENABLED=false` → chat ẩn ở prod |
| 4 | Dùng preview URL (không set env var ẩn) để test mobile thật 1-2 ngày |
| 5 | Bật `NEXT_PUBLIC_CHAT_ENABLED=true` ở prod, theo dõi 48h (error rate, cost/ngày, response quality) |
| 6 | Rollback qua flag (set lại `false`, redeploy) nếu cost >$2/ngày hoặc error rate >2% |

## 11. Files mới

```
src/app/api/ai/chat/route.ts
src/app/api/ai/chat/route.test.ts
src/lib/ai/qualification.ts
src/lib/ai/qualification.test.ts
src/lib/ai/compare.ts
src/lib/ai/compare.test.ts
src/lib/ai/form.ts
src/lib/ai/form.test.ts
src/lib/ai/rules.ts
src/lib/ai/prompts/chat-system.ts       # system prompt builder
src/lib/ai/tools/find-entity.ts
src/lib/ai/tools/get-entity-stats.ts
src/lib/ai/tools/get-standings.ts
src/lib/ai/tools/get-upcoming-matches.ts
src/lib/ai/tools/compute-qualification-odds.ts
src/lib/ai/tools/compare-pairs.ts
src/lib/ai/tools/analyze-form.ts
src/lib/ai/tools/index.ts                # barrel
src/lib/ai/tools/__tests__/*.test.ts
src/lib/ai/rate-limit.ts
src/components/chat/floating-chat-bubble.tsx
src/components/chat/chat-launcher.tsx
src/components/chat/chat-window.tsx
src/components/chat/message-list.tsx
src/components/chat/message-input.tsx
src/components/chat/suggested-prompts.tsx
src/components/chat/tool-invocation-badge.tsx
docs/tournament-rules.md
scripts/validate-rules.ts
```

## 12. Files chỉnh sửa

```
src/app/layout.tsx          # mount <FloatingChatBubble />
package.json                # thêm @ai-sdk/react, có thể @upstash/ratelimit
```

## 13. Rủi ro

| Rủi ro | Mitigation |
|---|---|
| Haiku hiểu sai tên cặp/đội | `findEntity` fuzzy match, trả top-3 cho AI chọn |
| Rules file lỗi thời so với code | `validate-rules.ts` ở build + nhắc user khi đổi format giải |
| Tool error bubble lên UI xấu | Standardize error shape, hướng dẫn AI nói lịch sự |
| Public abuse/scrape | Rate limit + BotID nếu cần |
| Kịch bản tie không resolve được | `ambiguous` flag, AI báo rõ cho user |
| Winner-sweep assumption sai tiebreaker | Chấp nhận V1; flag `ambiguous` khi tie; upgrade Monte Carlo nếu user phàn nàn |

## 14. Out of scope (V2+)

- Lưu lịch sử hội thoại (DB)
- Voice input
- Dự đoán chung cuộc
- Gợi ý câu hỏi bằng AI (thay vì hardcoded)
- Real-time notification khi có kết quả mới
- Multi-language
- Cross-tournament chat
