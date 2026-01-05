import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const subject = typeof body?.subject === "string" ? body.subject.trim() : null;
    const topic = typeof body?.topic === "string" ? body.topic.trim() : null;
    const desiredRole = body?.role === "teacher" ? "teacher" : "student";

    if (!name || name.length < 3) {
      return new Response(JSON.stringify({ error: "Invalid room name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Use Authorization header to verify the user making the request
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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

    // Generate a unique room code via DB helper (fallback to random)
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
        subject: subject || null,
        topic: topic || null,
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

    // Participant row (re-activate if exists)
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

    // Initialize whiteboard (best-effort)
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
