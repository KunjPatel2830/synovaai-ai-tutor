import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SignupRole = "student" | "teacher" | "caregiver";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return respond({ error: "Server misconfigured" });
    }

    const payload = (await req.json().catch(() => null)) as
      | { email?: string; password?: string; displayName?: string; role?: string }
      | null;

    const email = (payload?.email ?? "").trim().toLowerCase();
    const password = payload?.password ?? "";
    const displayName = (payload?.displayName ?? "").trim();

    const allowedRoles: SignupRole[] = ["student", "teacher", "caregiver"];
    const requestedRole = (payload?.role ?? "student").trim();
    const role: SignupRole = allowedRoles.includes(requestedRole as SignupRole)
      ? (requestedRole as SignupRole)
      : "student";

    if (!email) return respond({ error: "Email is required" });
    if (!password || password.length < 6) return respond({ error: "Password must be at least 6 characters" });
    if (!displayName) return respond({ error: "Name is required" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        role,
      },
    });

    if (createError) {
      const msg = (createError.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return respond({ error: "This email is already registered. Please sign in instead." });
      }
      return respond({ error: createError.message || "Signup failed" });
    }

    const userId = created.user?.id;
    if (!userId) return respond({ error: "Signup succeeded but user was not returned" });

    // Provision app tables (idempotent) - triggers should handle this but just in case
    await admin.from("profiles").upsert(
      { user_id: userId, display_name: displayName },
      { onConflict: "user_id" },
    );

    await admin.from("user_roles").upsert(
      { user_id: userId, role },
      { onConflict: "user_id,role" },
    );

    await admin.from("learning_streaks").upsert(
      { user_id: userId },
      { onConflict: "user_id" },
    );

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      return respond({ error: "Account created, but could not start session. Please try signing in." });
    }

    return respond({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      user_id: userId,
    });
  } catch (_err) {
    return respond({ error: "Internal server error" });
  }
});
