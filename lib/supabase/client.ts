import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

/**
 * Returns a memoized Supabase client for use in the browser.
 *
 * Returns `null` when the Supabase environment variables are not configured,
 * allowing callers to fall back to mock data.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
  }

  return browserClient;
}
