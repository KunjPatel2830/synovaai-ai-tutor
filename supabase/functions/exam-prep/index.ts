import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const userSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data, error } = await userSupabase.auth.getUser();
  if (error || !data.user) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { userId: data.user.id };
}

function validateString(value: unknown, fieldName: string, maxLength: number, required = true): { valid: true; value: string } | { valid: false; error: string } {
  if (value === undefined || value === null) {
    if (required) return { valid: false, error: `${fieldName} is required` };
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

  // ── Rate Limiting ──
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: rl } = await admin.rpc("check_rate_limit", { _user_id: auth.userId, _endpoint: "exam-prep", _max_requests: 15, _window_seconds: 60 });
    if (rl && rl.length > 0 && !rl[0].allowed) {
      return jsonResponse({ error: `Rate limit exceeded. Try again in ${rl[0].retry_after} seconds.` }, { status: 429 });
    }
  } catch (e) { console.error("Rate limit check failed, allowing request:", e); }

  try {
    const body = await req.json();
    const { action, subject, topic, difficulty, curriculum } = body;

    if (!action || typeof action !== "string" || !VALID_ACTIONS.includes(action)) {
      return jsonResponse({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
    }

    const subjectValidation = validateString(subject, "Subject", MAX_SUBJECT_LENGTH, true);
    if (!subjectValidation.valid) {
      return jsonResponse({ error: subjectValidation.error }, { status: 400 });
    }

    const topicValidation = validateString(topic, "Topic", MAX_TOPIC_LENGTH, true);
    if (!topicValidation.valid) {
      return jsonResponse({ error: topicValidation.error }, { status: 400 });
    }

    const difficultyValidation = validateString(difficulty, "Difficulty", MAX_DIFFICULTY_LENGTH, false);
    if (!difficultyValidation.valid) {
      return jsonResponse({ error: difficultyValidation.error }, { status: 400 });
    }

    const validatedDifficulty = difficultyValidation.value.toLowerCase();
    if (validatedDifficulty && !VALID_DIFFICULTIES.includes(validatedDifficulty)) {
      return jsonResponse({ error: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(", ")}` }, { status: 400 });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI provider is not configured");
    }

    const curriculumGuide: Record<string, string> = {
      "CBSE": "Generate questions in CBSE board exam style.",
      "NCERT": "Base questions directly on NCERT textbook content.",
      "ICSE": "Generate ICSE-style questions with application focus.",
      "GSEB": "Follow GSEB exam patterns.",
      "Cambridge": "Follow IGCSE/A-Level question patterns.",
      "IB": "Create IB-style inquiry-based questions.",
      "State Board": "Use state board exam patterns.",
      "General": "Create standard practice questions."
    };

    const selectedCurriculum = curriculum && curriculumGuide[curriculum] 
      ? curriculumGuide[curriculum] 
      : curriculumGuide["General"];
    const safeCurriculum = curriculum || "General";

    const safeSubject = subjectValidation.value;
    const safeTopic = topicValidation.value;
    const safeDifficulty = validatedDifficulty || "medium";

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "generate_questions") {
      systemPrompt = `You are an exam preparation assistant. ${selectedCurriculum}

Generate exactly 5 questions following board exam format. Mix multiple choice and short answer.

RESPONSE FORMAT (JSON only, no markdown):
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
}`;
      userPrompt = `Generate 5 ${safeDifficulty} level ${safeCurriculum} curriculum questions for ${safeSubject} on: ${safeTopic}`;
    } else if (action === "study_plan") {
      systemPrompt = `You are a study planner.

RESPONSE FORMAT (JSON only, no markdown):
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
}`;
      userPrompt = `Create a study plan for ${safeSubject} covering: ${safeTopic}. Difficulty: ${safeDifficulty}`;
    } else {
      return jsonResponse({ error: "Unknown action" }, { status: 400 });
    }

    console.log("[exam-prep] Calling Lovable AI Gateway");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[exam-prep] AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please wait and try again." }, { status: 429 });
      }
      if (response.status === 402) {
        return jsonResponse({ error: "AI credits exhausted. Please add credits in Settings → Usage." }, { status: 402 });
      }
      return jsonResponse({ error: "AI service temporarily unavailable." }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    if (!content) {
      return jsonResponse({ error: "AI returned empty response." }, { status: 502 });
    }

    const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
      const result = JSON.parse(cleaned);
      return jsonResponse(result);
    } catch {
      return jsonResponse({ error: "Model returned invalid JSON", raw: content }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in exam-prep:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
