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

export const ParseMatchResponseSchema = z.union([
  SingleResultSchema,
  BatchResultSchema,
  RejectionSchema,
]);

export type MatchResult = z.infer<typeof MatchResultSchema>;
export type SingleResult = z.infer<typeof SingleResultSchema>;
export type BatchResult = z.infer<typeof BatchResultSchema>;
export type Rejection = z.infer<typeof RejectionSchema>;
export type ParseMatchResponse = z.infer<typeof ParseMatchResponseSchema>;
