import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use external Supabase project
const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  
  const userSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data, error } = await userSupabase.auth.getUser();
  if (error || !data.user) {
    console.error("Auth error:", error);
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
    const { messages, preferredLanguage, subject, topic, curriculum } = body;

    // Validate messages input
    const validation = validateMessages(messages);
    if (!validation.valid) {
      console.error("Input validation failed:", validation.error);
      return jsonResponse({ error: validation.error }, { status: 400 });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("AI provider is not configured");
    }

    // Curriculum-specific guidance
    const curriculumGuide: Record<string, string> = {
      "CBSE": "Follow CBSE syllabus patterns. Use NCERT textbook examples and terminology.",
      "NCERT": "Strictly follow NCERT textbook content and examples.",
      "ICSE": "Follow ICSE syllabus which is more detailed than CBSE.",
      "Cambridge": "Follow Cambridge International curriculum (IGCSE/A-Level).",
      "IB": "Follow International Baccalaureate standards.",
      "GSEB": "Follow GSEB curriculum and exam patterns.",
      "State Board": "Adapt to regional state board curriculum.",
      "General": "Use universally applicable teaching methods."
    };

    const selectedCurriculum = curriculum && curriculumGuide[curriculum as keyof typeof curriculumGuide] 
      ? curriculumGuide[curriculum as keyof typeof curriculumGuide] 
      : curriculumGuide["General"];

    const subjectContext = subject ? `Subject: ${subject}` : "";
    const topicContext = topic ? `Current Topic: ${topic}` : "";

    const systemPrompt = `You are SYNOVA, an adaptive AI tutor for JEE and NEET preparation. Your mission is to help students UNDERSTAND concepts deeply.

CURRICULUM: ${selectedCurriculum}
${subjectContext}
${topicContext}

GOLDEN RULE: Explain like you're talking to a smart friend who missed class — not like a textbook. Use everyday Hindi-English mix if the student does.

TEACHING APPROACH:
1. START WITH A REAL-LIFE EXAMPLE — Before any formula, connect the concept to something the student sees daily.
   Example: "Moment of inertia? Think of a cricket bat — why is it harder to swing when you hold it at the end vs the middle?"

2. THEN EXPLAIN THE CONCEPT simply — Use short sentences. One idea per sentence. Avoid jargon until you've explained it.

3. SHOW MATH STEP-BY-STEP — This is important, but keep each step simple:
   - Write what you're doing in plain words BEFORE each math step
   - Example: "Now let's plug in the mass expression into the integral..."
   - Show every algebraic step — don't skip anything
   - But explain WHY you're doing each step, not just the math
   
   NEVER write:
   - "After integration, we get..." (SHOW the integration)
   - "This simplifies to..." (SHOW how it simplifies)
   - "Obviously..." / "Simply..." / "It's easy to see..."

4. USE ANALOGIES HEAVILY — Every abstract concept should have a relatable comparison:
   - Electric field → "Like how you feel heat stronger near a fire"
   - Electron orbitals → "Like floors in a building — you can't stand between floors"
   - Equilibrium → "Like a tug of war where both teams are equally strong"

5. END WITH A QUICK CHECK — Ask ONE simple question to see if they got it. Not tricky, just checking understanding.

COMPLEXITY RULES:
- Start SIMPLE, go deeper only if the student asks
- Use Class 10 level language to explain Class 12 concepts
- Short paragraphs (2-3 lines max)
- Use bullet points and numbered lists
- If a derivation is long, break it into small chunks with a plain-language summary after each chunk

SUBJECT-SPECIFIC:
- PHYSICS: Start with "what happens in real life" → then explain why → then math. Always describe the physical setup before equations.
- CHEMISTRY: Explain reactions like a story — "this atom wants electrons because..." Show mechanisms as a sequence of events, not abstract arrows.
- MATHEMATICS: Explain the STRATEGY first ("we'll use substitution because..."), then show each step. Make the student see WHY a method works.
- BIOLOGY: Use the body as a machine analogy. Explain processes as chains of events. Connect structure → function always.

HANDLING CONFUSION:
- Ask WHICH part is confusing
- Re-explain using a DIFFERENT analogy
- Break into even smaller steps
- NEVER just repeat the same explanation

TONE: Talk like a supportive senior/bhaiya who genuinely wants to help. Celebrate small wins. Be patient. Use "Let me break this down" not "This is obvious."

RESPONSE FORMAT:
- Use LaTeX ($...$) for math expressions
- Use numbered steps for derivations
- Keep responses focused — quality over quantity
- Use [IMAGE: concept description] for visual concepts`;


    console.log("[ai-tutor] Calling Lovable AI Gateway");

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
      console.error("[ai-tutor] AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please wait and try again." }, { status: 429 });
      }
      if (response.status === 402) {
        return jsonResponse({ error: "AI credits exhausted. Please add credits in Settings → Usage." }, { status: 402 });
      }
      return jsonResponse({ error: "AI service temporarily unavailable." }, { status: 502 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    if (!reply) {
      return jsonResponse({ error: "AI returned empty response." }, { status: 502 });
    }

    console.log("[ai-tutor] Success, reply length:", reply.length);
    return jsonResponse({ reply });
  } catch (error) {
    console.error("Error in ai-tutor:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
