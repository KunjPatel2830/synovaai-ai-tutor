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

// ── Input validation ──
const MAX_STRING_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 50;
const VALID_ACTIONS = ["get_chapters", "get_topics", "teach_topic", "continue_learning", "answer_doubt"];
const VALID_ROLES = ["user", "assistant", "system"];

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  return stripHtml(input).slice(0, maxLen);
}

function validateMessages(messages: unknown): Array<{ role: string; content: string }> {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m: any) =>
      m && typeof m === "object" &&
      typeof m.role === "string" && VALID_ROLES.includes(m.role) &&
      typeof m.content === "string" && m.content.trim().length > 0 &&
      m.content.length <= MAX_MESSAGE_LENGTH
    )
    .slice(0, MAX_MESSAGES)
    .map((m: any) => ({ role: m.role, content: m.content.trim() }));
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function extractErrorMessage(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.message || parsed?.error || raw;
  } catch {
    return raw;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth check ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const userClient = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate Limiting ──
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: rl } = await admin.rpc("check_rate_limit", { _user_id: authData.user.id, _endpoint: "curriculum-study", _max_requests: 20, _window_seconds: 60 });
    if (rl && rl.length > 0 && !rl[0].allowed) {
      return jsonResponse({ error: `Rate limit exceeded. Try again in ${rl[0].retry_after} seconds.` }, { status: 429 });
    }
  } catch (e) { console.error("Rate limit check failed, allowing request:", e); }

  try {
    const body = await req.json();

    // Validate action
    const action = sanitizeText(body.action, 30);
    if (!action || !VALID_ACTIONS.includes(action)) {
      return jsonResponse({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
    }

    // Sanitize all text inputs
    const curriculum = sanitizeText(body.curriculum, MAX_STRING_LENGTH) || "General";
    const standard = sanitizeText(body.standard, MAX_STRING_LENGTH);
    const subject = sanitizeText(body.subject, MAX_STRING_LENGTH);
    const chapter = sanitizeText(body.chapter, MAX_STRING_LENGTH);
    const currentTopic = sanitizeText(body.currentTopic, MAX_STRING_LENGTH);
    const messages = validateMessages(body.messages);

    // Validate completedTopics as string array
    const completedTopics: string[] = Array.isArray(body.completedTopics)
      ? body.completedTopics
          .filter((t: unknown) => typeof t === "string")
          .map((t: string) => stripHtml(t).slice(0, MAX_STRING_LENGTH))
          .slice(0, 100)
      : [];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI provider is not configured");
    }

    // Curriculum-specific context
    const curriculumContext: Record<string, string> = {
      CBSE: "Follow CBSE/NCERT curriculum strictly. Use NCERT textbook language and examples.",
      NCERT: "Follow NCERT textbook strictly. Use the same terminology and approach as the book.",
      ICSE: "Follow ICSE curriculum guidelines. Use ICSE-style examples and exam patterns.",
      GSEB: "Follow GSEB curriculum. Use examples and wording common in GSEB textbooks/exams.",
      "Maharashtra Board": "Follow Maharashtra State Board curriculum (MSBSHSE).",
      Cambridge: "Follow Cambridge IGCSE/A-Level curriculum. Use Cambridge learning objectives.",
      IB: "Follow IB curriculum. Emphasize conceptual clarity and inquiry-based learning.",
      "State Board": "Follow the selected State Board curriculum and typical exam patterns.",
    };

    const selectedCurriculumContext =
      curriculumContext[curriculum] || "Follow a standard academic curriculum for this grade.";

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "get_chapters") {
      systemPrompt = `You are SYNOVA, an expert curriculum advisor. ${selectedCurriculumContext}

Task: List ALL chapters for ${subject} (${standard}, ${curriculum}) from the official textbook.

CRITICAL: Return ONLY a valid JSON array. No explanations, no markdown, no code fences.
Each item: {"number": number, "name": "chapter name", "topicsCount": number}
Keep correct chapter order from the textbook.`;
      userPrompt = `Return the complete chapter list as JSON array.`;
    } else if (action === "get_topics") {
      systemPrompt = `You are SYNOVA, an expert curriculum advisor. ${selectedCurriculumContext}

Task: List ALL topics from Chapter "${chapter}" in ${subject} (${standard}, ${curriculum}).

CRITICAL: Return ONLY a valid JSON array. No explanations, no markdown, no code fences.
Each item: {"index": number, "name": "topic name", "description": "brief description", "estimatedMinutes": number}
Order: basic to advanced, matching textbook sequence.`;
      userPrompt = `Return the complete topics list as JSON array.`;
    } else if (action === "teach_topic") {
      systemPrompt = `You are SYNOVA, a brilliant teacher for ${curriculum} curriculum (${standard}).

Subject: ${subject}
Chapter: ${chapter}
Topic: ${currentTopic}

CURRICULUM ALIGNMENT: ${selectedCurriculumContext}

YOUR TASK: Teach this topic COMPLETELY and THOROUGHLY. Give a FULL explanation that a student can understand.

OUTPUT FORMAT (use these exact headings):

TOPIC: [topic name]

INTRODUCTION:
[2-3 sentences introducing the topic and why it matters]

CORE EXPLANATION:
[Detailed explanation of the concept. Use simple language. Break down complex ideas into steps. Give real-world examples. This should be 4-6 paragraphs minimum.]

IMPORTANT LINES FOR EXAMS:
1) [Key statement to memorize]
2) [Key statement to memorize]
3) [Key statement to memorize]

DEFINITIONS:
[List any important terms and their definitions]

FORMULAS:
[List formulas using LaTeX like $formula$ if applicable]

WORKED EXAMPLE 1:
[Step-by-step solved problem]

WORKED EXAMPLE 2:
[Another step-by-step solved problem]

PRACTICE QUESTIONS:
1) [Question for student to try]
2) [Question for student to try]

REMEMBER: Be thorough and complete.`;
      userPrompt = "Teach this topic now with a complete, detailed explanation.";
    } else if (action === "continue_learning") {
      const completedList = completedTopics.join(", ") || "none";

      systemPrompt = `You are SYNOVA, a brilliant teacher for ${curriculum} curriculum (${standard}).

Subject: ${subject}
Chapter: ${chapter}
Current topic: ${currentTopic}
Already completed: ${completedList}

CURRICULUM ALIGNMENT: ${selectedCurriculumContext}

YOUR TASK: Teach this NEW topic COMPLETELY. Start with a brief recap of what was learned before, then give a FULL explanation of the current topic.

OUTPUT FORMAT (use these exact headings):

TOPIC: [topic name]

QUICK RECAP:
[2-3 sentences connecting to previously learned concepts]

CORE EXPLANATION:
[Detailed explanation. Use simple language. Break down complex ideas. Give real-world examples. 4-6 paragraphs minimum.]

IMPORTANT LINES FOR EXAMS:
1) [Key statement to memorize]
2) [Key statement to memorize]
3) [Key statement to memorize]

DEFINITIONS:
[List any important terms and their definitions]

FORMULAS:
[List formulas using LaTeX like $formula$ if applicable]

WORKED EXAMPLE:
[Step-by-step solved problem]

PRACTICE QUESTIONS:
1) [Question for student to try]
2) [Question for student to try]

REMEMBER: Be thorough and complete.`;
      userPrompt = "Continue teaching with a complete explanation of the current topic.";
    } else if (action === "answer_doubt") {
      systemPrompt = `You are SYNOVA, helping a ${standard} student studying ${subject} under ${curriculum} curriculum.

Chapter: ${chapter}
Topic: ${currentTopic}

CURRICULUM ALIGNMENT: ${selectedCurriculumContext}

Answer the student's question clearly and completely. Give examples if helpful. Keep the answer focused but thorough.`;
      userPrompt =
        messages.length > 0
          ? messages[messages.length - 1].content
          : "Answer the student's question.";
    } else {
      return jsonResponse({ error: "Invalid action specified" }, { status: 400 });
    }

    console.log("Curriculum study request", { action, curriculum, standard, subject, chapter, currentTopic });

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
      { role: "user", content: userPrompt },
    ];

    const isListAction = action === "get_chapters" || action === "get_topics";
    const lovableModel = isListAction ? "google/gemini-2.5-flash-lite" : "google/gemini-3-flash-preview";

    const lovableResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: lovableModel,
        messages: chatMessages,
        temperature: isListAction ? 0.2 : 0.7,
      }),
    });

    let reply = "";

    if (lovableResp.ok) {
      const lovableJson = await lovableResp.json();
      reply = lovableJson.choices?.[0]?.message?.content || "";
    } else {
      const errorText = await lovableResp.text();
      const providerMessage = extractErrorMessage(errorText);
      console.error("AI gateway error:", lovableResp.status, providerMessage);

      if (lovableResp.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please wait a moment and try again." }, { status: 429 });
      }
      if (lovableResp.status === 402) {
        return jsonResponse(
          { error: "AI credits exhausted. Please add credits to your Lovable workspace (Settings → Usage)." },
          { status: 402 }
        );
      }
      return jsonResponse({ error: "AI service temporarily unavailable." }, { status: 502 });
    }

    if (!reply) {
      return jsonResponse({ error: "AI returned empty response. Please try again." }, { status: 502 });
    }

    console.log("AI response received", { action, replyLength: reply.length });

    if (isListAction) {
      try {
        let jsonStr = reply;
        const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (arrayMatch) jsonStr = arrayMatch[0];

        const parsed = JSON.parse(jsonStr);
        return jsonResponse({ data: parsed, raw: reply });
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "Raw reply:", reply);
        return jsonResponse(
          { error: "AI returned an invalid chapter/topic list format. Please try again." },
          { status: 502 }
        );
      }
    }

    return jsonResponse({ reply });
  } catch (error) {
    console.error("Curriculum study error:", error);
    return jsonResponse(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
});
