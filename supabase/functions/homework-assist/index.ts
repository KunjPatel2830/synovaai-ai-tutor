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
const MAX_QUESTION_LENGTH = 4000;
const MAX_SUBJECT_LENGTH = 100;
const MAX_CONTEXT_LENGTH = 2000;

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

function validateString(value: unknown, fieldName: string, maxLength: number, required = true): { valid: true; value: string } | { valid: false; error: string } {
  if (value === undefined || value === null) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, value: "" };
  }

  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  const trimmed = value.trim();

  if (required && trimmed.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength} characters` };
  }

  return { valid: true, value: trimmed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { question, subject, context, curriculum } = body;

    // Validate question (required)
    const questionValidation = validateString(question, "Question", MAX_QUESTION_LENGTH, true);
    if (!questionValidation.valid) {
      console.error("Input validation failed:", questionValidation.error);
      return jsonResponse({ error: questionValidation.error }, { status: 400 });
    }

    // Validate subject (optional)
    const subjectValidation = validateString(subject, "Subject", MAX_SUBJECT_LENGTH, false);
    if (!subjectValidation.valid) {
      console.error("Input validation failed:", subjectValidation.error);
      return jsonResponse({ error: subjectValidation.error }, { status: 400 });
    }

    // Validate context (optional)
    const contextValidation = validateString(context, "Context", MAX_CONTEXT_LENGTH, false);
    if (!contextValidation.valid) {
      console.error("Input validation failed:", contextValidation.error);
      return jsonResponse({ error: contextValidation.error }, { status: 400 });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    // Curriculum-specific guidance
    const curriculumGuide: Record<string, string> = {
      "CBSE": "Follow CBSE syllabus. Use NCERT methods and terminology. Reference board exam patterns.",
      "NCERT": "Strictly follow NCERT textbook approaches. Use the same problem-solving methods as NCERT.",
      "ICSE": "Follow ICSE syllabus with detailed explanations. Include application-based approaches.",
      "Cambridge": "Follow Cambridge International standards (IGCSE/A-Level). Use British conventions.",
      "IB": "Follow IB standards. Emphasize inquiry-based learning and critical thinking.",
      "State Board": "Use region-appropriate methods and locally relevant examples.",
      "General": "Use universally applicable teaching methods."
    };

    const selectedCurriculum = curriculum && curriculumGuide[curriculum] 
      ? curriculumGuide[curriculum] 
      : curriculumGuide["General"];

    const systemPrompt = `You are SYNOVA's Homework Assistant. Your role is to GUIDE students, not give direct answers.

CURRICULUM ALIGNMENT:
${selectedCurriculum}

CRITICAL LANGUAGE RULE:
- You MUST respond ONLY in English.
- Always use English regardless of what language the user types in.

RULES:
1. NEVER give the final answer directly
2. Break down the problem into steps using curriculum-appropriate methods
3. Explain the METHOD and reasoning as taught in the curriculum
4. Highlight common mistakes to avoid
5. Ask the student to try after your explanation
6. If they share their attempt, provide specific feedback

RESPONSE FORMAT:
1. 📋 **Problem Understanding** - Restate what's being asked
2. 💡 **Key Concepts** - What curriculum principles apply here
3. 📝 **Step-by-Step Approach** - How to solve it (curriculum method, without final answer)
4. ⚠️ **Common Mistakes** - What to watch out for
5. ✏️ **Your Turn** - Ask them to try

Subject context: ${subjectValidation.value || "General"}
${contextValidation.value ? `Additional context: ${contextValidation.value}` : ""}

Be encouraging and patient. Learning is a journey!`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://synova.app",
        "X-Title": "SYNOVA Homework Assistant",
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: questionValidation.value },
        ],
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
    const reply = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return jsonResponse({ reply });
  } catch (error) {
    console.error("Error in homework-assist:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
