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

// ── Input validation ──
const MAX_NAME_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 100;
const MAX_TOPIC_LENGTH = 200;

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  return stripHtml(input).slice(0, maxLen);
}

type CreateRoomBody = {
  name?: string;
  subject?: string | null;
  topic?: string | null;
  role?: "student" | "teacher" | string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[peer-create-room] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
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

    const body = (await req.json().catch(() => ({}))) as CreateRoomBody;

    const name = sanitizeText(body?.name, MAX_NAME_LENGTH);
    const subject = sanitizeText(body?.subject, MAX_SUBJECT_LENGTH) || null;
    const topic = sanitizeText(body?.topic, MAX_TOPIC_LENGTH) || null;
    // Role is determined server-side from user_roles, never trusted from client.

    if (!name || name.length < 3) {
      return new Response(JSON.stringify({ error: "Room name must be 3-100 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

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
      console.error("[peer-create-room] Unauthorized:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve actual role from user_roles table — ignore any client-supplied role
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const desiredRole = roleRow?.role === "teacher" || roleRow?.role === "admin" ? "teacher" : "student";

    let roomCode = "";
    const { data: codeData, error: codeError } = await supabaseAdmin.rpc("generate_room_code");
    if (codeError) {
      console.warn("[peer-create-room] generate_room_code failed, falling back:", codeError);
      roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    } else {
      roomCode = String(codeData ?? "").trim().toUpperCase();
      if (!roomCode) {
        roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from("peer_rooms")
      .insert({
        name,
        subject,
        topic,
        created_by: user.id,
        room_code: roomCode,
        is_active: true,
      })
      .select("id, name, room_code, subject, topic, created_by, is_active")
      .single();

    if (roomError || !room) {
      console.error("[peer-create-room] Room insert error:", roomError);
      return new Response(JSON.stringify({ error: "Failed to create room" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("peer_room_participants")
      .update({ left_at: null, role: desiredRole })
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .select("id");

    if (updateError) {
      console.error("[peer-create-room] Participant update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to create room" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertParticipantError } = await supabaseAdmin
        .from("peer_room_participants")
        .insert({
          room_id: room.id,
          user_id: user.id,
          role: desiredRole,
        });

      if (insertParticipantError) {
        console.error("[peer-create-room] Participant insert error:", insertParticipantError);
        return new Response(JSON.stringify({ error: "Failed to create room" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: whiteboardError } = await supabaseAdmin.from("peer_whiteboard_data").insert({
      room_id: room.id,
      data: [],
      updated_by: user.id,
    });

    if (whiteboardError) {
      console.warn("[peer-create-room] Whiteboard init error (ignored):", whiteboardError);
    }

    return new Response(JSON.stringify({ room }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[peer-create-room] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
