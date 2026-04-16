import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");

// Server-only client. Uses the secret key which bypasses RLS.
// NEVER import this from a Client Component or send to the browser.
export const supabaseServer = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
