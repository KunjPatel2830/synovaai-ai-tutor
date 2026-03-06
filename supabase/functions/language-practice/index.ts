import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 50;
const VALID_ROLES = ["user", "assistant", "system"];

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  const userSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userSupabase.auth.getUser();
  if (error || !data.user) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: data.user.id };
}

function validateMessages(messages: unknown) {
  if (!Array.isArray(messages)) return { valid: false as const, error: "Messages must be an array" };
  if (messages.length === 0) return { valid: false as const, error: "Messages array cannot be empty" };
  if (messages.length > MAX_MESSAGES) return { valid: false as const, error: "Too many messages" };

  const validated: Array<{ role: string; content: string }> = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") return { valid: false as const, error: `Invalid message at ${i}` };
    if (typeof msg.content !== "string" || !msg.content.trim()) return { valid: false as const, error: `Empty content at ${i}` };
    if (msg.content.length > MAX_MESSAGE_LENGTH) return { valid: false as const, error: `Message too long at ${i}` };
    if (typeof msg.role !== "string" || !VALID_ROLES.includes(msg.role)) return { valid: false as const, error: `Invalid role at ${i}` };
    validated.push({ role: msg.role, content: msg.content.trim() });
  }
  return { valid: true as const, messages: validated };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { messages, targetLanguage, level } = body;

    const validation = validateMessages(messages);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, { status: 400 });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI provider is not configured");
    }

    const langName = targetLanguage || "Spanish";
    const userLevel = level || "absolute_beginner";

    const levelGuide: Record<string, string> = {
      absolute_beginner: `The student is an ABSOLUTE BEGINNER with ZERO knowledge of ${langName}. 
Start from the very basics:
- Teach the ALPHABET/SCRIPT of the language first (letter by letter with pronunciation)
- Then basic sounds and phonetics
- Then simple greetings (hello, goodbye, thank you, please)
- Then numbers 1-10
- Then basic everyday words (water, food, yes, no, etc.)
- Use transliteration/romanization for non-Latin scripts
- ALWAYS show: Original script → Transliteration → English meaning → Pronunciation guide
- Go EXTREMELY slow, one concept at a time
- Quiz the student on what they just learned before moving forward`,

      beginner: `The student knows basic greetings and alphabet. Teach:
- Common phrases and expressions
- Basic sentence structure (Subject-Verb-Object patterns)
- Essential vocabulary by category (family, food, colors, body parts)
- Numbers, days, months
- How to introduce yourself
- Simple questions (What, Where, How much)
- ALWAYS show pronunciation guides`,

      intermediate: `The student knows basics. Teach:
- Grammar rules (tenses, conjugations, gender)
- Longer sentences and conversations
- Reading short passages
- Common idioms and expressions
- Cultural context and usage notes`,

      advanced: `The student is conversational. Focus on:
- Complex grammar and exceptions
- Nuanced vocabulary and synonyms
- Formal vs informal registers
- Writing practice
- Literature and advanced expressions`,
    };

    const systemPrompt = `You are SYNOVA Language Tutor — a patient, structured language teacher helping someone learn ${langName}.

STUDENT LEVEL: ${userLevel.replace(/_/g, " ").toUpperCase()}

${levelGuide[userLevel] || levelGuide.absolute_beginner}

CRITICAL TEACHING RULES:
1. ALWAYS teach progressively — never skip ahead of the student's level
2. For absolute beginners: Start with the alphabet/script FIRST. Do not jump to full sentences.
3. Every response MUST include:
   - The word/phrase in ${langName} (original script if applicable)
   - Transliteration in English letters (for non-Latin scripts)
   - English translation
   - Pronunciation guide in parentheses (phonetic breakdown)
4. Teach ONE small concept per response, not many at once
5. After teaching, ALWAYS quiz the student with a simple exercise:
   - "How do you say ___ in ${langName}?"
   - "What does ___ mean?"
   - "Try writing/saying ___"
6. If the student gets it wrong, correct them gently and explain why
7. If the student gets it right, praise them and move to the next concept
8. Track what has been taught in the conversation — don't repeat the same lesson
9. Use emojis sparingly for encouragement (✅, 👏, 🎯)
10. Keep responses focused and not too long

RESPONSE FORMAT:
📖 **Today's Lesson: [Topic]**

[Teaching content with original script, transliteration, pronunciation]

🎯 **Practice Time!**
[Quiz question for the student]

Remember: You are teaching from SCRATCH. Be patient. Go slow. Make it fun.`;

    console.log("[language-practice] Calling AI gateway, lang:", langName, "level:", userLevel);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...validation.messages],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[language-practice] AI error:", response.status, errText);
      if (response.status === 429) return jsonResponse({ error: "Rate limit exceeded. Please wait." }, { status: 429 });
      if (response.status === 402) return jsonResponse({ error: "AI credits exhausted." }, { status: 402 });
      return jsonResponse({ error: "AI service temporarily unavailable." }, { status: 502 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    if (!reply) {
      return jsonResponse({ error: "AI returned empty response." }, { status: 502 });
    }

    console.log("[language-practice] Success, reply length:", reply.length);
    return jsonResponse({ reply });
  } catch (error) {
    console.error("Error in language-practice:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
