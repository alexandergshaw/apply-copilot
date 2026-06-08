// Shared Supabase configuration helpers.
//
// The app reads from Supabase when both environment variables are present.
// When either is missing, callers fall back to local mock data so the UI
// remains functional without a configured backend.

// In production, deployments may set either NEXT_PUBLIC_* vars or server-only
// SUPABASE_* vars. We support both to avoid runtime misconfiguration.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export function getMissingSupabaseEnvVars(): string[] {
  const missing: string[] = [];

  if (!SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }

  if (!SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY");
  }

  return missing;
}

export function isSupabaseConfigured(): boolean {
  return getMissingSupabaseEnvVars().length === 0;
}
