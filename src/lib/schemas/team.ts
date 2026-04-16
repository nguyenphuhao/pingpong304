import { z } from "zod";
import { IdSchema } from "./id";

const membersSchema = z
  .array(IdSchema)
  .length(3, "Đội phải có đúng 3 VĐV")
  .refine((arr) => new Set(arr).size === arr.length, {
    message: "VĐV không được trùng",
  });

export const TeamInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên đội không được để trống")
    .max(60, "Tên đội tối đa 60 ký tự"),
  members: membersSchema,
});

export const TeamPatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên đội không được để trống")
    .max(60, "Tên đội tối đa 60 ký tự")
    .optional(),
  members: membersSchema.optional(),
});

export type TeamInput = z.infer<typeof TeamInputSchema>;
export type TeamPatch = z.infer<typeof TeamPatchSchema>;

export type TeamWithNames = {
  id: string;
  name: string;
  members: Array<{ id: string; name: string }>;
};
