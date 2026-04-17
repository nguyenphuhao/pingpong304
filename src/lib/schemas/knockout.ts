import { z } from "zod";
import { IdSchema } from "./id";
import {
  SetScoreSchema,
  StatusSchema,
  BestOfSchema,
  SubMatchSchema,
  type SetScore,
  type Status,
  type BestOf,
  type SubMatchResolved,
} from "./match";

// ── Doubles KO ──

export const DoublesKoPatchSchema = z
  .object({
    sets: z.array(SetScoreSchema).max(5).optional(),
    status: StatusSchema.optional(),
    winner: IdSchema.nullable().optional(),
    bestOf: BestOfSchema.optional(),
    table: z.number().int().min(1).max(99).nullable().optional(),
    entryA: IdSchema.nullable().optional(),
    entryB: IdSchema.nullable().optional(),
  })
  .refine((d) => d.status !== "forfeit" || d.winner != null, {
    message: "Forfeit yêu cầu winner",
  });

export type DoublesKoResolved = {
  id: string;
  round: "qf" | "sf" | "f";
  bestOf: BestOf;
  table: number | null;
  labelA: string;
  labelB: string;
  entryA: { id: string; label: string } | null;
  entryB: { id: string; label: string } | null;
  sets: SetScore[];
  setsA: number;
  setsB: number;
  status: Status;
  winner: { id: string; label: string } | null;
  nextMatchId: string | null;
  nextSlot: "a" | "b" | null;
};

// ── Teams KO ──

export const TeamKoPatchSchema = z
  .object({
    individual: z.array(SubMatchSchema).min(1).max(7).optional(),
    status: StatusSchema.optional(),
    winner: IdSchema.nullable().optional(),
    entryA: IdSchema.nullable().optional(),
    entryB: IdSchema.nullable().optional(),
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

export type TeamKoResolved = {
  id: string;
  round: "qf" | "sf" | "f";
  labelA: string;
  labelB: string;
  entryA: { id: string; name: string } | null;
  entryB: { id: string; name: string } | null;
  scoreA: number;
  scoreB: number;
  status: Status;
  winner: { id: string; name: string } | null;
  individual: SubMatchResolved[];
  nextMatchId: string | null;
  nextSlot: "a" | "b" | null;
};

export type KoRound = "qf" | "sf" | "f";

export const ROUND_LABEL: Record<KoRound, string> = {
  qf: "Tứ kết",
  sf: "Bán kết",
  f: "Chung kết",
};
