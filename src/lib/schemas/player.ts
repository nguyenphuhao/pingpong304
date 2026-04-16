import { z } from "zod";

export const PlayerInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên VĐV không được để trống")
    .max(80, "Tên VĐV tối đa 80 ký tự"),
  gender: z.enum(["M", "F"], "Chọn Nam hoặc Nữ"),
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
