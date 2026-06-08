export type SupabasePlaceholderClient = {
  ready: false;
  message: string;
};

const placeholderClient: SupabasePlaceholderClient = {
  ready: false,
  message: "Supabase is not configured yet. Add environment variables and initialization in a future step.",
};

export function getSupabaseBrowserClient(): SupabasePlaceholderClient {
  return placeholderClient;
}
