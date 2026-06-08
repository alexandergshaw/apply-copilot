import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Creates a Supabase client for use on the server (server components and
 * server actions).
 *
 * The app does not use Supabase Auth yet, so no session/cookie handling is
 * required. Returns `null` when the Supabase environment variables are not
 * configured, allowing callers to fall back to mock data.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
