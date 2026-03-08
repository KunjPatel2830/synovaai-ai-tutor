import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL");
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY");

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyUser(authHeader: string) {
  const externalUrl = EXTERNAL_SUPABASE_URL || SUPABASE_URL;
  const externalKey = EXTERNAL_SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(externalUrl, externalKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const user = await verifyUser(authHeader);
    if (!user) return jsonRes({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── LOAD ROOM DATA ──
    if (action === "load-data") {
      const roomId = body.room_id;
      if (!roomId) return jsonRes({ error: "Missing room_id" }, 400);

      // Get participants
      const { data: participants } = await admin
        .from("peer_room_participants")
        .select("*")
        .eq("room_id", roomId)
        .is("left_at", null);

      // Get messages
      const { data: messages } = await admin
        .from("peer_room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(500);

      // Get display names for all user_ids
      const allUserIds = [
        ...new Set([
          ...(participants || []).map((p: any) => p.user_id),
          ...(messages || []).map((m: any) => m.user_id),
        ]),
      ];

      let displayNames: Record<string, string> = {};
      if (allUserIds.length > 0) {
        // Try external profiles first, then internal
        const externalUrl = EXTERNAL_SUPABASE_URL || SUPABASE_URL;
        const externalKey = EXTERNAL_SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
        const extClient = createClient(externalUrl, externalKey, {
          auth: { persistSession: false },
        });
        
        const { data: profiles } = await extClient
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", allUserIds);

        if (profiles) {
          profiles.forEach((p: any) => {
            displayNames[p.user_id] = p.display_name || "Anonymous";
          });
        }

        // Fallback: check internal profiles for any missing
        const missingIds = allUserIds.filter(id => !displayNames[id]);
        if (missingIds.length > 0) {
          const { data: internalProfiles } = await admin
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", missingIds);
          if (internalProfiles) {
            internalProfiles.forEach((p: any) => {
              displayNames[p.user_id] = p.display_name || "Anonymous";
            });
          }
        }
      }

      return jsonRes({ participants: participants || [], messages: messages || [], displayNames });
    }

    // ── SEND MESSAGE ──
    if (action === "send-message") {
      const { room_id, message } = body;
      if (!room_id || !message?.trim()) return jsonRes({ error: "Missing data" }, 400);

      // Verify participant
      const { data: participant } = await admin
        .from("peer_room_participants")
        .select("id")
        .eq("room_id", room_id)
        .eq("user_id", user.id)
        .is("left_at", null)
        .maybeSingle();

      if (!participant) return jsonRes({ error: "Not a participant" }, 403);

      const { data: msg, error } = await admin
        .from("peer_room_messages")
        .insert({
          room_id,
          user_id: user.id,
          message: message.trim(),
          message_type: "text",
        })
        .select()
        .single();

      if (error) {
        console.error("[peer-room-action] send-message error:", error);
        return jsonRes({ error: "Failed to send" }, 500);
      }

      return jsonRes({ message: msg });
    }

    // ── POLL NEW MESSAGES (since timestamp) ──
    if (action === "poll-messages") {
      const { room_id, since } = body;
      if (!room_id) return jsonRes({ error: "Missing room_id" }, 400);

      let query = admin
        .from("peer_room_messages")
        .select("*")
        .eq("room_id", room_id)
        .order("created_at", { ascending: true });

      if (since) {
        query = query.gt("created_at", since);
      }

      const { data: messages } = await query.limit(100);

      // Get display names for new messages
      const userIds = [...new Set((messages || []).map((m: any) => m.user_id))];
      let displayNames: Record<string, string> = {};
      if (userIds.length > 0) {
        const externalUrl = EXTERNAL_SUPABASE_URL || SUPABASE_URL;
        const externalKey = EXTERNAL_SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
        const extClient = createClient(externalUrl, externalKey, {
          auth: { persistSession: false },
        });
        const { data: profiles } = await extClient
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        if (profiles) {
          profiles.forEach((p: any) => {
            displayNames[p.user_id] = p.display_name || "Anonymous";
          });
        }
      }

      // Also get updated participant count
      const { data: participants } = await admin
        .from("peer_room_participants")
        .select("id, user_id, role")
        .eq("room_id", room_id)
        .is("left_at", null);

      return jsonRes({
        messages: messages || [],
        displayNames,
        participantCount: participants?.length || 0,
      });
    }

    // ── LEAVE ROOM ──
    if (action === "leave-room") {
      const { room_id } = body;
      if (!room_id) return jsonRes({ error: "Missing room_id" }, 400);

      await admin
        .from("peer_room_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("room_id", room_id)
        .eq("user_id", user.id);

      return jsonRes({ ok: true });
    }

    // ── ASK AI ──
    if (action === "ask-ai") {
      const { room_id, question, subject, recentMessages } = body;
      if (!room_id || !question?.trim()) return jsonRes({ error: "Missing question" }, 400);

      // Verify participant
      const { data: participant } = await admin
        .from("peer_room_participants")
        .select("id")
        .eq("room_id", room_id)
        .eq("user_id", user.id)
        .is("left_at", null)
        .maybeSingle();

      if (!participant) return jsonRes({ error: "Not a participant" }, 403);

      // Insert user's question as a message
      await admin.from("peer_room_messages").insert({
        room_id,
        user_id: user.id,
        message: question.trim(),
        message_type: "text",
      });

      // Build context from recent chat
      const chatContext = (recentMessages || [])
        .slice(-10)
        .map((m: any) => `${m.name || "User"}: ${m.message}`)
        .join("\n");

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return jsonRes({ error: "AI not configured" }, 500);
      }

      const systemPrompt = `You are SYNOVA AI, an expert tutor for JEE and NEET preparation, assisting students in a collaborative peer study room.
${subject ? `The room subject is: ${subject}` : ""}

IMPORTANT RULES:
- Give clear, concise explanations suitable for a group study chat
- Show step-by-step derivations when needed — NEVER skip steps
- Use simple language and real-world analogies
- If the question is about a specific concept, explain the core idea first, then the math
- Keep responses focused and not too long (this is a chat, not a lecture)
- Use markdown formatting for clarity
- Be encouraging and supportive

${chatContext ? `Recent chat context:\n${chatContext}` : ""}`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: question.trim() },
            ],
          }),
        });

        if (!aiResponse.ok) {
          const status = aiResponse.status;
          if (status === 429) return jsonRes({ error: "AI rate limit exceeded, try again shortly" }, 429);
          if (status === 402) return jsonRes({ error: "AI credits exhausted" }, 402);
          console.error("[peer-room-action] AI error:", status);
          return jsonRes({ error: "AI temporarily unavailable" }, 500);
        }

        const aiData = await aiResponse.json();
        const aiText = aiData.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

        // Insert AI response as a message
        const AI_USER_ID = "00000000-0000-0000-0000-000000000000";
        const { data: aiMsg } = await admin
          .from("peer_room_messages")
          .insert({
            room_id,
            user_id: AI_USER_ID,
            message: aiText,
            message_type: "ai",
          })
          .select()
          .single();

        return jsonRes({ aiMessage: aiMsg });
      } catch (aiErr) {
        console.error("[peer-room-action] AI fetch error:", aiErr);
        return jsonRes({ error: "Failed to get AI response" }, 500);
      }
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[peer-room-action] Error:", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
