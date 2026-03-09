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

// ── Input validation helpers ──
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_QUESTION_LENGTH = 4000;
const VALID_ACTIONS = ["load-data", "send-message", "poll-messages", "leave-room", "ask-ai"];

function isValidUUID(val: unknown): val is string {
  return typeof val === "string" && UUID_RE.test(val);
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

function sanitizeText(input: unknown, maxLen: number): string | null {
  if (typeof input !== "string") return null;
  const cleaned = stripHtml(input);
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, maxLen);
}

function isValidISOTimestamp(val: unknown): val is string {
  if (typeof val !== "string") return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

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

    // Validate action against whitelist
    if (!action || !VALID_ACTIONS.includes(action)) {
      return jsonRes({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── LOAD ROOM DATA ──
    if (action === "load-data") {
      const roomId = body.room_id;
      if (!isValidUUID(roomId)) return jsonRes({ error: "Invalid room_id format" }, 400);

      const { data: participants } = await admin
        .from("peer_room_participants")
        .select("*")
        .eq("room_id", roomId)
        .is("left_at", null);

      const { data: messages } = await admin
        .from("peer_room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(500);

      const allUserIds = [
        ...new Set([
          ...(participants || []).map((p: any) => p.user_id),
          ...(messages || []).map((m: any) => m.user_id),
        ]),
      ];

      let displayNames: Record<string, string> = {};
      if (allUserIds.length > 0) {
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
      const { room_id } = body;
      if (!isValidUUID(room_id)) return jsonRes({ error: "Invalid room_id format" }, 400);

      const message = sanitizeText(body.message, MAX_MESSAGE_LENGTH);
      if (!message) return jsonRes({ error: "Message is required and must be non-empty text" }, 400);

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
          message,
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
      if (!isValidUUID(room_id)) return jsonRes({ error: "Invalid room_id format" }, 400);

      // Validate timestamp if provided
      if (since !== undefined && since !== null && !isValidISOTimestamp(since)) {
        return jsonRes({ error: "Invalid timestamp format for 'since'" }, 400);
      }

      let query = admin
        .from("peer_room_messages")
        .select("*")
        .eq("room_id", room_id)
        .order("created_at", { ascending: true });

      if (since && isValidISOTimestamp(since)) {
        query = query.gt("created_at", since);
      }

      const { data: messages } = await query.limit(100);

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
      if (!isValidUUID(room_id)) return jsonRes({ error: "Invalid room_id format" }, 400);

      await admin
        .from("peer_room_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("room_id", room_id)
        .eq("user_id", user.id);

      return jsonRes({ ok: true });
    }

    // ── ASK AI ──
    if (action === "ask-ai") {
      const { room_id } = body;
      if (!isValidUUID(room_id)) return jsonRes({ error: "Invalid room_id format" }, 400);

      const question = sanitizeText(body.question, MAX_QUESTION_LENGTH);
      if (!question) return jsonRes({ error: "Question is required" }, 400);

      const subject = sanitizeText(body.subject, 100) || "";

      const { data: participant } = await admin
        .from("peer_room_participants")
        .select("id")
        .eq("room_id", room_id)
        .eq("user_id", user.id)
        .is("left_at", null)
        .maybeSingle();

      if (!participant) return jsonRes({ error: "Not a participant" }, 403);

      await admin.from("peer_room_messages").insert({
        room_id,
        user_id: user.id,
        message: question,
        message_type: "text",
      });

      // Validate and sanitize recent messages context
      const recentMessages = Array.isArray(body.recentMessages) ? body.recentMessages : [];
      const chatContext = recentMessages
        .slice(-10)
        .filter((m: any) => typeof m?.message === "string" && typeof m?.name === "string")
        .map((m: any) => `${stripHtml(m.name).slice(0, 50)}: ${stripHtml(m.message).slice(0, 500)}`)
        .join("\n");

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return jsonRes({ error: "AI not configured" }, 500);
      }

      const systemPrompt = `You are SYNOVA AI, a friendly tutor helping students in a peer study room.
${subject ? `Room subject: ${subject}` : ""}

RULES:
- Explain like a supportive senior/bhaiya — simple language, real-life examples
- Start with an everyday analogy before any formula
- Keep it SHORT — this is a group chat, not a lecture (max 8-10 lines for simple questions)
- Show math steps clearly but explain each step in plain words
- Use Hindi-English mix if students do
- Use markdown for formatting
- Be encouraging: "Great question!", "You're on the right track!"
- If concept is complex, break into 2-3 small digestible parts

${chatContext ? `Recent chat:\n${chatContext}` : ""}`;

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
              { role: "user", content: question },
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
