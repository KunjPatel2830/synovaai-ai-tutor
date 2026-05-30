import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_QUESTION_LENGTH = 4000;
const MAX_SUBJECT_LENGTH = 100;
const MAX_CONTEXT_LENGTH = 2000;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const VALID_ROLES = ["user", "assistant"];

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

function validateMessages(messages: unknown): { valid: true; messages: Array<{ role: string; content: string }> } | { valid: false } {
  if (!Array.isArray(messages) || messages.length === 0) return { valid: false };
  if (messages.length > MAX_MESSAGES) return { valid: false };

  const validated: Array<{ role: string; content: string }> = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (typeof msg.content !== "string" || !msg.content.trim()) continue;
    if (msg.content.length > MAX_MESSAGE_LENGTH) continue;
    if (typeof msg.role !== "string" || !VALID_ROLES.includes(msg.role)) continue;
    validated.push({ role: msg.role, content: msg.content.trim() });
  }
  return validated.length > 0 ? { valid: true, messages: validated } : { valid: false };
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
    const { data: rl } = await admin.rpc("check_rate_limit", { _user_id: auth.userId, _endpoint: "homework-assist", _max_requests: 20, _window_seconds: 60 });
    if (rl && rl.length > 0 && !rl[0].allowed) {
      return jsonResponse({ error: `Rate limit exceeded. Try again in ${rl[0].retry_after} seconds.` }, { status: 429 });
    }
  } catch (e) { console.error("Rate limit check failed, allowing request:", e); }

  try {
    const body = await req.json();
    const { question, subject, context, curriculum, messages, language } = body;
    const responseLanguage = (typeof language === "string" && language.trim()) ? language.trim() : "english";

    const questionValidation = validateString(question, "Question", MAX_QUESTION_LENGTH, true);
    if (!questionValidation.valid) {
      return jsonResponse({ error: questionValidation.error }, { status: 400 });
    }

    const subjectValidation = validateString(subject, "Subject", MAX_SUBJECT_LENGTH, false);
    if (!subjectValidation.valid) {
      return jsonResponse({ error: subjectValidation.error }, { status: 400 });
    }

    const contextValidation = validateString(context, "Context", MAX_CONTEXT_LENGTH, false);
    if (!contextValidation.valid) {
      return jsonResponse({ error: contextValidation.error }, { status: 400 });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI provider is not configured");
    }

    const curriculumGuide: Record<string, string> = {
      "CBSE": "Follow CBSE syllabus. Use NCERT methods.",
      "NCERT": "Strictly follow NCERT textbook approaches.",
      "ICSE": "Follow ICSE syllabus with detailed explanations.",
      "GSEB": "Follow GSEB curriculum methods.",
      "Cambridge": "Follow Cambridge International standards.",
      "IB": "Follow IB standards with inquiry-based learning.",
      "State Board": "Use region-appropriate methods.",
      "General": "Use universally applicable teaching methods."
    };

    const selectedCurriculum = curriculum && curriculumGuide[curriculum] 
      ? curriculumGuide[curriculum] 
      : curriculumGuide["General"];

    const systemPrompt = `You are SYNOVA's Homework Assistant. GUIDE students — don't give direct answers.

LANGUAGE: Respond ONLY in ${responseLanguage}. ALL explanations, headings, and encouragement MUST be in ${responseLanguage}, regardless of the language the student writes in. Keep formulas and standard scientific terms in their conventional form. If ${responseLanguage} is "hinglish", mix Hindi and English naturally in Roman script.

CURRICULUM: ${selectedCurriculum}

GOLDEN RULE: Explain like a supportive senior. Use simple everyday English and real-life examples before any formula.

RULES:
1. NEVER give the final answer directly — help them figure it out
2. Start with a real-life analogy to connect the concept
3. Break the problem into small, easy steps — explain each in plain words
4. Use Class 10 level language for Class 12 concepts
5. Keep responses short and focused — no long paragraphs
6. CRITICAL: You have FULL MEMORY of this conversation. Short answers like "9" are REPLIES to your previous question.
7. When a student answers your question, evaluate it in context.

RESPONSE FORMAT:
1. 📋 **What's being asked** - Restate simply
2. 💡 **Real-life connection** - Relatable example/analogy
3. 📝 **Step-by-step approach** - How to solve (plain words + math, no final answer)
4. ⚠️ **Common mistakes** - What to watch out for
5. ✏️ **Now you try** - Give them a nudge

For FOLLOW-UP messages:
- Acknowledge their answer
- If correct: "That's right! 🎉" and move to next step
- If wrong: Gently correct with a better analogy
- Keep building on the SAME problem

Subject: ${subjectValidation.value || "General"}
${contextValidation.value ? `Context: ${contextValidation.value}` : ""}

TABULAR DATA: Whenever data has rows/columns (frequency tables, comparisons, etc.), render it as a proper GitHub-Flavored Markdown table with \`|\` and \`---\` separators on separate lines — NEVER as inline pipe-separated text. Put a blank line before and after every table.

Be encouraging and patient! Always respond in English only.`;

    // Build conversation messages: use full history if provided, otherwise just the question
    const historyValidation = messages ? validateMessages(messages) : null;
    const conversationMessages = historyValidation?.valid
      ? historyValidation.messages
      : [{ role: "user", content: questionValidation.value }];

    console.log("[homework-assist] Calling Lovable AI Gateway, messages:", conversationMessages.length);

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
          ...conversationMessages,
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[homework-assist] AI gateway error:", response.status, errText);

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

    console.log("[homework-assist] Success, reply length:", reply.length);
    return jsonResponse({ reply });
  } catch (error) {
    console.error("Error in homework-assist:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
