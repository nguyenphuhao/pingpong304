import { z } from "zod";
import { IdSchema } from "./id";

export const SetScoreSchema = z.object({
  a: z.number().int().min(0).max(99),
  b: z.number().int().min(0).max(99),
});

export const StatusSchema = z.enum(["scheduled", "done", "forfeit", "live"]);
export const BestOfSchema = z.union([z.literal(3), z.literal(5)]);

export const SubMatchSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).max(50),
    kind: z.enum(["singles", "doubles"]),
    playersA: z.array(IdSchema).max(2),
    playersB: z.array(IdSchema).max(2),
    bestOf: BestOfSchema,
    sets: z.array(SetScoreSchema).max(5),
  })
  .refine(
    (s) => {
      const limit = s.kind === "singles" ? 1 : 2;
      const aOk = s.playersA.length === 0 || s.playersA.length === limit;
      const bOk = s.playersB.length === 0 || s.playersB.length === limit;
      return aOk && bOk;
    },
    { message: "Số VĐV không khớp loại sub-match" },
  )
  .refine((s) => s.sets.length <= s.bestOf, {
    message: "Số set vượt quá bestOf",
  });

export const DoublesMatchPatchSchema = z
  .object({
    sets: z.array(SetScoreSchema).max(5).optional(),
    status: StatusSchema.optional(),
    winner: IdSchema.nullable().optional(),
    table: z.number().int().min(1).max(99).nullable().optional(),
    bestOf: BestOfSchema.optional(),
  })
  .refine((d) => d.status !== "forfeit" || d.winner != null, {
    message: "Forfeit yêu cầu winner",
  });

export const TeamMatchPatchSchema = z
  .object({
    individual: z.array(SubMatchSchema).min(1).max(7).optional(),
    status: StatusSchema.optional(),
    winner: IdSchema.nullable().optional(),
    table: z.number().int().min(1).max(99).nullable().optional(),
  })
  .refine((d) => d.status !== "forfeit" || d.winner != null, {
    message: "Forfeit yêu cầu winner",
  })
  .refine(
    (d) => {
      if (!d.individual) return true;
      const ids = d.individual.map((s) => s.id);
      return new Set(ids).size === ids.length;
    },
    { message: "Sub-match ID trùng trong array" },
  );

export type SetScore = z.infer<typeof SetScoreSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type BestOf = z.infer<typeof BestOfSchema>;
export type SubMatch = z.infer<typeof SubMatchSchema>;

export type MatchResolved = {
  id: string;
  groupId: string;
  pairA: { id: string; label: string };
  pairB: { id: string; label: string };
  table: number | null;
  bestOf: BestOf;
  sets: SetScore[];
  setsA: number;
  setsB: number;
  status: Status;
  winner: { id: string; label: string } | null;
};

export type SubMatchResolved = {
  id: string;
  label: string;
  kind: "singles" | "doubles";
  playersA: Array<{ id: string; name: string }>;
  playersB: Array<{ id: string; name: string }>;
  bestOf: BestOf;
  sets: SetScore[];
};

export type TeamMatchResolved = {
  id: string;
  groupId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  table: number | null;
  scoreA: number;
  scoreB: number;
  status: Status;
  winner: { id: string; name: string } | null;
  individual: SubMatchResolved[];
};
