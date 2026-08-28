import { externalSupabase } from "@/lib/external-supabase";

/**
 * Returns the current external auth access token (if available).
 *
 * We use this token to authorize backend function calls that validate users
 * against the external auth provider.
 */
export async function getExternalAccessToken(): Promise<string | null> {
  const { data, error } = await externalSupabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}
