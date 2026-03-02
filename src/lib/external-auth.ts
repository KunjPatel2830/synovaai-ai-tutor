import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current auth access token (if available).
 * Used to authorize backend function calls.
 */
export async function getExternalAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}
