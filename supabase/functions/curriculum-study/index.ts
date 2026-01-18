import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function extractProviderMessage(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.message || raw;
  } catch {
    return raw;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, curriculum, standard, subject, chapter, currentTopic, messages, completedTopics } =
      await req.json();

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
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

Task: List the chapters for ${subject} (${standard}, ${curriculum}).

Output rules:
- Return ONLY a valid JSON array (no markdown, no code fences).
- Each item must be: {"number": number, "name": string, "topicsCount": number}.
- Keep correct chapter order for the board/textbook.
`;

      userPrompt = `Return the chapter list now.`;
    } else if (action === "get_topics") {
      systemPrompt = `You are SYNOVA, an expert curriculum advisor. ${selectedCurriculumContext}

Task: List the teaching topics for Chapter "${chapter}" in ${subject} (${standard}, ${curriculum}).

Output rules:
- Return ONLY a valid JSON array (no markdown, no code fences).
- Each item must be: {"index": number, "name": string, "description": string, "estimatedMinutes": number}.
- Order topics from basic to advanced.
`;

      userPrompt = `Return the topics list now.`;
    } else if (action === "teach_topic") {
      systemPrompt = `You are SYNOVA, an adaptive tutor for ${curriculum} curriculum (${standard}).

Context:
Subject: ${subject}
Chapter: ${chapter}
Topic: ${currentTopic}

CURRICULUM ALIGNMENT: ${selectedCurriculumContext}

VERY IMPORTANT OUTPUT RULES:
- Output PLAIN TEXT ONLY.
- Do NOT use markdown. Do NOT use: #, ##, ###, **, *, backticks, bullets like "-" or "•".
- Use short sentences. Be direct. No filler like "Sure" / "Let's dive in".
- Explain the topic step-by-step.

Use this exact format and labels (in this order):
TOPIC:
INTRODUCTION:
CORE EXPLANATION:
IMPORTANT LINES (EXAM):
1)
2)
3)
DEFINITIONS (if any):
FORMULAS (if any, use $...$ for math):
WORKED EXAMPLE 1:
WORKED EXAMPLE 2:
PRACTICE QUESTIONS:
1)
2)
`;

      userPrompt =
        messages && messages.length > 0
          ? messages[messages.length - 1].content
          : `Teach the topic now.`;
    } else if (action === "continue_learning") {
      const completedList = completedTopics?.join(", ") || "none";

      systemPrompt = `You are SYNOVA, an adaptive tutor for ${curriculum} curriculum (${standard}).

Context:
Subject: ${subject}
Chapter: ${chapter}
Current topic: ${currentTopic}
Completed topics: ${completedList}

CURRICULUM ALIGNMENT: ${selectedCurriculumContext}

VERY IMPORTANT OUTPUT RULES:
- Output PLAIN TEXT ONLY.
- Do NOT use markdown. Do NOT use: #, ##, ###, **, *, backticks, bullets like "-" or "•".
- Be direct and structured.

Use this exact format and labels (in this order):
TOPIC:
RECAP (2-4 lines):
CORE EXPLANATION:
IMPORTANT LINES (EXAM):
1)
2)
3)
WORKED EXAMPLE 1:
PRACTICE QUESTIONS:
1)
2)
`;

      userPrompt = `Continue teaching from the current topic now.`;
    } else if (action === "answer_doubt") {
      systemPrompt = `You are SYNOVA, helping a ${standard} student studying ${subject} under ${curriculum} curriculum.

Context:
Chapter: ${chapter}
Topic: ${currentTopic}

CURRICULUM ALIGNMENT: ${selectedCurriculumContext}

VERY IMPORTANT OUTPUT RULES:
- Output PLAIN TEXT ONLY.
- Do NOT use markdown. Do NOT use: #, ##, ###, **, *, backticks.
- Keep the answer focused on the student's question.
- If needed, give one small example.
`;

      userPrompt =
        messages && messages.length > 0
          ? messages[messages.length - 1].content
          : "Answer the student's question.";
    } else {
      return jsonResponse({ error: "Invalid action specified" }, { status: 400 });
    }

    const subjectLower = String(subject || "").toLowerCase();
    const isQuantHeavy =
      subjectLower.includes("math") ||
      subjectLower.includes("physics") ||
      subjectLower.includes("chem") ||
      subjectLower.includes("bio") ||
      subjectLower.includes("computer");

    // Prefer high-quality free models; avoid Xiaomi as requested.
    const modelCandidates = isQuantHeavy
      ? ["qwen/qwen-2.5-72b-instruct:free", "meta-llama/llama-3.3-70b-instruct:free"]
      : ["meta-llama/llama-3.3-70b-instruct:free", "qwen/qwen-2.5-72b-instruct:free"];

    console.log("Curriculum study request", { action, curriculum, standard, subject, modelCandidates });

    let response: Response | null = null;

    for (let i = 0; i < modelCandidates.length; i++) {
      const model = modelCandidates[i];

      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://synova.app",
          "X-Title": "SYNOVA Curriculum Study",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...(messages || []), { role: "user", content: userPrompt }],
          temperature: action === "get_chapters" || action === "get_topics" ? 0.2 : 0.6,
        }),
      });

      if (response.ok) {
        console.log("OpenRouter used model", { model });
        break;
      }

      const rawErrorText = await response.text();
      const providerMessage = extractProviderMessage(rawErrorText);

      console.error("OpenRouter error", {
        model,
        status: response.status,
        providerMessage,
      });

      // If rate-limited, switching models usually won't help.
      if (response.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please try again in a moment." }, { status: 429 });
      }

      const isLastTry = i === modelCandidates.length - 1;
      const shouldTryNextModel = !isLastTry && [400, 402, 404, 502, 503].includes(response.status);

      if (shouldTryNextModel) continue;

      // Final error surface
      if (response.status === 402) {
        return jsonResponse({ error: `AI service returned 402. ${providerMessage}` }, { status: 402 });
      }

      return jsonResponse({ error: `AI service error (${response.status}). ${providerMessage}` }, { status: 502 });
    }

    if (!response) {
      return jsonResponse({ error: "AI request failed." }, { status: 502 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    if (action === "get_chapters" || action === "get_topics") {
      try {
        let jsonStr = reply;
        const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        const parsed = JSON.parse(jsonStr);
        return jsonResponse({ data: parsed, raw: reply });
      } catch {
        return jsonResponse({ reply, parseError: true });
      }
    }

    return jsonResponse({ reply });
  } catch (error) {
    console.error("Curriculum study error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});
