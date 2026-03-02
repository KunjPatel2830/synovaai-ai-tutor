
## Completed: Full Migration to Lovable Cloud

All authentication, data operations, and edge functions have been migrated from the external Supabase project to the internal Lovable Cloud database.

### What was done:
1. Created auth triggers (handle_new_user, handle_new_user_role) on auth.users
2. Enabled auto-confirm email signups
3. Switched AuthContext to use internal `supabase` client directly (supabase.auth.signUp instead of edge function)
4. Updated `external-supabase.ts` to re-export internal client (backward compatible for all 42+ frontend files)
5. Updated `external-auth.ts` to use internal client
6. Migrated all 7 edge functions from EXTERNAL_SUPABASE_* to SUPABASE_* credentials
7. Fixed type errors from typed client migration

### Architecture (after migration):
```
Client ──auth──> Lovable Cloud Supabase (internal)
Client ──data──> Lovable Cloud Supabase (internal)
Edge Functions ──> SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (internal)
```
