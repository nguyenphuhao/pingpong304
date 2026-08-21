/**
 * Model dùng cho mọi tính năng AI, gọi qua Vercel AI Gateway.
 *
 * Đặt một chỗ vì trước đây model được lặp ở cả ba route AI — khi tài khoản
 * Gateway hết quyền dùng model, phải sửa ba nơi mới hết lỗi và rất dễ sót.
 *
 * Đổi model thì kiểm hai thứ, đừng chỉ kiểm "có trả lời không":
 *   1. Gọi được tool — chat tra dữ liệu qua tool, model yếu sẽ trả lời chay
 *   2. Chịu được nhiều câu hỏi liên tiếp — gói Gateway giới hạn tần suất
 */
export const AI_MODEL = "anthropic/claude-haiku-4.5";
