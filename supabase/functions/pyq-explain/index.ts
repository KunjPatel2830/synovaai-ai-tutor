import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_QUESTION_LENGTH = 2000;
const MAX_OPTION_LENGTH = 500;
const MAX_SUBJECT_LENGTH = 100;
const MAX_TOPIC_LENGTH = 200;
const MAX_FOLLOWUP_LENGTH = 2000;
const VALID_OPTIONS = ["A", "B", "C", "D"];

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  return stripHtml(input).slice(0, maxLen);
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth check ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonRes({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonRes({ error: "Unauthorized" }, 401);
  }

  // ── Rate Limiting ──
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: rl } = await admin.rpc("check_rate_limit", { _user_id: authData.user.id, _endpoint: "pyq-explain", _max_requests: 20, _window_seconds: 60 });
    if (rl && rl.length > 0 && !rl[0].allowed) {
      return jsonRes({ error: `Rate limit exceeded. Try again in ${rl[0].retry_after} seconds.` }, 429);
    }
  } catch (e) { console.error("Rate limit check failed, allowing request:", e); }

  try {
    const body = await req.json();
    const correctOption = sanitizeText(body.correctOption, 2);
    const studentAnswer = sanitizeText(body.studentAnswer, 2);
    const subject = sanitizeText(body.subject, MAX_SUBJECT_LENGTH);
    const topic = sanitizeText(body.topic, MAX_TOPIC_LENGTH);
    const examType = sanitizeText(body.examType, 50);
    const followUpQuery = sanitizeText(body.followUpQuery, MAX_FOLLOWUP_LENGTH);

    if (!question) return jsonRes({ error: "Missing question" }, 400);
    if (!correctOption || !VALID_OPTIONS.includes(correctOption)) {
      return jsonRes({ error: "Invalid correctOption" }, 400);
    }

    // Validate options object
    const options = body.options;
    if (!options || typeof options !== "object") {
      return jsonRes({ error: "Missing options" }, 400);
    }
    const sanitizedOptions: Record<string, string> = {};
    for (const key of VALID_OPTIONS) {
      sanitizedOptions[key] = sanitizeText(options[key], MAX_OPTION_LENGTH) || "";
    }

    const isCorrect = studentAnswer === correctOption;
    const isFollowUp = !!followUpQuery;

    let systemPrompt: string;
    let userPrompt: string;

    if (isFollowUp) {
      systemPrompt = `You are an expert ${subject} teacher helping students prepare for ${examType || "competitive exams"} like JEE and NEET.

Answer the student's follow-up question in an exam-style, VERY SHORT way.

RULES:
- Total length: <= 80 words
- No long theory, no extra sections, no fluff
- Use LaTeX for any math/formulas
- Prefer bullets if multiple points
- If a diagram/visual is necessary, include exactly ONE tag on its own line: [IMAGE: ...]
`;

      userPrompt = `Original Question: ${question}

Options:
A) ${sanitizedOptions.A}
B) ${sanitizedOptions.B}
C) ${sanitizedOptions.C}
D) ${sanitizedOptions.D}

Correct Answer: ${correctOption}
Subject: ${subject}
${topic ? `Topic: ${topic}` : ""}

Student's Follow-up Question: ${followUpQuery}

Reply briefly (<= 80 words).`;
    } else {
      systemPrompt = `You are an expert ${subject} teacher helping students prepare for ${examType || "competitive exams"} like JEE and NEET.

Give a SHORT exam-style explanation (not a full lecture).

OUTPUT FORMAT (follow EXACTLY):
Result: ${isCorrect ? "Correct" : "Incorrect"}. Correct option: ${correctOption}.
Why:
- (1 to 3 bullets, max 12 words each)
Key formula: (1 line, omit if not needed)
Quick tip: (1 short line)

RULES:
- Total length: <= 120 words
- No extra headings/emojis/sections beyond the format above
- Use LaTeX for formulas
- If the question needs a diagram/visual (lens rays, circuits, geometry figure, graph, etc.), add EXACTLY ONE line right after the Why bullets:
  [IMAGE: short descriptive diagram name]
`;

      userPrompt = `Question: ${question}

Options:
A) ${sanitizedOptions.A}
B) ${sanitizedOptions.B}
C) ${sanitizedOptions.C}
D) ${sanitizedOptions.D}

Correct Answer: ${correctOption}
Student's Answer: ${studentAnswer}
Subject: ${subject}
${topic ? `Topic: ${topic}` : ""}

Explain using the exact format above.`;
    }

    console.log(`[pyq-explain] ${isFollowUp ? "Follow-up" : "Explanation"} for ${subject} question`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI provider is not configured");
    }

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
        temperature: 0.3,
        max_tokens: isFollowUp ? 400 : 600,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[pyq-explain] AI gateway error:", response.status, errText);
      if (response.status === 429) return jsonRes({ error: "Rate limits exceeded, please try again later." }, 429);
      if (response.status === 402) return jsonRes({ error: "AI credits exhausted." }, 402);
      return jsonRes({ error: "AI service temporarily unavailable." }, 502);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[pyq-explain] Error:", error);
    return jsonRes({ error: "Something went wrong. Please try again." }, 500);
  }
});
