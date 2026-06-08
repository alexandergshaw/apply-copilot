import type { SupabasePlaceholderClient } from "@/lib/supabase/client";

const placeholderServerClient: SupabasePlaceholderClient = {
  ready: false,
  message: "Supabase server client placeholder. Configure when backend integration starts.",
};

export function getSupabaseServerClient(): SupabasePlaceholderClient {
  return placeholderServerClient;
}
