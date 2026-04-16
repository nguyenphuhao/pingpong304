import { z } from "zod";
import { IdSchema } from "./id";

export const PairInputSchema = z
  .object({
    p1: IdSchema,
    p2: IdSchema,
  })
  .refine((d) => d.p1 !== d.p2, {
    message: "2 VĐV phải khác nhau",
    path: ["p2"],
  });

export const PairPatchSchema = z
  .object({
    p1: IdSchema.optional(),
    p2: IdSchema.optional(),
  })
  .refine((d) => !d.p1 || !d.p2 || d.p1 !== d.p2, {
    message: "2 VĐV phải khác nhau",
    path: ["p2"],
  });

export type PairInput = z.infer<typeof PairInputSchema>;
export type PairPatch = z.infer<typeof PairPatchSchema>;

export type PairWithNames = {
  id: string;
  p1: { id: string; name: string };
  p2: { id: string; name: string };
};
