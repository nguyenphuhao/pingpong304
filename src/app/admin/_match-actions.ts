import type {
  MatchResolved,
  TeamMatchResolved,
  Status,
  SetScore,
  BestOf,
  SubMatch,
} from "@/lib/schemas/match";

type ApiResponse<T> = { data: T | null; error: string | null };

export async function patchDoublesMatch(
  id: string,
  body: {
    sets?: SetScore[];
    status?: Status;
    winner?: string | null;
    table?: number | null;
    bestOf?: BestOf;
  },
): Promise<MatchResolved> {
  const res = await fetch(`/api/doubles/matches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<MatchResolved>;
  if (!res.ok || !json.data) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  return json.data;
}

export async function patchTeamMatch(
  id: string,
  body: {
    individual?: SubMatch[];
    status?: Status;
    winner?: string | null;
    table?: number | null;
  },
): Promise<TeamMatchResolved> {
  const res = await fetch(`/api/teams/matches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<TeamMatchResolved>;
  if (!res.ok || !json.data) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  return json.data;
}

/** Auto-reseed KO bracket if no KO match has started yet. */
export async function tryAutoReseedKo(kind: "doubles" | "teams"): Promise<void> {
  const base = kind === "doubles" ? "doubles" : "teams";
  // Fetch current bracket
  const res = await fetch(`/api/${base}/ko`);
  if (!res.ok) return;
  const json = await res.json();
  const matches = json.data as Array<{ status: string }> | null;
  if (!matches || matches.length === 0) return;
  // If any match is live, done, or forfeit → don't reseed
  if (matches.some((m) => m.status !== "scheduled")) return;
  // All scheduled → safe to reseed
  await fetch(`/api/${base}/ko`, { method: "DELETE" });
  await fetch(`/api/${base}/ko/seed`, { method: "POST" });
}

export type RegenerateSummary = { kept: number; deleted: number; added: number };

export async function regenerateMatches(
  kind: "doubles" | "teams",
  groupId: string,
): Promise<{
  matches: MatchResolved[] | TeamMatchResolved[];
  summary: RegenerateSummary;
}> {
  const path =
    kind === "doubles"
      ? `/api/doubles/groups/${groupId}/regenerate-matches`
      : `/api/teams/groups/${groupId}/regenerate-matches`;
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const json = (await res.json()) as ApiResponse<{
    matches: MatchResolved[] | TeamMatchResolved[];
    summary: RegenerateSummary;
  }>;
  if (!json.data) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  if (!res.ok && res.status !== 207) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  return json.data;
}

// --- AI parse-match ---

export type AiSingleMatchContext = {
  id: string;
  type: "doubles" | "team";
  bestOf: 3 | 5;
  sideA: string;
  sideB: string;
  subMatches?: Array<{
    label: string;
    kind: "singles" | "doubles";
    bestOf: 3 | 5;
  }>;
};

export type AiBatchGroupContext = {
  type: "doubles" | "team";
  matches: Array<{
    id: string;
    sideA: string;
    sideB: string;
    bestOf: 3 | 5;
    hasResult: boolean;
    subMatches?: Array<{
      label: string;
      kind: "singles" | "doubles";
      bestOf: 3 | 5;
    }>;
  }>;
};

export type AiParseInput = {
  text?: string;
  imageBase64?: string;
} & (
  | { match: AiSingleMatchContext; group?: never }
  | { group: AiBatchGroupContext; match?: never }
);

export type AiParseResponse =
  | {
      status: "ok";
      mode: "single";
      matchId: string;
      result: { sets: SetScore[]; subMatches?: Array<{ label: string; sets: SetScore[] }> };
    }
  | {
      status: "ok";
      mode: "batch";
      parsed: Array<{
        matchId: string;
        sideA: string;
        sideB: string;
        result: { sets: SetScore[]; subMatches?: Array<{ label: string; sets: SetScore[] }> };
        alreadyHasResult: boolean;
      }>;
      unmatched?: string[];
    }
  | { status: "rejected"; reason: string };

export async function parseMatchWithAI(
  input: AiParseInput,
): Promise<AiParseResponse> {
  const res = await fetch("/api/ai/parse-match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as ApiResponse<AiParseResponse>;
  if (!res.ok && !json.data) {
    throw new Error(json.error ?? "Lỗi không xác định");
  }
  return json.data!;
}
