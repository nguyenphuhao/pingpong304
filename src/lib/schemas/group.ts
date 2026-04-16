import { z } from "zod";
import { IdSchema } from "./id";

export const GroupEntriesPatchSchema = z.object({
  entries: z
    .array(IdSchema)
    .refine(
      (arr) => new Set(arr).size === arr.length,
      "entries không được trùng lặp",
    ),
});

export type GroupEntriesPatch = z.infer<typeof GroupEntriesPatchSchema>;

export type GroupEntry = { id: string; label: string };

export type GroupResolved = {
  id: string;
  name: string;
  entries: GroupEntry[];
};
