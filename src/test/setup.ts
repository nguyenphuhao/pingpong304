// Vitest global setup. Runs once per test file before tests.
// Keep minimal — individual tests own their mocks.

import { beforeEach, vi } from "vitest";

// Mock env vars required by Supabase clients so imports don't throw.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pk_test";
process.env.SUPABASE_SECRET_KEY = "sk_test";

beforeEach(() => {
  vi.resetAllMocks();
});
