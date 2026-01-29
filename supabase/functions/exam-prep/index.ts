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
const MAX_SUBJECT_LENGTH = 100;
const MAX_TOPIC_LENGTH = 200;
const MAX_DIFFICULTY_LENGTH = 20;
const VALID_ACTIONS = ["generate_questions", "study_plan"];
const VALID_DIFFICULTIES = ["easy", "medium", "hard", "beginner", "intermediate", "advanced"];

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
    const { action, subject, topic, difficulty, curriculum } = body;

    // Validate action
    if (!action || typeof action !== "string" || !VALID_ACTIONS.includes(action)) {
      console.error("Invalid action:", action);
      return jsonResponse({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
    }

    // Validate subject (required)
    const subjectValidation = validateString(subject, "Subject", MAX_SUBJECT_LENGTH, true);
    if (!subjectValidation.valid) {
      console.error("Input validation failed:", subjectValidation.error);
      return jsonResponse({ error: subjectValidation.error }, { status: 400 });
    }

    // Validate topic (required)
    const topicValidation = validateString(topic, "Topic", MAX_TOPIC_LENGTH, true);
    if (!topicValidation.valid) {
      console.error("Input validation failed:", topicValidation.error);
      return jsonResponse({ error: topicValidation.error }, { status: 400 });
    }

    // Validate difficulty (optional but if provided must be valid)
    const difficultyValidation = validateString(difficulty, "Difficulty", MAX_DIFFICULTY_LENGTH, false);
    if (!difficultyValidation.valid) {
      console.error("Input validation failed:", difficultyValidation.error);
      return jsonResponse({ error: difficultyValidation.error }, { status: 400 });
    }

    // If difficulty is provided, validate it's a known value
    const validatedDifficulty = difficultyValidation.value.toLowerCase();
    if (validatedDifficulty && !VALID_DIFFICULTIES.includes(validatedDifficulty)) {
      console.error("Invalid difficulty level:", validatedDifficulty);
      return jsonResponse({ error: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(", ")}` }, { status: 400 });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    // Curriculum-specific guidance for question generation
    const curriculumGuide: Record<string, string> = {
      "CBSE": "Generate questions in CBSE board exam style. Follow NCERT patterns and marking schemes.",
      "NCERT": "Base questions directly on NCERT textbook content and exercise patterns.",
      "ICSE": "Generate ICSE-style questions with application focus and detailed requirements.",
      "Cambridge": "Follow IGCSE/A-Level question patterns with British terminology.",
      "IB": "Create IB-style inquiry-based questions with critical thinking components.",
      "State Board": "Use state board exam patterns with regional relevance.",
      "General": "Create standard practice questions suitable for any curriculum."
    };

    const selectedCurriculum = curriculum && curriculumGuide[curriculum] 
      ? curriculumGuide[curriculum] 
      : curriculumGuide["General"];
    const safeCurriculum = curriculum || "General";

    let systemPrompt = "";
    let userPrompt = "";

    const safeSubject = subjectValidation.value;
    const safeTopic = topicValidation.value;
    const safeDifficulty = validatedDifficulty || "medium";

    if (action === "generate_questions") {
      systemPrompt = `You are an exam preparation assistant. Generate practice questions based on the given parameters.

CURRICULUM ALIGNMENT:
${selectedCurriculum}

CRITICAL LANGUAGE RULE:
- You MUST generate ALL content ONLY in English.
- Always use English regardless of what language the topic is in.

RULES:
1. Generate exactly 5 questions following the ${safeCurriculum} curriculum pattern
2. Mix question types (multiple choice and short answer) as per board exam format
3. Match the difficulty level specified
4. Focus on the given topic and subject
5. Include curriculum-appropriate terminology and concepts

RESPONSE FORMAT (JSON):
{
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice" | "short_answer",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "...",
      "explanation": "..."
    }
  ]
}

Respond ONLY with valid JSON, no markdown.`;

      userPrompt = `Generate 5 ${safeDifficulty} level ${safeCurriculum} curriculum questions for ${safeSubject} on the topic: ${safeTopic}`;
    } else if (action === "study_plan") {
      systemPrompt = `You are a study planner. Create a personalized study plan.

CRITICAL LANGUAGE RULE:
- You MUST generate ALL content ONLY in English.
- Always use English regardless of what language the topic is in.

RESPONSE FORMAT (JSON):
{
  "dailyPlan": [
    {
      "day": 1,
      "topics": ["topic1", "topic2"],
      "duration": "2 hours",
      "activities": ["review notes", "practice problems"]
    }
  ],
  "tips": ["tip1", "tip2"],
  "focusAreas": ["area1", "area2"]
}

Respond ONLY with valid JSON, no markdown.`;

      userPrompt = `Create a study plan for ${safeSubject} covering: ${safeTopic}. Difficulty: ${safeDifficulty}`;
    } else {
      return jsonResponse({ error: "Unknown action" }, { status: 400 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://synova.app",
        "X-Title": "SYNOVA Exam Prep",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenRouter error:", response.status, t);

      if (response.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded." }, { status: 429 });
      }
      if (response.status === 402) {
        return jsonResponse({ error: "Usage limit reached." }, { status: 402 });
      }

      return jsonResponse({ error: "AI gateway error" }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    // Some models may wrap JSON; be tolerant.
    const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
      const result = JSON.parse(cleaned);
      return jsonResponse(result);
    } catch {
      return jsonResponse({ error: "Model returned non-JSON output", raw: content }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in exam-prep:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
