// Shared Supabase configuration helpers.
//
// The app reads from Supabase when both environment variables are present.
// When either is missing, callers fall back to local mock data so the UI
// remains functional without a configured backend.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getMissingSupabaseEnvVars(): string[] {
  const missing: string[] = [];

  if (!SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return missing;
}

export function isSupabaseConfigured(): boolean {
  return getMissingSupabaseEnvVars().length === 0;
}
