// Shared mock for Supabase query builder chain.
// Usage:
//   const sb = makeSupabaseChain({ data: [...], error: null });
//   vi.mocked(supabaseServer.from).mockReturnValue(sb);
//   await GET(req);
//   expect(sb.from).toHaveBeenCalledWith("doubles_players");

import { vi } from "vitest";

export type SupabaseResult<T = unknown> = { data: T; error: unknown };

export function makeSupabaseChain<T = unknown>(result: SupabaseResult<T>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const thenable = {
    then: (resolve: (v: SupabaseResult<T>) => unknown) =>
      Promise.resolve(result).then(resolve),
    catch: (reject: (e: unknown) => unknown) =>
      Promise.resolve(result).catch(reject),
  };
  // Lazy factory: evaluates `{ ...chain, ...thenable }` each call, so the
  // returned object includes all methods added during setup (fixes timing bug).
  const chainable = () => ({ ...chain, ...thenable });
  chain.select = vi.fn(chainable);
  chain.insert = vi.fn(chainable);
  chain.update = vi.fn(chainable);
  chain.delete = vi.fn(chainable);
  chain.eq = vi.fn(chainable);
  chain.neq = vi.fn(chainable);
  chain.or = vi.fn(chainable);
  chain.like = vi.fn(chainable);
  chain.contains = vi.fn(chainable);
  chain.limit = vi.fn(chainable);
  chain.order = vi.fn(chainable);
  // Terminal method — returns Promise directly, not chainable
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}
