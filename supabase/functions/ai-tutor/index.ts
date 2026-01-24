import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use external Supabase project
const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";

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
  
  // Create a client with the user's token for proper auth against external Supabase
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

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    // Curriculum-specific guidance
    const curriculumGuide = {
      "CBSE": "Follow CBSE syllabus patterns. Use NCERT textbook examples and terminology. Reference CBSE board exam question styles.",
      "NCERT": "Strictly follow NCERT textbook content and examples. Use the same notation and problem-solving approaches as NCERT books.",
      "ICSE": "Follow ICSE syllabus which is more detailed than CBSE. Include practical applications and higher-order thinking questions.",
      "Cambridge": "Follow Cambridge International curriculum (IGCSE/A-Level). Use British English spellings and international examples.",
      "IB": "Follow International Baccalaureate standards. Emphasize inquiry-based learning, critical thinking, and global perspectives.",
      "State Board": "Adapt to regional state board curriculum. Use locally relevant examples and standard state board terminology.",
      "General": "Use universally applicable teaching methods suitable for any curriculum."
    };

    const selectedCurriculum = curriculum && curriculumGuide[curriculum as keyof typeof curriculumGuide] 
      ? curriculumGuide[curriculum as keyof typeof curriculumGuide] 
      : curriculumGuide["General"];

    const subjectContext = subject ? `Subject: ${subject}` : "";
    const topicContext = topic ? `Current Topic: ${topic}` : "";

    const systemPrompt = `You are SYNOVA, an adaptive AI tutor specializing in curriculum-aligned education. Follow these rules strictly:

CURRICULUM ALIGNMENT:
${selectedCurriculum}
${subjectContext}
${topicContext}

CRITICAL LANGUAGE RULE:
- You MUST respond ONLY in English.
- Always use English regardless of what language the user types in.

1. TEACHING APPROACH:
   - Align explanations with the specified curriculum standards
   - Use textbook-appropriate terminology and notation
   - Give a SIMPLE explanation first
   - Provide ONE clear example from the curriculum
   - Ask ONE comprehension question similar to board exams
   - Never move forward until understanding is confirmed

2. CURRICULUM-SPECIFIC CONTENT:
   - For CBSE/NCERT: Use NCERT examples, formulas, and diagrams
   - For ICSE: Include practical applications and detailed explanations
   - For Cambridge/IB: Use international examples and inquiry-based approach
   - Reference official syllabus topics and learning objectives

3. DIFFICULTY CONTROL:
   - If the student answers correctly → slightly increase difficulty
   - If wrong → re-explain using a DIFFERENT approach or analogy
   - Track their understanding level

4. RESPONSE FORMAT:
   - Start with a brief summary (1-2 sentences)
   - Use numbered steps for explanations
   - Include curriculum-aligned examples
   - End with a question or reflection prompt
   - Keep language clear and encouraging

5. IMAGE GENERATION (VERY IMPORTANT):
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
   - The concept in [IMAGE: ] must match EXACTLY what you're teaching

6. NEVER:
   - Give direct answers to homework
   - Use complex jargon without explaining
   - Move too fast
   - Generate irrelevant or random images
   - Deviate from the curriculum standards

Be warm, patient, and encouraging. Celebrate correct answers!`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://synova.app",
        "X-Title": "SYNOVA AI Tutor",
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash:free",
        messages: [{ role: "system", content: systemPrompt }, ...validation.messages],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenRouter error:", response.status, t);

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
