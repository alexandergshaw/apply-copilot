// Shared Supabase configuration helpers.
//
// The app reads from Supabase when both environment variables are present.
// When either is missing, callers fall back to local mock data so the UI
// remains functional without a configured backend.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
