import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL");
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[peer-join-room] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code : "";
    // Role is determined server-side from user_roles, never trusted from client.

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode || normalizedCode.length < 4) {
      return new Response(JSON.stringify({ error: "Invalid room code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Use External Supabase to verify user (users registered on external project)
    const externalUrl = EXTERNAL_SUPABASE_URL || SUPABASE_URL;
    const externalKey = EXTERNAL_SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUser = createClient(externalUrl!, externalKey!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      console.error("[peer-join-room] Unauthorized:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from("peer_rooms")
      .select("id, name, room_code, subject, topic, created_by, is_active")
      .eq("room_code", normalizedCode)
      .eq("is_active", true)
      .maybeSingle();

    if (roomError) {
      console.error("[peer-join-room] Room lookup error:", roomError);
      return new Response(JSON.stringify({ error: "Failed to find room" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!room) {
      return new Response(JSON.stringify({ error: "Room not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve actual role from user_roles — ignore client-supplied role
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const desiredRole = roleRow?.role === "teacher" || roleRow?.role === "admin" ? "teacher" : "student";

    // Try to re-activate an existing participation row first
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("peer_room_participants")
      .update({ left_at: null, role: desiredRole })
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .select("id");

    if (updateError) {
      console.error("[peer-join-room] Participant update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to join room" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertError } = await supabaseAdmin.from("peer_room_participants").insert({
        room_id: room.id,
        user_id: user.id,
        role: desiredRole,
      });

      if (insertError) {
        console.error("[peer-join-room] Participant insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to join room" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ room }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[peer-join-room] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
