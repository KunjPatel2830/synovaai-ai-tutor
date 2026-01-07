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

  // Create a client with the user's token for proper auth
  const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    const { question, subject, context } = body;

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are SYNOVA's Homework Assistant. Your role is to GUIDE students, not give direct answers.

CRITICAL LANGUAGE RULE:
- You MUST respond ONLY in English.
- Always use English regardless of what language the user types in.

RULES:
1. NEVER give the final answer directly
2. Break down the problem into steps
3. Explain the METHOD and reasoning
4. Highlight common mistakes to avoid
5. Ask the student to try after your explanation
6. If they share their attempt, provide specific feedback

RESPONSE FORMAT:
1. 📋 **Problem Understanding** - Restate what's being asked
2. 💡 **Key Concepts** - What principles apply here
3. 📝 **Step-by-Step Approach** - How to solve it (without final answer)
4. ⚠️ **Common Mistakes** - What to watch out for
5. ✏️ **Your Turn** - Ask them to try

Subject context: ${subjectValidation.value || "General"}
${contextValidation.value ? `Additional context: ${contextValidation.value}` : ""}

Be encouraging and patient. Learning is a journey!`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: questionValidation.value },
        ],
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
    const reply = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return jsonResponse({ reply });
  } catch (error) {
    console.error("Error in homework-assist:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
