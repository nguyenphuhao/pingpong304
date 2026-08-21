/**
 * Model dùng cho mọi tính năng AI, gọi qua Vercel AI Gateway.
 *
 * Trước đây là "anthropic/claude-haiku-4.5", nhưng tài khoản Gateway của dự án
 * đang ở gói miễn phí và model đó đòi credit trả phí — cả ba route AI cùng trả
 * về lỗi "Free tier users do not have access to this model", nghĩa là người xem
 * bấm vào trợ lý rồi không nhận được gì.
 *
 * Đặt một chỗ để đổi model không phải sửa ba file và không sợ sót.
 */
export const AI_MODEL = "openai/gpt-5-nano";
