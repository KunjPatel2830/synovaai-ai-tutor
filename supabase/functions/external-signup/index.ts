import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SignupRole = "student" | "teacher" | "caregiver";

const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
const EXTERNAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY || !EXTERNAL_SUPABASE_SERVICE_ROLE_KEY) {
      return respond({ error: "Server misconfigured" });
    }

    // ── IP-based rate limiting (5 signups per IP per minute) ──
    const clientIP = getClientIP(req);
    try {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: rl } = await admin.rpc("check_ip_rate_limit", {
        _ip_address: clientIP,
        _endpoint: "external-signup",
        _max_requests: 5,
        _window_seconds: 60,
      });
      if (rl && rl.length > 0 && !rl[0].allowed) {
        return respond({ error: `Too many requests. Try again in ${rl[0].retry_after} seconds.` }, 429);
      }
    } catch (e) {
      console.error("IP rate limit check failed, allowing request:", e);
    }

    const payload = (await req.json().catch(() => null)) as
      | {
          email?: string;
          password?: string;
          displayName?: string;
          role?: string;
        }
      | null;

    const email = (payload?.email ?? "").trim().toLowerCase();
    const password = payload?.password ?? "";
    const displayName = (payload?.displayName ?? "").trim();

    // Security: never allow 'admin' signup from public endpoint
    const allowedRoles: SignupRole[] = ["student", "teacher", "caregiver"];
    const requestedRole = (payload?.role ?? "student").trim();
    const role: SignupRole = allowedRoles.includes(requestedRole as SignupRole)
      ? (requestedRole as SignupRole)
      : "student";

    if (!email) return respond({ error: "Email is required" });
    if (!password || password.length < 6) return respond({ error: "Password must be at least 6 characters" });
    if (!displayName) return respond({ error: "Name is required" });

    // Admin client (service role) for user creation + provisioning
    const admin = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // makes login work immediately (no email verification)
      user_metadata: {
        display_name: displayName,
        role, // metadata is not used for authZ; real role is stored in user_roles
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

    // Provision app tables (idempotent)
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

    // Return a real session so the frontend can immediately open the app
    const authClient = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
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
