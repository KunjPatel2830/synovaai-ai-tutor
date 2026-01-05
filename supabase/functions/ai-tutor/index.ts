import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Input validation constants
const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 50;
const VALID_ROLES = ["user", "assistant", "system"];

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function requireUser(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { userId: data.user.id };
}

function validateMessages(messages: unknown): { valid: true; messages: Array<{ role: string; content: string }> } | { valid: false; error: string } {
  if (!Array.isArray(messages)) {
    return { valid: false, error: "Messages must be an array" };
  }

  if (messages.length === 0) {
    return { valid: false, error: "Messages array cannot be empty" };
  }

  if (messages.length > MAX_MESSAGES) {
    return { valid: false, error: `Too many messages. Maximum is ${MAX_MESSAGES}` };
  }

  const validatedMessages: Array<{ role: string; content: string }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    if (!msg || typeof msg !== "object") {
      return { valid: false, error: `Message at index ${i} must be an object` };
    }

    if (typeof msg.content !== "string") {
      return { valid: false, error: `Message at index ${i} must have a string content` };
    }

    if (msg.content.length === 0) {
      return { valid: false, error: `Message at index ${i} content cannot be empty` };
    }

    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: `Message at index ${i} exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
    }

    if (typeof msg.role !== "string" || !VALID_ROLES.includes(msg.role)) {
      return { valid: false, error: `Message at index ${i} has invalid role. Must be one of: ${VALID_ROLES.join(", ")}` };
    }

    validatedMessages.push({
      role: msg.role,
      content: msg.content.trim(),
    });
  }

  return { valid: true, messages: validatedMessages };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { messages, preferredLanguage } = body;

    // Validate messages input
    const validation = validateMessages(messages);
    if (!validation.valid) {
      console.error("Input validation failed:", validation.error);
      return jsonResponse({ error: validation.error }, { status: 400 });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are SYNOVA, an adaptive AI tutor. Follow these rules strictly:

CRITICAL LANGUAGE RULE:
- You MUST respond ONLY in English.
- Always use English regardless of what language the user types in.

1. TEACHING APPROACH:
   - Give a SIMPLE explanation first
   - Provide ONE clear example
   - Ask ONE comprehension question
   - Never move forward until understanding is confirmed

2. DIFFICULTY CONTROL:
   - If the student answers correctly → slightly increase difficulty
   - If wrong → re-explain using a DIFFERENT approach or analogy
   - Track their understanding level

3. RESPONSE FORMAT:
   - Start with a brief summary (1-2 sentences)
   - Use numbered steps for explanations
   - End with a question or reflection prompt
   - Keep language clear and encouraging

4. IMAGE GENERATION (VERY IMPORTANT):
   - ONLY include [IMAGE: concept] when explaining VISUAL scientific/educational concepts
   - The image MUST be directly related to the SPECIFIC topic you are explaining
   - Examples of WHEN to use images:
     * Explaining convex lens → [IMAGE: convex lens with light rays converging]
     * Explaining mitochondria → [IMAGE: mitochondria internal structure diagram]
     * Explaining water cycle → [IMAGE: water cycle showing evaporation condensation precipitation]
     * Explaining heart anatomy → [IMAGE: human heart cross-section with labeled chambers]
   - Examples of when NOT to use images:
     * Math problems (use equations instead)
     * Abstract concepts like "learning" or "intelligence"
     * Simple factual questions
   - If user asks about "1" or numbers, do NOT generate apple or random images
   - The concept in [IMAGE: ] must match EXACTLY what you're teaching

5. NEVER:
   - Give direct answers to homework
   - Use complex jargon without explaining
   - Move too fast
   - Generate irrelevant or random images

Be warm, patient, and encouraging. Celebrate correct answers!`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...validation.messages],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI Gateway error:", response.status, t);

      if (response.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
      }
      if (response.status === 402) {
        return jsonResponse({ error: "Usage limit reached. Please add credits." }, { status: 402 });
      }

      return jsonResponse({ error: "AI gateway error" }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    return jsonResponse({ reply });
  } catch (error) {
    console.error("Error in ai-tutor:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
