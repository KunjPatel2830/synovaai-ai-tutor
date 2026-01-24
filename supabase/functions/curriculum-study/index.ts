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

  try {
    const { action, curriculum, standard, subject, chapter, currentTopic, messages, completedTopics } =
      await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!LOVABLE_API_KEY && !OPENROUTER_API_KEY) {
      throw new Error("No AI provider is configured");
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

REMEMBER: Be thorough and complete. Students depend on your explanation to understand the topic fully.`;

      userPrompt = "Teach this topic now with a complete, detailed explanation.";
    } else if (action === "continue_learning") {
      const completedList = completedTopics?.join(", ") || "none";

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
[Detailed explanation of the concept. Use simple language. Break down complex ideas into steps. Give real-world examples. This should be 4-6 paragraphs minimum.]

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

REMEMBER: Be thorough and complete. Students depend on your explanation.`;

      userPrompt = "Continue teaching with a complete explanation of the current topic.";
    } else if (action === "answer_doubt") {
      systemPrompt = `You are SYNOVA, helping a ${standard} student studying ${subject} under ${curriculum} curriculum.

Chapter: ${chapter}
Topic: ${currentTopic}

CURRICULUM ALIGNMENT: ${selectedCurriculumContext}

Answer the student's question clearly and completely. Give examples if helpful. Keep the answer focused but thorough.`;

      userPrompt =
        messages && messages.length > 0
          ? messages[messages.length - 1].content
          : "Answer the student's question.";
    } else {
      return jsonResponse({ error: "Invalid action specified" }, { status: 400 });
    }

    console.log("Curriculum study request", { action, curriculum, standard, subject, chapter, currentTopic });

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
      { role: "user", content: userPrompt },
    ];

    const isListAction = action === "get_chapters" || action === "get_topics";

    let reply = "";
    let provider: "lovable" | "openrouter" | "none" = "none";

    // 1) Try Lovable AI first, but fallback if credits are exhausted (402) or temporary errors.
    if (LOVABLE_API_KEY) {
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

      if (lovableResp.ok) {
        const lovableJson = await lovableResp.json();
        reply = lovableJson.choices?.[0]?.message?.content || "";
        provider = "lovable";
      } else {
        const errorText = await lovableResp.text();
        const providerMessage = extractErrorMessage(errorText);
        console.error("AI gateway error:", lovableResp.status, providerMessage);

        const canFallback = Boolean(OPENROUTER_API_KEY) && [402, 429, 500, 502, 503].includes(lovableResp.status);
        if (!canFallback) {
          if (lovableResp.status === 429) {
            return jsonResponse({ error: "Rate limit exceeded. Please try again in a moment." }, { status: 429 });
          }
          if (lovableResp.status === 402) {
            return jsonResponse(
              { error: "Not enough AI credits for this workspace. Please add credits to continue." },
              { status: 402 }
            );
          }
          return jsonResponse({ error: "AI service temporarily unavailable. Please try again." }, { status: 502 });
        }
      }
    }

    // 2) Fallback: OpenRouter free models (keeps the app working even when credits are empty)
    if (!reply && OPENROUTER_API_KEY) {
      const modelCandidates = isListAction
        ? [
            "meta-llama/llama-3.3-70b-instruct:free",
            "google/gemma-3-27b:free",
            "mistralai/mistral-small-24b-instruct-2501:free",
          ]
        : [
            "meta-llama/llama-3.3-70b-instruct:free",
            "mistralai/mistral-small-24b-instruct-2501:free",
          ];

      const responseFormat =
        action === "get_chapters"
          ? {
              type: "json_schema",
              json_schema: {
                name: "chapters",
                strict: true,
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      number: { type: "number" },
                      name: { type: "string" },
                      topicsCount: { type: "number" },
                    },
                    required: ["number", "name", "topicsCount"],
                    additionalProperties: false,
                  },
                },
              },
            }
          : {
              type: "json_schema",
              json_schema: {
                name: "topics",
                strict: true,
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number" },
                      name: { type: "string" },
                      description: { type: "string" },
                      estimatedMinutes: { type: "number" },
                    },
                    required: ["index", "name", "description", "estimatedMinutes"],
                    additionalProperties: false,
                  },
                },
              },
            };

      let lastErr = "";

      for (const model of modelCandidates) {
        const supportsStructured =
          isListAction &&
          (model.includes("llama") || model.includes("gemini") || model.includes("gemma") || model.includes("qwen"));

        const body: Record<string, unknown> = {
          model,
          messages: chatMessages,
          temperature: isListAction ? 0.0 : 0.7,
          max_tokens: isListAction ? 1200 : 2400,
        };

        if (supportsStructured) {
          body.response_format = responseFormat;
        }

        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://synova.app",
            "X-Title": "SYNOVA Curriculum Study",
          },
          body: JSON.stringify(body),
        });

        if (r.ok) {
          const j = await r.json();
          reply = j.choices?.[0]?.message?.content || "";
          provider = "openrouter";
          break;
        }

        const errText = await r.text();
        lastErr = extractErrorMessage(errText);
        console.error("OpenRouter error:", { status: r.status, model, lastErr });

        // auth errors: no point retrying
        if ([401, 403].includes(r.status)) break;
        // rate limited: wait on client and retry later
        if (r.status === 429) break;
      }

      if (!reply) {
        return jsonResponse(
          { error: `AI service temporarily unavailable. ${lastErr || "Please try again."}` },
          { status: 502 }
        );
      }
    }

    if (!reply) {
      return jsonResponse({ error: "AI service temporarily unavailable. Please try again." }, { status: 502 });
    }

    console.log("AI response received", { action, provider, replyLength: reply.length });

    if (action === "get_chapters" || action === "get_topics") {
      try {
        let jsonStr = reply;
        // Extract JSON from possible markdown code blocks
        const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        // Try to find JSON array in the response
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
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});
